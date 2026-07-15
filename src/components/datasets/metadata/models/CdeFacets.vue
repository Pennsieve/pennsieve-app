<template>
  <div v-if="hasFacets" class="cde-facets">
    <el-select
      v-if="facetValues.diseases.length"
      :model-value="modelValue.disease"
      multiple
      filterable
      clearable
      collapse-tags
      collapse-tags-tooltip
      :max-collapse-tags="2"
      size="small"
      placeholder="All diseases"
      class="cde-facet-select"
      @update:model-value="update('disease', $event)"
    >
      <el-option v-for="d in facetValues.diseases" :key="d" :label="d" :value="d" />
    </el-select>

    <el-select
      v-if="facetValues.domains.length"
      :model-value="modelValue.domain"
      multiple
      filterable
      clearable
      collapse-tags
      collapse-tags-tooltip
      :max-collapse-tags="2"
      size="small"
      placeholder="All domains"
      class="cde-facet-select"
      @update:model-value="update('domain', $event)"
    >
      <el-option v-for="d in facetValues.domains" :key="d" :label="d" :value="d" />
    </el-select>

    <el-select
      v-if="facetValues.tiers.length"
      :model-value="modelValue.tier"
      multiple
      filterable
      clearable
      collapse-tags
      collapse-tags-tooltip
      :max-collapse-tags="2"
      size="small"
      placeholder="Any tier"
      class="cde-facet-select cde-facet-tier"
      @update:model-value="update('tier', $event)"
    >
      <el-option v-for="t in facetValues.tiers" :key="t" :label="t" :value="t" />
    </el-select>
  </div>
</template>

<script setup>
// Multi-select facet bar for the CDE catalog (disease / domain / tier). Each
// facet is a searchable, multi-select dropdown so long value lists stay on one
// line instead of wrapping into rows of buttons. v-model carries
// { disease: [], domain: [], tier: [] } and `change` fires on any edit.
import { computed } from 'vue'

const props = defineProps({
  facetValues: { type: Object, default: () => ({ diseases: [], domains: [], tiers: [] }) },
  modelValue: { type: Object, default: () => ({ disease: [], domain: [], tier: [] }) },
})
const emit = defineEmits(['update:modelValue', 'change'])

const hasFacets = computed(
  () =>
    props.facetValues.diseases.length ||
    props.facetValues.domains.length ||
    props.facetValues.tiers.length
)

const update = (key, val) => {
  emit('update:modelValue', { ...props.modelValue, [key]: val })
  emit('change')
}
</script>

<style scoped lang="scss">
@use '../../../../styles/theme' as theme;

.cde-facets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
}
.cde-facet-select {
  min-width: 180px;
  max-width: 280px;
}
.cde-facet-tier {
  min-width: 150px;
}
</style>
