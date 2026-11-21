<script setup>
// "Use its knowledge graph": a workspace dataset's records as a graph in KGX
// tables, for an input that takes one (app.yml conformsTo: kgx). v-model is
// whether it's taken.
const chosen = defineModel({ type: Boolean, default: false });
defineProps({
  // The models' records it's made of, when the input takes those too.
  withRecords: { type: Boolean, default: false },
});
</script>

<template>
  <div class="kgc">
    <el-checkbox v-model="chosen" class="kgc__include">Use its knowledge graph</el-checkbox>
    <p class="kgc__hint">
      Its metadata records as a graph, as they are when the run starts<template v-if="withRecords">, made of the records chosen above</template>:
      records are nodes, their links and coded values are edges. The input's folder gets
      <code>nodes.tsv.gz</code>, <code>edges.tsv.gz</code>, <code>nodes.parquet</code>, <code>edges.parquet</code>,
      <code>graph.json</code> and <code>graph_stats.yaml</code>
      (<a href="https://schemas.pennsieve.io/structures/kgx/v1.0" target="_blank" rel="noopener">KGX tables</a>).
    </p>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.kgc {
  border-top: 1px solid theme.$gray_2;
  padding-top: 10px;
}
.kgc__include :deep(.el-checkbox__label) {
  font-size: 14px;
  font-weight: 500;
  color: theme.$gray_6;
}
.kgc__hint {
  margin: 0 0 6px 24px;
  font-size: 12px;
  line-height: 1.4;
  color: theme.$gray_5;
}
.kgc__hint code {
  font-size: 11px;
}
</style>
