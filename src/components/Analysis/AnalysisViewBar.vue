<script setup>
// A tab's views and primary actions (Workflows: Live/Library/Builder and
// + Run Workflow; Notebooks: Live/Environments and + New…; Apps: its
// actions; a compute node: its tabs and Pause). Each overview owns its bar;
// the layout shows it in two places:
// - the views (#analysis-tab-views): in a workspace's Analysis, whose
//   sections are in the secondary nav, the page's tabs under the title; in
//   My Analysis, a switch on the right of its tab row;
// - the actions: in a workspace's Analysis (and My Analysis), at the top
//   right of the view's content (#analysis-content-actions: a row over its
//   first content, or over the search and Sort beside the filters); a
//   view without that row (the Builder) or a detail page keeps them on the
//   page's title row (OrgBreadcrumb: #page-title-actions): actionsAt="title".
import { computed, inject } from "vue";
import AnalysisViewSwitch from "./AnalysisViewSwitch.vue";

const props = defineProps({
  views: { type: Array, default: () => [] }, // [{ key, label }]
  modelValue: { type: String, default: "" },
  actionsAt: { type: String, default: "" }, // "title" or "content" overrides the layout's
});
const emit = defineEmits(["update:modelValue"]);
// Analysis.vue provides "sections": its views are the page's tabs.
const sections = inject("analysisLayout", "") === "sections";
const actionsTarget = computed(() => {
  const inContent = props.actionsAt ? props.actionsAt === "content" : sections;
  return inContent ? "#analysis-content-actions" : "#page-title-actions";
});
</script>

<template>
  <!-- Deferred: both targets are the layout's, rendered in the same pass. -->
  <Teleport v-if="views.length" defer to="#analysis-tab-views">
    <AnalysisViewSwitch
      :variant="sections ? 'tabs' : 'pill'"
      :views="views"
      :model-value="modelValue"
      @update:model-value="(v) => emit('update:modelValue', v)"
    />
  </Teleport>
  <!-- Keyed on the view too: each view renders its own content row, so a
       new view mounts the teleport again, after its row exists. -->
  <Teleport v-if="$slots.default" :key="`${actionsTarget}:${modelValue}`" defer :to="actionsTarget">
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
