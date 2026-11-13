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
    <el-checkbox :model-value="chosen.length > 0" class="mrc__include" @update:model-value="include">Include metadata records</el-checkbox>
    <p class="mrc__hint">
      Its records and the links between them and its files, downloaded with the data before it starts.
      <template v-if="chosen.length && available.length > 1"> {{ chosen.length }} of {{ available.length }} models.</template>
    </p>
    <div v-if="chosen.length && available.length > 1" class="mrc__models">
      <el-checkbox
        v-for="m in available"
        :key="m"
        :model-value="chosen.includes(m)"
        :disabled="chosen.length === 1 && chosen.includes(m)"
        class="mrc__model"
        @update:model-value="(on) => toggle(m, on)"
        >{{ m }}</el-checkbox
      >
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.mrc {
  border-top: 1px solid theme.$gray_2;
  padding-top: 10px;
}
.mrc__include :deep(.el-checkbox__label) {
  font-size: 14px;
  font-weight: 500;
  color: theme.$gray_6;
}
.mrc__hint {
  margin: 0 0 6px 24px;
  font-size: 12px;
  line-height: 1.4;
  color: theme.$gray_5;
}
.mrc__models {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0 12px;
  margin-left: 24px;
}
.mrc__model {
  height: 26px;
}
.mrc__model :deep(.el-checkbox__label) {
  font-size: 13px;
  font-weight: 400;
  color: theme.$gray_6;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
</style>
