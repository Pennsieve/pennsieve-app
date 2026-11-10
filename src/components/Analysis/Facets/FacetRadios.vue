<script setup>
// A section's one-of choice (scope, visibility, a dataset's status) as small
// radios; an option with a color has its dot, as FacetOptions'.
defineProps({
  options: { type: Array, default: () => [] }, // [{ value, label, color? }]
  label: { type: String, default: "" }, // for screen readers
});
const model = defineModel({ type: String, required: true });
</script>

<template>
  <el-radio-group v-model="model" class="facet-radios" :aria-label="label || undefined">
    <!-- A long label (a workspace's dataset status) is cut with an ellipsis
         in the panel, whole on hover, as FacetOptions' rows -->
    <el-radio v-for="o in options" :key="o.value" :value="o.value" size="small" class="facet-row" :title="o.label">
      <span v-if="o.color" class="facet-dot" :style="{ background: o.color }" />
      <span class="facet-label">{{ o.label }}</span>
    </el-radio>
  </el-radio-group>
</template>

<style scoped lang="scss">
@use "facetRows";

.facet-radios {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
}
/* The row no wider than the panel, so its label can be cut. */
.facet-row {
  min-width: 0;
  max-width: 100%;
}
</style>
