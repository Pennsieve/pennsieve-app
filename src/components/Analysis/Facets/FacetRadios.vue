<script setup>
// A section's one-of choice (scope, visibility) as small radios.
defineProps({
  options: { type: Array, default: () => [] }, // [{ value, label }]
  label: { type: String, default: "" }, // for screen readers
});
const model = defineModel({ type: String, required: true });
</script>

<template>
  <el-radio-group v-model="model" class="facet-radios" :aria-label="label || undefined">
    <el-radio v-for="o in options" :key="o.value" :value="o.value" size="small" class="facet-row">{{ o.label }}</el-radio>
  </el-radio-group>
</template>

<style scoped lang="scss">
@use "facetRows";

.facet-radios {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
</style>
