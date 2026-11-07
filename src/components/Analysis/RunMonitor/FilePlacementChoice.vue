<script setup>
// Where an input's files land in a step's input folder (inputFilePaths.js):
// two cards, each a small picture of the input folder that choice gives, of
// the input's chosen items, or of an example while there are none.
import { computed } from "vue";
import { FILE_PATHS_SELECTION, FILE_PATHS_SOURCE, placementRows } from "./inputFilePaths";

const props = defineProps({
  modelValue: { type: String, default: FILE_PATHS_SELECTION },
  // The chosen files and folders: { name, folder, path } (placementRows).
  items: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);

const ROW = 13;
const EXAMPLE = [
  { name: "electrodes.tsv", path: ["sub-01", "ieeg"] },
  { name: "run-01.edf", path: ["sub-01", "ieeg"] },
];
const choices = computed(() => {
  const items = props.items.length ? props.items : EXAMPLE;
  return [
    { value: FILE_PATHS_SELECTION, label: "As selected", hint: "Files at the top; a selected folder keeps what's in it" },
    { value: FILE_PATHS_SOURCE, label: "As in the source", hint: "Files keep the folders they're in at the source" },
  ].map((c) => ({ ...c, rows: placementRows(c.value, items) }));
});

const x = (depth) => 4 + depth * 8;
const y = (i) => 10 + i * ROW;
// A label cut to the picture's width (about 3.9 units a character).
const fit = (r) => {
  const label = r.folder ? `${r.label}/` : r.label;
  const room = Math.floor((100 - x(r.depth) - (r.more ? 0 : 11)) / 3.9);
  return label.length > room ? `${label.slice(0, room - 1)}…` : label;
};
const rowClass = (r) => [r.more ? "tree-more" : r.folder ? "tree-folder" : "tree-file", { "tree-item": r.item }];
// The elbow from a row up to its folder's row.
const elbow = (rows, i) => {
  const r = rows[i];
  let p = i - 1;
  while (p >= 0 && rows[p].depth >= r.depth) p--;
  const px = x(rows[p].depth) + 4;
  return `M${px} ${y(p) + 4} V${y(i)} H${x(r.depth) - 1}`;
};

const pick = (value) => {
  if (!props.disabled && value !== props.modelValue) emit("update:modelValue", value);
};
// Arrow keys move the choice, as in a radio group.
const onKey = (e) => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
  e.preventDefault();
  const i = choices.value.findIndex((c) => c.value === props.modelValue);
  const n = choices.value.length;
  const next = choices.value[(i + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? n - 1 : 1)) % n];
  pick(next.value);
  e.currentTarget.querySelector(`[data-value="${next.value}"]`)?.focus();
};
</script>

<template>
  <div class="file-placement" role="radiogroup" aria-label="Where the files land" @keydown="onKey">
    <button
      v-for="c in choices"
      :key="c.value"
      type="button"
      role="radio"
      class="placement-card"
      :class="{ 'is-chosen': modelValue === c.value }"
      :aria-checked="modelValue === c.value"
      :tabindex="modelValue === c.value ? 0 : -1"
      :disabled="disabled"
      :data-value="c.value"
      :title="c.hint"
      @click="pick(c.value)"
    >
      <svg class="placement-picture" viewBox="0 0 100 74" aria-hidden="true">
        <template v-for="(r, i) in c.rows.slice(1)" :key="`l${i}`">
          <path v-if="!r.more" class="tree-line" :d="elbow(c.rows, i + 1)" />
        </template>
        <g v-for="(r, i) in c.rows" :key="i" :class="rowClass(r)">
          <template v-if="!r.more">
            <path v-if="r.folder" :d="`M${x(r.depth)} ${y(i) - 3}h3l1 1h4v6h-8z`" />
            <path v-else :d="`M${x(r.depth)} ${y(i) - 4}h5l2 2v7h-7z`" />
          </template>
          <text :x="x(r.depth) + (r.more ? 0 : 11)" :y="y(i) + 3">{{ fit(r) }}</text>
        </g>
      </svg>
      <span class="placement-label">{{ c.label }}</span>
    </button>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";

.file-placement {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 6px;
}

.placement-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  aspect-ratio: 1;
  padding: 8px;
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  color: theme.$gray_5;

  &:hover:not(:disabled) {
    border-color: theme.$purple_1;
  }
  &:focus-visible {
    outline: 2px solid theme.$purple_2;
    outline-offset: 1px;
  }
  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
  &.is-chosen {
    border-color: theme.$purple_3;
    box-shadow: inset 0 0 0 1px theme.$purple_3;
    background: theme.$purple_tint;
  }
}

.placement-picture {
  flex: 1;
  min-height: 0;
  width: 100%;
  font-size: 7px;

  .tree-line {
    fill: none;
    stroke: theme.$gray_3;
    stroke-width: 0.8;
  }
  .tree-folder {
    fill: theme.$gray_4;
    text {
      fill: theme.$gray_5;
    }
  }
  .tree-file {
    fill: theme.$gray_3;
    text {
      fill: theme.$gray_4;
    }
  }
  .tree-more text {
    fill: theme.$gray_4;
    font-style: italic;
  }
}

// The chosen items are what moves between the two: they stand out on the
// chosen card.
.is-chosen .placement-picture .tree-item {
  fill: theme.$purple_2;
  text {
    fill: theme.$purple_3;
    font-weight: 600;
  }
}

.placement-label {
  font-size: 12px;
  font-weight: 500;
  color: theme.$gray_6;
}
</style>
