<script setup>
// A tab's views and primary actions (Workflows: Live/Library/Builder and
// + Run Workflow; Notebooks: Live/Environments and + New…; Apps: Add
// Repository / Create New App; a compute node: its tabs and Pause). Each
// overview owns its bar, shown in two places:
// - the views on the right of the Analysis tab row (Analysis.vue,
//   MyAnalysis.vue: #analysis-tab-views), navigation with the tabs;
// - the actions in a toolbar row under the tabs, on its right, where the
//   Compute Nodes tab has "+ New Compute Node" (ComputeNodesList's
//   .nodes-toolbar: 20px below the tabs, 32px in, 40px buttons). The lead
//   slot fills its left (the builder's name and Save), as the Compute Nodes
//   intro does.
import { Comment, useSlots } from "vue";
import AnalysisViewSwitch from "./AnalysisViewSwitch.vue";

defineProps({
  views: { type: Array, default: () => [] }, // [{ key, label }]
  modelValue: { type: String, default: "" },
  // A rule under the toolbar row, where a canvas starts (the Builder).
  ruled: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);

// Whether a slot renders anything (an action behind a v-if may not): no
// empty toolbar row.
const slots = useSlots();
const renders = (name) => (slots[name]?.() || []).some((v) => v.type !== Comment);
</script>

<template>
  <!-- Deferred: the tab row is the layout's, rendered in the same pass. -->
  <Teleport v-if="views.length" defer to="#analysis-tab-views">
    <AnalysisViewSwitch
      :views="views"
      :model-value="modelValue"
      @update:model-value="(v) => emit('update:modelValue', v)"
    />
  </Teleport>
  <div v-if="renders('default') || renders('lead')" class="view-toolbar" :class="{ 'view-toolbar--ruled': ruled }">
    <div class="view-lead"><slot name="lead" /></div>
    <div class="view-actions"><slot /></div>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

/* As the Compute Nodes tab's toolbar (.nodes-toolbar in its 20px/32px
   container): the actions on the right; the content's own top padding
   (20px) spaces it from what's below. */
.view-toolbar {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 40px;
  padding: 20px 32px 0;
}
.view-toolbar--ruled {
  padding-bottom: 12px;
  border-bottom: 1px solid theme.$gray_2;
}
.view-lead {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
}
.view-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-left: auto;
}
/* A phone: 16px in, as the content. */
@media (max-width: 767px) {
  .view-toolbar {
    padding: 16px 16px 0;
  }
}
</style>
