<script setup>
// A filter panel's section: a small heading (as the builder palette's), a
// Clear link while something is chosen, then its options (FacetOptions,
// FacetRadios, FacetCheck or a small select).
import { useId } from "vue";

defineProps({
  title: { type: String, default: "" },
  // Something is chosen here: show Clear.
  clearable: { type: Boolean, default: false },
});
const emit = defineEmits(["clear"]);
const id = useId();
</script>

<template>
  <section class="facet" :aria-labelledby="title ? id : undefined">
    <div v-if="title" class="facet-head">
      <div :id="id" class="panel-heading facet-heading">{{ title }}</div>
      <button v-if="clearable" type="button" class="facet-clear" @click="emit('clear')">Clear</button>
    </div>
    <slot />
  </section>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";
@use "../WorkflowBuilder/sidePanel";

.facet {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.facet-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.facet-heading {
  padding-left: 0;
}
.facet-clear {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  color: theme.$link-color;
  cursor: pointer;

  &:hover {
    color: theme.$link-color-hover;
  }
}
/* A select in a section: compact, the panel's width. */
:slotted(.el-select) {
  width: 100%;
  margin-top: 2px;
}
</style>
