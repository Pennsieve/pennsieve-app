<script setup>
// The view switch (Library/Live/Builder, Live/Environments): in the bar
// under the Analysis tabs (AnalysisViewBar), or in a view's own toolbar (the
// Workflows Library puts it next to its search).
defineProps({
  views: { type: Array, default: () => [] }, // [{ key, label }]
  modelValue: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <div class="view-switch" role="tablist">
    <button
      v-for="v in views"
      :key="v.key"
      type="button"
      role="tab"
      class="view-option"
      :class="{ active: modelValue === v.key }"
      :aria-selected="modelValue === v.key"
      @click="emit('update:modelValue', v.key)"
    >
      {{ v.label }}
    </button>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

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
</style>
