<script setup>
// The bar under the Analysis tabs on Gallery, Workflows and Notebooks: the
// view switch on the left (Workflows/Apps, Live/Builder, Live/Environments),
// the view's action on the right. One component, so the switch and the first
// heading below it sit in the same place on every tab.
defineProps({
  views: { type: Array, required: true }, // [{ key, label }]
  modelValue: { type: String, required: true },
});
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <div class="view-bar">
    <div class="view-switch" role="tablist">
      <button
        v-for="v in views"
        :key="v.key"
        role="tab"
        class="view-option"
        :class="{ active: modelValue === v.key }"
        :aria-selected="modelValue === v.key"
        @click="emit('update:modelValue', v.key)"
      >
        {{ v.label }}
      </button>
    </div>
    <div class="view-actions">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

/* Lined up with the Analysis tabs (32px). A fixed height, so a view whose
   action is a link or a checkbox doesn't move the switch. */
.view-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
  box-sizing: border-box;
  height: 68px;
  padding: 0 32px;
  background: theme.$white;
}
.view-switch {
  display: inline-flex;
  flex-shrink: 0;
  padding: 2px;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  background: theme.$gray_1;
}
.view-option {
  padding: 5px 14px;
  border: none;
  border-radius: 4px;
  background: none;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    color: theme.$purple_3;
  }
  &.active {
    background: theme.$white;
    color: theme.$purple_3;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
}
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
