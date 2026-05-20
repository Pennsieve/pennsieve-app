<template>
  <div ref="scrollEl" class="chat-message-list">
    <slot name="empty" v-if="!messages.length && !pending" />
    <ChatMessage v-for="(msg, idx) in messages" :key="idx" :message="msg" />
    <ChatToolProgress v-if="activeTools.length" :tools="activeTools" />
    <div v-if="pending && !hasRunningTool" class="thinking">
      <span class="dot" />
      <span class="dot" />
      <span class="dot" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import ChatMessage from './ChatMessage.vue'
import ChatToolProgress from './ChatToolProgress.vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  pending: { type: Boolean, default: false },
  activeTools: { type: Array, default: () => [] },
})

const hasRunningTool = computed(() => props.activeTools.some((t) => t.status === 'running'))

const scrollEl = ref(null)

const scrollToBottom = async () => {
  await nextTick()
  if (scrollEl.value) {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  }
}

watch(() => props.messages.length, scrollToBottom)
watch(() => props.activeTools.length, scrollToBottom)
watch(() => props.pending, scrollToBottom)
</script>

<style scoped lang="scss">
.chat-message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.thinking {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;

  .dot {
    width: 6px;
    height: 6px;
    background: #999;
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;

    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
  }
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}
</style>
