<template>
  <div class="chat-message" :class="roleClass">
    <div class="bubble">
      <MarkdownContent v-if="message.role === 'assistant'" :source="message.content" />
      <span v-else class="user-text">{{ message.content }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MarkdownContent from './MarkdownContent.vue'

const props = defineProps({
  message: { type: Object, required: true },
})

const roleClass = computed(() => `role-${props.message.role}${props.message.blocked ? ' blocked' : ''}`)
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
