<script setup>
// An empty notebook's start: the session's data is in input/ but not in
// Python yet, so the card says so and offers to load it: each input's
// structured layouts (the records as tables, as a graph), downloaded first
// when they aren't yet (the cell goes in once they are), and a first step
// from the assistant. The notebook shows it while it has no code.
import { computed, reactive, watch } from "vue";
import { costLine } from "./inputsHelpers";
import { starterState } from "./startCardHelpers";

const props = defineProps({
  // [{ key, source, layout (with its entry), path }] (FileBrowser's starters).
  starters: { type: Array, default: () => [] },
  // The session's view inputs (useSessionInputs).
  inputs: { type: Object, required: true },
  kernelName: { type: String, default: "" },
  // The agent can suggest a first step.
  canSuggest: { type: Boolean, default: false },
  fmtSize: { type: Function, required: true },
});
const emit = defineEmits(["insert-snippet", "suggest", "dismiss"]);

// What each starter's data is in the session: downloaded, under way, or not.
const rows = computed(() =>
  props.starters.map((s) => ({ ...s, state: starterState(props.inputs, s.source, s.layout.files || []), label: s.layout.entry.label }))
);
const loadCode = (s) => s.layout.entry.snippets(s.path, props.kernelName).find((x) => x.id === "load")?.code || "";

// Starters downloading to be loaded: their cell goes in once all is here.
const waiting = reactive(new Set());
// A download that asks first (big, costly, or doesn't fit): { key, bytes, fits, cost, go }.
const confirm = reactive({ key: "", bytes: 0, fits: true, cost: null, go: null });

function load(row) {
  if (row.state.all) return emit("insert-snippet", loadCode(row));
  if (row.state.under) return waiting.add(row.key);
  const go = () => {
    props.inputs.requestEntries(row.source, row.state.left);
    waiting.add(row.key);
  };
  const c = props.inputs.check(row.state.leftBytes, row.state.left);
  if (c.ask) Object.assign(confirm, { key: row.key, bytes: row.state.leftBytes, fits: c.fits, cost: c.cost, go });
  else go();
}
function decide(ok, noted = false) {
  const go = confirm.go;
  Object.assign(confirm, { key: "", go: null });
  if (!ok) return;
  if (noted) props.inputs.noteCost();
  go?.();
}

watch(
  rows,
  (list) => {
    for (const row of list) {
      if (!waiting.has(row.key)) continue;
      if (row.state.all) {
        waiting.delete(row.key);
        emit("insert-snippet", loadCode(row));
      } else if (row.state.failed) waiting.delete(row.key);
    }
  },
  { deep: true }
);

function buttonLabel(row) {
  const what = row.label.charAt(0).toLowerCase() + row.label.slice(1);
  if (row.state.under || waiting.has(row.key)) return row.state.under ? `Downloading ${what}… ${row.state.percent}%` : `Loading ${what}…`;
  if (row.state.all) return `Load ${what}`;
  return `Download and load ${what} · ${props.fmtSize(row.state.leftBytes)}`;
}
</script>

<template>
  <div class="nb-start" role="region" aria-label="Start with your data">
    <div class="nb-start__head">
      <p class="nb-start__title">
        Your data is in <code>input/</code>, not loaded into Python yet.
      </p>
      <button class="nb-start__x" title="Hide" aria-label="Hide" @click="emit('dismiss')">✕</button>
    </div>
    <div class="nb-start__actions">
      <button
        v-for="row in rows"
        :key="row.key"
        class="nb-start__btn"
        :class="{ 'nb-start__btn--go': row.state.all }"
        :disabled="row.state.under || waiting.has(row.key)"
        :title="row.layout.entry.title"
        @click="load(row)"
      >
        {{ buttonLabel(row) }}
      </button>
      <button v-if="canSuggest" class="nb-start__btn" title="The assistant proposes a first cell for this data" @click="emit('suggest')">
        Suggest a first step
      </button>
    </div>
    <p v-if="confirm.key" class="nb-start__confirm">
      <template v-if="confirm.fits">
        Download {{ fmtSize(confirm.bytes) }}?
        <template v-if="inputs.freeBytes != null">Leaves about {{ fmtSize(inputs.freeBytes - confirm.bytes) }} free.</template>
        <template v-if="confirm.cost">{{ costLine(confirm.cost) }}</template>
        <button class="nb-start__btn nb-start__btn--go" @click="decide(true)">Download</button>
        <button v-if="confirm.cost" class="nb-start__btn" @click="decide(true, true)">Download, don't remind me</button>
        <button class="nb-start__btn" @click="decide(false)">Not now</button>
      </template>
      <template v-else>
        Doesn't fit: {{ fmtSize(confirm.bytes) }}, with about {{ fmtSize(inputs.freeBytes) }} free on the session's disk.
        <button class="nb-start__btn" @click="decide(false)">OK</button>
      </template>
    </p>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.nb-start {
  margin: 6px 0 6px 54px;
  padding: 10px 12px;
  border: 1px solid theme.$gray_2;
  border-left: 2px solid theme.$purple_2;
  background: theme.$white;
}
.nb-start__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.nb-start__title {
  flex: 1;
  margin: 0;
  color: theme.$gray_6;
  font-size: 13px;
}
.nb-start__x {
  border: none;
  background: none;
  color: theme.$gray_4;
  cursor: pointer;
}
.nb-start__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.nb-start__btn {
  padding: 2px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 3px;
  background: theme.$white;
  color: theme.$gray_6;
  font-size: 12px;
  cursor: pointer;
}
.nb-start__btn:disabled {
  cursor: default;
  color: theme.$gray_4;
}
.nb-start__btn--go {
  border-color: theme.$purple_2;
  color: theme.$purple_2;
}
.nb-start__confirm {
  margin: 8px 0 0;
  color: theme.$gray_6;
  font-size: 12px;
}
</style>
