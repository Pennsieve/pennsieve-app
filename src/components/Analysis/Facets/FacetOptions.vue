<script setup>
// A section's options as checkboxes, each with its count (and a domain's
// coloured dot). One at a time, as the galleries' filters are: ticking one
// unticks the other, ticking it again clears it (the page does, on toggle).
defineProps({
  // [{ key, label, count, color?, title? }]
  options: { type: Array, default: () => [] },
  // The chosen option's key (anything else: none).
  selected: { type: String, default: null },
});
const emit = defineEmits(["toggle"]);
</script>

<template>
  <el-checkbox
    v-for="o in options"
    :key="o.key"
    class="facet-row"
    size="small"
    :model-value="selected === o.key"
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
