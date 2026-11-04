<script setup>
// An on/off option in a section (Include notebooks, Show archived).
defineProps({
  label: { type: String, required: true },
});
const model = defineModel({ type: Boolean, default: false });
</script>

<template>
  <el-checkbox v-model="model" size="small" class="facet-row">
    <span class="facet-label">{{ label }}</span>
  </el-checkbox>
</template>

<style scoped lang="scss">
@use "facetRows";
</style>
