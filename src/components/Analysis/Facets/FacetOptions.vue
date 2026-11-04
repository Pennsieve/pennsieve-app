<script setup>
// A section's options as checkboxes, each with its count (and a domain's
// coloured dot). Any number at a time (the page keeps the list, on toggle).
defineProps({
  // [{ key, label, count, color?, title? }]
  options: { type: Array, default: () => [] },
  // The chosen options' keys.
  selected: { type: Array, default: () => [] },
});
const emit = defineEmits(["toggle"]);
</script>

<template>
  <el-checkbox
    v-for="o in options"
    :key="o.key"
    class="facet-row"
    size="small"
    :model-value="selected.includes(o.key)"
    :title="o.title"
    @change="emit('toggle', o.key)"
  >
    <span v-if="o.color" class="facet-dot" :style="{ background: o.color }" />
    <span class="facet-label">{{ o.label }}</span>
    <span class="facet-count">{{ o.count }}</span>
  </el-checkbox>
</template>

<style scoped lang="scss">
@use "facetRows";
</style>
