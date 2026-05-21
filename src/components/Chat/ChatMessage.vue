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
</style>
