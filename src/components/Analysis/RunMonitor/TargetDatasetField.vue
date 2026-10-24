<script setup>
/*
  Which dataset a data target writes to: the run's (the default) or another
  one the user picks. The platform refuses the run when the user can't write
  to the chosen dataset, so no filtering happens here.
*/
import { ref, computed, watch } from "vue";
import { useStore } from "vuex";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import toQueryParams from "@/utils/toQueryParams";
import { searchDatasets, datasetName } from "./dataTargets";

const props = defineProps({
  // The target's own dataset id, or "" for the run's.
  modelValue: { type: String, default: "" },
  runDatasetId: { type: String, default: "" },
  // Dataset records already loaded, for names.
  datasets: { type: Array, default: () => [] },
});
const emit = defineEmits(["update:modelValue"]);

const store = useStore();
const apiUrl = computed(() => store.state.config?.apiUrl);

const other = ref(!!props.modelValue && props.modelValue !== props.runDatasetId);
const options = ref([]);
const loading = ref(false);
let timer = null;

const runDatasetLabel = computed(() => datasetName(props.runDatasetId, [...props.datasets, ...options.value]));

// The list stays while a search runs, so it doesn't blink; the select
// shows its loading text only when there is nothing to show yet.
const search = async (query = "") => {
  loading.value = options.value.length === 0;
  try {
    options.value = await searchDatasets(apiUrl.value, query, { getToken: useGetToken, sendXhr: useSendXhr, toQueryParams });
  } catch (err) {
    console.error("Failed to search datasets:", err);
    options.value = [];
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
  if (!query && options.value.length) {
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
  if (options.value.length === 0) search();
};

watch(() => props.modelValue, (v) => {
  if (v && v !== props.runDatasetId) other.value = true;
});
</script>

<template>
  <div class="tdf">
    <label class="tdf-label">Dataset</label>
    <div class="tdf-choice">
      <el-radio-group :model-value="other ? 'other' : 'run'" size="small">
        <el-radio-button value="run" @click="chooseRun">The run's dataset</el-radio-button>
        <el-radio-button value="other" @click="chooseOther">Another dataset</el-radio-button>
      </el-radio-group>
    </div>
    <div v-if="!other" class="tdf-run">{{ runDatasetLabel || "Chosen when the run starts" }}</div>
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
      @update:model-value="(v) => emit('update:modelValue', v)"
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
