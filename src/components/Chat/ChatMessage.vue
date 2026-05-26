<template>
  <div class="chat-message" :class="roleClass">
    <div class="bubble">
      <!-- User turns: plain text + optional attachment chips above.
           Chips come from Spotlight's current-page auto-attach (and
           future @-mention / paste-URL flows). The chat-store keeps
           the prose body separate from the structured attachment
           metadata — the LLM-visible `[Attached file: …]` prefix is
           re-derived only when the message goes onto the wire. -->
      <template v-if="message.role !== 'assistant'">
        <div v-if="message.attachments?.length" class="user-attachments">
          <component
            :is="attachmentRouteFor(att) ? 'router-link' : 'span'"
            v-for="(att, idx) in message.attachments"
            :key="idx"
            :to="attachmentRouteFor(att) || undefined"
            class="user-attachment-chip"
            :class="`is-${att.type}`"
            :title="attachmentTitle(att)"
          >
            <span class="att-icon" aria-hidden="true">{{ att.type === 'file' ? '📄' : '📁' }}</span>
            <span class="att-name">{{ att.name || (att.type === 'file' ? 'File' : 'Dataset') }}</span>
          </component>
        </div>
        <span class="user-text">{{ message.content }}</span>
      </template>

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
import { useRoute } from 'vue-router'
import MarkdownContent from './MarkdownContent.vue'
import ChatImageBlock from './ChatImageBlock.vue'

const props = defineProps({
  message: { type: Object, required: true },
})

const route = useRoute()

// Build a vue-router target for an attachment chip so users can click
// through to the file detail / dataset overview. Returns null when we
// can't construct a route (missing orgId — chip degrades to a plain
// non-clickable span via the <component :is> pattern in the template).
function attachmentRouteFor(att) {
  const orgId = route.params?.orgId
  if (!orgId || !att?.datasetId) return null
  if (att.type === 'file' && att.packageId) {
    return {
      name: 'file-record',
      params: { orgId, datasetId: att.datasetId, fileId: att.packageId },
    }
  }
  if (att.type === 'dataset') {
    return {
      name: 'dataset-overview',
      params: { orgId, datasetId: att.datasetId },
    }
  }
  return null
}

// Tooltip text for an attachment chip. Surfaces the node ID for
// disambiguation when the chip name is ambiguous (e.g. multiple files
// share a name across the workspace) and the underlying ID isn't
// rendered anywhere else.
function attachmentTitle(att) {
  if (!att) return ''
  if (att.type === 'file') {
    return att.name
      ? `${att.name} (${att.packageId}) — open file details`
      : `Open ${att.packageId}`
  }
  if (att.type === 'dataset') {
    return att.name
      ? `${att.name} (${att.datasetId}) — open dataset`
      : `Open ${att.datasetId}`
  }
  return ''
}

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

// Attachment chips inside a user message bubble. Sit above the prose
// body, sized small so they read as "this is metadata I attached" not
// "this is the message". Both linked + non-linked variants — degrade
// to a plain span when the chip can't resolve a clickable route.
.user-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.user-attachment-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  // The bubble is theme.$purple_3 (navy); chip uses a translucent
  // white tint that picks up the bubble color rather than fighting
  // it. Theme-agnostic but tonally consistent.
  background: rgba(theme.$white, 0.18);
  border: none;
  color: theme.$white;
  text-decoration: none;
  max-width: 100%;

  .att-icon {
    flex-shrink: 0;
    font-size: 11px;
  }
  .att-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  // Hover treatment only on the link variant — the non-clickable
  // <span> fallback gets no hover affordance.
  &[href] {
    cursor: pointer;

    &:hover {
      background: rgba(theme.$white, 0.28);
    }
  }
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
