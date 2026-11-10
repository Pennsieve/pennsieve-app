<script setup>
// The view switch (Library/Live/Builder, Live/Environments): in the bar
// under the Analysis tabs (AnalysisViewBar), or in a view's own toolbar (the
// Workflows Library puts it next to its search).
defineProps({
  views: { type: Array, default: () => [] }, // [{ key, label }]
  modelValue: { type: String, default: "" },
  // "pill" (a toolbar, My Analysis's tab row) or "tabs" (a workspace's
  // Analysis, whose views are the page's tabs: underlined).
  variant: { type: String, default: "pill" },
});
const emit = defineEmits(["update:modelValue"]);
</script>

<template>
  <div class="view-switch" :class="variant" role="tablist">
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

/* A sub-selector beside the underlined tabs, not a second tab bar: 32px
   tall (the app's small controls), a thin light container, the chosen view
   a white pill. Explicit heights, so global button styles can't stretch it. */
.view-switch {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  box-sizing: border-box;
  height: 32px;
  padding: 2px;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  background: theme.$gray_1;
}
.view-option {
  box-sizing: border-box;
  height: 26px;
  margin: 0;
  padding: 0 12px;
  border: none;
  border-radius: 4px;
  background: none;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 26px;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    color: theme.$purple_3;
  }
  &.active {
    background: theme.$white;
    color: theme.$purple_3;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
}

/* Tabs: the row's full height, the chosen view underlined on the row's
   rule. */
.view-switch.tabs {
  align-items: stretch;
  gap: 24px;
  height: 100%;
  padding: 0;
  border: none;
  border-radius: 0;
  background: none;

  .view-option {
    height: 100%;
    padding: 0;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    font-size: 15px;
    font-weight: 400;
    line-height: normal;
    color: theme.$gray_5;

    &:hover {
      color: theme.$purple_3;
    }
    &.active {
      border-bottom-color: theme.$purple_3;
      background: none;
      box-shadow: none;
      color: theme.$purple_3;
      font-weight: 500;
    }
  }
}
</style>
