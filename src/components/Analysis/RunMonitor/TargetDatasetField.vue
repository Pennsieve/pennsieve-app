<script setup>
/*
  Which dataset a data target writes to: the inputs' (the default, when the
  workflow has inputs) or another one the user picks. The platform refuses the run when the user can't write
  to the chosen dataset, so no filtering happens here.
*/
import { ref, computed, watch } from "vue";
import { useStore } from "vuex";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import toQueryParams from "@/utils/toQueryParams";
import { searchDatasets, datasetName } from "./dataTargets";

const props = defineProps({
  // The target's own dataset id, or "" for the inputs'.
  modelValue: { type: String, default: "" },
  // The inputs' dataset (the first input's), which "" follows.
  runDatasetId: { type: String, default: "" },
  // Without inputs there is nothing to follow: the target names its own.
  followsInputs: { type: Boolean, default: true },
  // Dataset records already loaded, for names.
  datasets: { type: Array, default: () => [] },
});
const emit = defineEmits(["update:modelValue"]);

const store = useStore();
const apiUrl = computed(() => store.state.config?.apiUrl);

const other = ref(!props.followsInputs || (!!props.modelValue && props.modelValue !== props.runDatasetId));
const results = ref([]);
const loading = ref(false);
let timer = null;

// The chosen dataset's record, kept so its name shows after the search
// results move on; the select resolves a label only from its options.
const chosen = ref(null);
const options = computed(() => {
  const c = chosen.value;
  if (c && !results.value.some((d) => d?.content?.id === c.content?.id)) return [c, ...results.value];
  return results.value;
});
const choose = (id) => {
  chosen.value = results.value.find((d) => d?.content?.id === id) || chosen.value;
  emit("update:modelValue", id);
};

const runDatasetLabel = computed(() => datasetName(props.runDatasetId, [...props.datasets, ...results.value]));

// The list stays while a search runs, so it doesn't blink; the select
// shows its loading text only when there is nothing to show yet.
const search = async (query = "") => {
  loading.value = options.value.length === 0;
  try {
    results.value = await searchDatasets(apiUrl.value, query, { getToken: useGetToken, sendXhr: useSendXhr, toQueryParams });
    if (props.modelValue && !chosen.value) {
      chosen.value = results.value.find((d) => d?.content?.id === props.modelValue) || null;
    }
  } catch (err) {
    console.error("Failed to search datasets:", err);
    results.value = [];
  } finally {
    loading.value = false;
  }
};
// The select asks with an empty query every time it opens; the list is
// already there then. Typing searches, after a pause.
let lastQuery = "";
const onSearch = (query) => {
  clearTimeout(timer);
  if (query === lastQuery) return;
  if (!query && results.value.length) {
    lastQuery = "";
    return;
  }
  timer = setTimeout(() => {
    lastQuery = query;
    search(query);
  }, 300);
};

const chooseRun = () => {
  other.value = false;
  emit("update:modelValue", "");
};
const chooseOther = () => {
  other.value = true;
  if (results.value.length === 0) search();
};

watch(() => props.modelValue, (v) => {
  if (v && v !== props.runDatasetId) other.value = true;
});
if (other.value) {
  chosen.value = props.datasets.find((d) => d?.content?.id === props.modelValue) || null;
  if (!chosen.value) search();
}
</script>

<template>
  <div class="tdf">
    <label class="tdf-label">Dataset</label>
    <div class="tdf-choice">
      <el-radio-group :model-value="other ? 'other' : 'run'" size="small">
        <el-radio-button value="run" :disabled="!followsInputs" @click="followsInputs && chooseRun()">Same as the inputs</el-radio-button>
        <el-radio-button value="other" @click="chooseOther">Another dataset</el-radio-button>
      </el-radio-group>
    </div>
    <div v-if="!other" class="tdf-run">{{ runDatasetLabel || "The first input's dataset, once its files are chosen" }}</div>
    <el-select
      v-else
      :model-value="modelValue || ''"
      filterable
      remote
      :remote-method="onSearch"
      :loading="loading"
      placeholder="Search datasets you can edit…"
      size="small"
      class="tdf-select"
      @update:model-value="choose"
    >
      <el-option
        v-for="ds in options"
        :key="ds.content?.id"
        :label="ds.content?.name"
        :value="ds.content?.id"
      />
    </el-select>
    <p class="tdf-help">You need the Editor role on the dataset this target writes to.</p>
  </div>
</template>

<style scoped lang="scss">
.tdf { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.tdf-label { font-size: 12px; font-weight: 600; color: #475569; }
.tdf-run { font-size: 13px; color: #1e293b; }
.tdf-select { width: 100%; }
.tdf-help { margin: 0; font-size: 11px; color: #64748b; }
</style>
