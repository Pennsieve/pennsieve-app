<template>
  <div v-if="tools.length" class="chat-tool-progress">
    <div v-for="tool in tools" :key="tool.name + tool.status" class="tool-row" :class="`status-${tool.status}`">
      <span class="indicator">
        <span v-if="tool.status === 'running'" class="spinner" />
        <span v-else-if="tool.status === 'done'" class="check">✓</span>
        <span v-else-if="tool.status === 'error'" class="warn">!</span>
      </span>
      <span class="label">{{ labelForTool(tool.name) }}</span>
    </div>
  </div>
</template>

<script setup>
import { labelForTool } from './toolLabels'

defineProps({
  tools: { type: Array, default: () => [] },
})
</script>

<style scoped lang="scss">
@use '../../styles/theme';
.chat-tool-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 16px;
  margin: 0 0 8px;
}

.tool-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #666;

  &.status-done { color: #2a8a3e; }
  &.status-error { color: #b34141; }
}

.indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0, 0, 0, 0.15);
  border-top-color: theme.$purple_3;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.check { font-size: 14px; }
.warn { font-weight: 700; }

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
