<script setup>
// Where an input's files land in a step's input folder (inputFilePaths.js):
// two cards, each a small picture of the input folder that choice gives.
import { FILE_PATHS_SELECTION, FILE_PATHS_SOURCE } from "./inputFilePaths";

const props = defineProps({
  modelValue: { type: String, default: FILE_PATHS_SELECTION },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue"]);

const ROW = 13;
// Each picture: the input folder's rows, { depth, folder, label }.
const choices = [
  {
    value: FILE_PATHS_SELECTION,
    label: "As selected",
    hint: "Files at the top; a selected folder keeps what's in it",
    rows: [
      { depth: 0, folder: true, label: "input" },
      { depth: 1, label: "electrodes.tsv" },
      { depth: 1, label: "run-01.edf" },
    ],
  },
  {
    value: FILE_PATHS_SOURCE,
    label: "As in the source",
    hint: "Files keep the folders they're in at the source",
    rows: [
      { depth: 0, folder: true, label: "input" },
      { depth: 1, folder: true, label: "sub-01" },
      { depth: 2, folder: true, label: "ieeg" },
      { depth: 3, label: "electrodes.tsv" },
      { depth: 3, label: "run-01.edf" },
    ],
  },
];

const x = (depth) => 4 + depth * 8;
const y = (i) => 10 + i * ROW;
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
  const i = choices.findIndex((c) => c.value === props.modelValue);
  const next = choices[(i + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? choices.length - 1 : 1)) % choices.length];
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
        <path v-for="(r, i) in c.rows.slice(1)" :key="`l${i}`" class="tree-line" :d="elbow(c.rows, i + 1)" />
        <g v-for="(r, i) in c.rows" :key="i" :class="r.folder ? 'tree-folder' : 'tree-file'">
          <path
            v-if="r.folder"
            :d="`M${x(r.depth)} ${y(i) - 3}h3l1 1h4v6h-8z`"
          />
          <path v-else :d="`M${x(r.depth)} ${y(i) - 4}h5l2 2v7h-7z`" />
          <text :x="x(r.depth) + 11" :y="y(i) + 3">{{ r.folder ? `${r.label}/` : r.label }}</text>
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
}

// The files are what moves between the two: they stand out on the chosen card.
.is-chosen .placement-picture .tree-file {
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
