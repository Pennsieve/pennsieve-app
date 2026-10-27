<script setup>
// A field's hint on demand: a small ⓘ beside its label that shows the text on
// hover or keyboard focus, instead of a gray line under every field.
defineProps({
  text: { type: String, required: true },
});
</script>

<template>
  <el-tooltip :content="text" placement="top" :show-after="150">
    <button type="button" class="field-hint-icon" :aria-label="text">i</button>
  </el-tooltip>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.field-hint-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-left: 4px;
  padding: 0;
  border: 1px solid theme.$gray_3;
  border-radius: 50%;
  background: none;
  font: inherit;
  font-size: 9px;
  font-style: italic;
  font-weight: 600;
  line-height: 1;
  color: theme.$gray_4;
  vertical-align: 1px;
  cursor: help;

  &:hover,
  &:focus-visible {
    border-color: theme.$purple_3;
    color: theme.$purple_3;
    outline: none;
  }
}
</style>
