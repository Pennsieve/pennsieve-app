<script setup>
// A tab's views and primary actions (Workflows: Live/Library/Builder and
// + Run Workflow; Notebooks: Live/Environments and + New…; Apps: its
// actions; a compute node: its tabs and Pause). Each overview owns its bar;
// the layout shows it in two places, so the tab's content starts right
// below the tabs:
// - the views on the right of the Analysis tab row (Analysis.vue,
//   MyAnalysis.vue: #analysis-tab-views), navigation with the tabs;
// - the actions on the right of the page's title row (OrgBreadcrumb:
//   #page-title-actions), in one place on every tab and view.
import AnalysisViewSwitch from "./AnalysisViewSwitch.vue";

defineProps({
  views: { type: Array, default: () => [] }, // [{ key, label }]
  modelValue: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <!-- Deferred: both targets are the layout's, rendered in the same pass. -->
  <Teleport v-if="views.length" defer to="#analysis-tab-views">
    <AnalysisViewSwitch
      :views="views"
      :model-value="modelValue"
      @update:model-value="(v) => emit('update:modelValue', v)"
    />
  </Teleport>
  <Teleport v-if="$slots.default" defer to="#page-title-actions">
    <div class="view-actions">
      <slot />
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
/* The tab's actions, on the title row's right: standard 36px controls
   (as the app's filters and selects), normal padding, the filled primary
   style kept. Explicit sizes, so the header's or global button rules can't
   stretch them. */
.view-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;

  :deep(.bf-button) {
    box-sizing: border-box;
    height: 36px;
    min-height: 36px;
    min-width: 0;
    padding: 0 16px;
    font-size: 14px;
    line-height: 1;
    white-space: nowrap;
  }
}
</style>
