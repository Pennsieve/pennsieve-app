<script setup>
// "Include metadata records": a published dataset version's records, by
// model, taken with its files. v-model is the chosen model names (none:
// no records); available is what the version publishes. With records on,
// every model is taken unless unticked; the last one can't be.
const chosen = defineModel({ type: Array, default: () => [] });
const props = defineProps({
  available: { type: Array, default: () => [] },
});

const include = (on) => (chosen.value = on ? [...props.available] : []);
const toggle = (name, on) => (chosen.value = on ? [...chosen.value, name] : chosen.value.filter((m) => m !== name));
</script>

<template>
  <div v-if="available.length" class="mrc">
    <el-checkbox :model-value="chosen.length > 0" @update:model-value="include">Include metadata records</el-checkbox>
    <span class="mrc__hint">The dataset's records and their links to its files, as files the run starts with.</span>
    <div v-if="chosen.length && available.length > 1" class="mrc__models">
      <el-checkbox
        v-for="m in available"
        :key="m"
        :model-value="chosen.includes(m)"
        :disabled="chosen.length === 1 && chosen.includes(m)"
        @update:model-value="(on) => toggle(m, on)"
        >{{ m }}</el-checkbox
      >
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.mrc {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mrc__hint {
  font-size: 12px;
  color: theme.$gray_5;
}
.mrc__models {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  padding-left: 22px;
}
</style>
