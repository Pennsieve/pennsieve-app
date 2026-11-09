<script setup>
// A section's options as checkboxes, each with its count (and a domain's
// coloured dot), or as a cloud of chips (many short ones, e.g. tags). Any
// number at a time (the page keeps the list, on toggle). A long section
// shows its first few and a "Show n more" link; the chosen always show.
import { computed, ref } from "vue";
import { foldedOptions } from "./facets";

const props = defineProps({
  // [{ key, label, count, color?, title? }]
  options: { type: Array, default: () => [] },
  // The chosen options' keys.
  selected: { type: Array, default: () => [] },
  // Shown before "Show n more".
  limit: { type: Number, default: 5 },
  // "list" (a checkbox a row) or "chips" (a wrapping cloud).
  variant: { type: String, default: "list" },
});
const emit = defineEmits(["toggle"]);

const open = ref(false);
const folded = computed(() => foldedOptions(props.options, props.selected, props.limit, open.value));
// Only a section that has more than its limit folds back.
const canFold = computed(() => open.value && props.options.length > props.limit);
</script>

<template>
  <div v-if="variant === 'chips'" class="facet-chips">
    <button
      v-for="o in folded.shown"
      :key="o.key"
      type="button"
      class="facet-chip"
      :class="{ 'is-chosen': selected.includes(o.key) }"
      :aria-pressed="selected.includes(o.key)"
      :title="o.title || `${o.label} (${o.count})`"
      @click="emit('toggle', o.key)"
    >
      {{ o.label }}<span class="facet-chip-count">{{ o.count }}</span>
    </button>
  </div>
  <template v-else>
    <el-checkbox
      v-for="o in folded.shown"
      :key="o.key"
      class="facet-row"
      size="small"
      :model-value="selected.includes(o.key)"
      :title="o.title || o.label"
      @change="emit('toggle', o.key)"
    >
      <span v-if="o.color" class="facet-dot" :style="{ background: o.color }" />
      <span class="facet-label">{{ o.label }}</span>
      <span class="facet-count">{{ o.count }}</span>
    </el-checkbox>
  </template>
  <button v-if="folded.hidden" type="button" class="facet-more" @click="open = true">
    Show {{ folded.hidden }} more
  </button>
  <button v-else-if="canFold" type="button" class="facet-more" @click="open = false">Show fewer</button>
</template>

<style scoped lang="scss">
@use "facetRows";
@use "../../../styles/theme";

.facet-more {
  align-self: flex-start;
  padding: 2px 0;
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

/* Short options (tags) as a wrapping cloud: a chosen one in purple. */
.facet-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 2px 0 4px;
}
.facet-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 1px 8px;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  color: theme.$gray_6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
  }
  &.is-chosen {
    border-color: theme.$purple_3;
    background: theme.$purple_3;
    color: theme.$white;

    .facet-chip-count {
      color: rgba(255, 255, 255, 0.8);
    }
  }
}
.facet-chip-count {
  font-size: 11px;
  color: theme.$gray_4;
}
</style>
