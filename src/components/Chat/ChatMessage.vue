<template>
  <div class="chat-message" :class="roleClass">
    <div class="bubble">
      <!-- User turns: plain text only. No markdown, no blocks. -->
      <span v-if="message.role !== 'assistant'" class="user-text">{{ message.content }}</span>

      <!-- Assistant turns with structured blocks. Render in order;
           unknown block types are skipped (forward-compat). Used today
           for inline figure rendering on workflow-completion frames. -->
      <template v-else-if="hasBlocks">
        <template v-for="(block, idx) in message.blocks" :key="idx">
          <MarkdownContent
            v-if="block.type === 'text'"
            :source="block.text || ''"
          />
          <ChatImageBlock
            v-else-if="block.type === 'image'"
            :block="block"
          />
          <!-- else: unknown block type — render nothing (forward-compat) -->
        </template>
      </template>

      <!-- Default assistant render path: plain markdown content. This is
           what every sync chat turn uses; only the workflow-completion
           webhooks have started emitting `blocks` so far. -->
      <MarkdownContent
        v-else
        :source="message.content"
      />

      <!-- Persistent "background work in progress" indicators. Surfaced
           when the assistant turn kicked off async-mode tools (e.g.
           plot_file) whose results arrive in a later completion frame.
           Cleared in the store when the next assistant message lands. -->
      <div v-if="hasPendingTasks" class="pending-tasks">
        <div
          v-for="task in message.pendingTasks"
          :key="task.runId || task.tool"
          class="pending-task"
        >
          <span class="pending-spinner" aria-hidden="true"></span>
          <span class="pending-label">{{ taskLabel(task) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MarkdownContent from './MarkdownContent.vue'
import ChatImageBlock from './ChatImageBlock.vue'

const props = defineProps({
  message: { type: Object, required: true },
})

const roleClass = computed(() => `role-${props.message.role}${props.message.blocked ? ' blocked' : ''}`)

// Structured-content rendering kicks in when the backend supplied a
// non-empty `blocks` array. Older backends (and most sync chat turns)
// don't set this field; we fall back to plain markdown of `content`.
const hasBlocks = computed(
  () => Array.isArray(props.message.blocks) && props.message.blocks.length > 0,
)

// Background-task pills render when the assistant turn triggered one or
// more async-mode workflow runs. Cleared by the store when the next
// assistant message arrives in the same conversation.
const hasPendingTasks = computed(
  () => Array.isArray(props.message.pendingTasks) && props.message.pendingTasks.length > 0,
)

// Pick a friendly label per pending task. Backend may supply one via
// `task.label` (typically the tool's own copy, e.g. "Plot generation
// started in the background…"); otherwise derive from the tool name.
function taskLabel(task) {
  if (task?.label) return task.label
  switch (task?.tool) {
    case 'plot_file':
      return 'Generating plot — you’ll be notified when it’s ready.'
    default:
      return 'Working on it in the background…'
  }
}
</script>

<style scoped lang="scss">
@use '../../styles/theme';
.chat-message {
  display: flex;
  margin: 8px 0;

  &.role-user {
    justify-content: flex-end;
    .bubble {
      background: theme.$purple_3;
      color: #fff;
      border-bottom-right-radius: 4px;
    }
  }

  &.role-assistant {
    justify-content: flex-start;
    .bubble {
      background: #f0f2f5;
      color: #1c1c1c;
      border-bottom-left-radius: 4px;
    }
    &.blocked .bubble {
      background: #fff3cd;
      border: 1px solid #ffe69c;
      color: #6b5500;
    }
  }
}

.bubble {
  max-width: 80%;
  padding: 8px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.5;
  word-wrap: break-word;
}

.user-text {
  white-space: pre-wrap;
}

// Pending-task pills — one row per in-flight async workflow. Sized to
// feel like the same-bubble continuation rather than a separate message.
.pending-tasks {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed #c9ced6;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pending-task {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4a4a4a;
}

.pending-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid #c9ced6;
  border-top-color: #5039f5;
  border-radius: 50%;
  animation: pending-spin 0.9s linear infinite;
  flex-shrink: 0;
}

.pending-label {
  font-style: italic;
}

@keyframes pending-spin {
  to { transform: rotate(360deg); }
}
</style>
