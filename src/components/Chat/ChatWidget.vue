<template>
  <!-- Render the DashHeader slot so the dashboard title ("Ask Pennsieve")
       and its action icons render at the top of the widget, consistent
       with all other widgets. ChatPanel renders its context sub-bar
       (compute node, new chat) below the title. -->
  <slot :widgetName="widgetName" :childIcons="[]" />
  <div class="chat-widget">
    <ChatPanel
      v-if="orgId"
      :mode="mode"
      :org-id="orgId"
      :dataset-id="datasetId || null"
      :context-label="contextLabel"
      :starter-prompts="starterPrompts"
      :empty-title="emptyTitle"
    />
  </div>
</template>

<script setup>
import ChatPanel from './ChatPanel.vue'

defineProps({
  mode: { type: String, default: 'workspace' },
  orgId: { type: String, default: '' },
  datasetId: { type: String, default: null },
  contextLabel: { type: String, default: 'Workspace' },
  starterPrompts: { type: Array, default: () => [] },
  emptyTitle: { type: String, default: 'Ask anything about your workspace.' },
  // Title shown in the dashboard widget header.
  widgetName: { type: String, default: 'Ask Pennsieve' },
  // Lib injects these; we accept and ignore them to keep prop validation clean.
  widgetID: { type: String, default: '' },
  hideHeader: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
})
</script>

<style scoped lang="scss">
.chat-widget {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chat-widget :deep(.chat-panel) {
  // Remove the duplicate border/radius — the dashboard WidgetWrapper now
  // provides the card chrome.
  border: none;
  border-radius: 0;
  background: transparent;
  height: 100%;
}
</style>
