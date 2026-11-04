<script setup>
// The bar under the Analysis tabs on Workflows, Notebooks and Apps: the view
// switch on the left (Library/Live/Builder, Live/Environments; Apps has its
// search there instead, in the `lead` slot), the view's action on the right. One component, so the switch and the first
// heading below it sit in the same place on every tab.
import AnalysisViewSwitch from "./AnalysisViewSwitch.vue";

defineProps({
  views: { type: Array, default: () => [] }, // [{ key, label }]
  modelValue: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <div class="view-bar">
    <!-- A tab without views can put something there instead (Apps' search). -->
    <div v-if="$slots.lead" class="view-lead">
      <slot name="lead" />
    </div>
    <AnalysisViewSwitch
      v-else-if="views.length"
      :views="views"
      :model-value="modelValue"
      @update:model-value="(v) => emit('update:modelValue', v)"
    />
    <div class="view-actions">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

/* One compact row, lined up with the Analysis tabs (32px): the views on the
   left, the tab's actions (40px buttons) on the right, 8px above and below.
   A fixed height, so a view whose action is a link or a checkbox doesn't
   move the switch. */
.view-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
  box-sizing: border-box;
  height: 56px;
  padding: 0 32px;
  background: theme.$white;
}
.view-lead {
  display: flex;
  align-items: center;
  min-width: 0;
}
/* The switch's own look is in AnalysisViewSwitch.vue. */
/* The rest of the bar, the action at its right; a view can fill it (the
   builder's name and Save). */
.view-actions {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  min-width: 0;
}
</style>
