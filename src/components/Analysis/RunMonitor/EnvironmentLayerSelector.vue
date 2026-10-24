<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useComputeResourcesStore } from "@/stores/computeResourcesStore";

const props = defineProps({
  modelValue: { type: String, default: "" },
  computeNodeId: { type: String, default: "" },
  // The notebook kernel: "jupyter" -> python-env layers, "r" -> r-env layers.
  sessionType: { type: String, default: "jupyter" },
  // Offer "Create one…" (the page has a builder for this language).
  canCreate: { type: Boolean, default: false },
  // An environment being built for this picker: named in the hint until it's ready.
  pendingName: { type: String, default: "" },
});

// create: the user asked for a new environment on this node.
const emit = defineEmits(["update:modelValue", "create"]);

const computeResourcesStore = useComputeResourcesStore();

// Match the env layer type to the kernel so a python kernel never offers an
// R environment (and vice versa).
const envType = computed(() => (props.sessionType === "r" ? "r-env" : "python-env"));

const layerData = computed(() =>
  props.computeNodeId
    ? computeResourcesStore.getNodeLayers(props.computeNodeId)
    : { layers: [] }
);

// Only READY layers can be mounted, and only those whose type matches the kernel.
const envLayers = computed(() =>
  (layerData.value.layers || []).filter(
    (l) => l.status === "READY" && l.layerType === envType.value
  )
);

const isLoading = computed(() =>
  props.computeNodeId
    ? computeResourcesStore.isNodeLayersLoading(props.computeNodeId)
    : false
);

function fetchLayers() {
  if (props.computeNodeId) {
    computeResourcesStore.fetchNodeLayers(props.computeNodeId);
  }
}

onMounted(fetchLayers);
watch(() => props.computeNodeId, fetchLayers);

function formatSize(bytes) {
  if (!bytes) return "";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toFixed(0)} MB`;
}

function layerMeta(layer) {
  const parts = [];
  if (layer.pythonVersion) parts.push(`py${layer.pythonVersion}`);
  const size = formatSize(layer.sizeBytes);
  if (size) parts.push(size);
  return parts.join(" · ");
}

function onChange(val) {
  emit("update:modelValue", val || "");
}

// Search by name or by a package in it ("mne" finds the environment with mne).
const query = ref("");
const shownLayers = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return envLayers.value;
  return envLayers.value.filter(
    (l) =>
      l.layerName.toLowerCase().includes(q) ||
      (l.packages || []).some((p) => p.toLowerCase().includes(q))
  );
});
// The packages a search matched, else the first few: shown under each option.
function packagePreview(layer) {
  const pkgs = layer.packages || [];
  const q = query.value.trim().toLowerCase();
  const picked = q ? pkgs.filter((p) => p.toLowerCase().includes(q)) : pkgs;
  const shown = picked.slice(0, 4).join(", ");
  return picked.length > 4 ? `${shown}, +${picked.length - 4} more` : shown;
}
</script>

<template>
  <div class="env-layer-selector">
    <el-select
      :model-value="modelValue"
      clearable
      size="default"
      style="width: 100%"
      :placeholder="
        envType === 'r-env'
          ? 'No environment (base R image)'
          : 'No environment (base Python image)'
      "
      :loading="isLoading"
      filterable
      :filter-method="(q) => (query = q || '')"
      popper-class="env-layer-popper"
      @change="onChange"
      @visible-change="(open) => open || (query = '')"
    >
      <el-option
        v-for="layer in shownLayers"
        :key="layer.layerName"
        :label="layer.layerName"
        :value="layer.layerName"
        class="env-layer-option"
      >
        <div class="env-layer-line">
          <span>{{ layer.layerName }}</span>
          <span v-if="layerMeta(layer)" class="env-layer-meta"> — {{ layerMeta(layer) }}</span>
        </div>
        <div v-if="packagePreview(layer)" class="env-layer-pkgs">{{ packagePreview(layer) }}</div>
      </el-option>
      <el-option
        v-if="query && envLayers.length && !shownLayers.length"
        disabled
        :label="`No environment has “${query}”`"
        value="__nomatch__"
      />
      <el-option
        v-if="!computeNodeId"
        disabled
        label="Select a compute node first"
        value="__none__"
      />
      <el-option
        v-else-if="envLayers.length === 0 && !isLoading"
        disabled
        :label="
          envType === 'r-env'
            ? 'No ready r-env layers on this node'
            : 'No ready python-env layers on this node'
        "
        value="__none__"
      />
    </el-select>
    <span v-if="pendingName" class="env-layer-hint">
      Building “{{ pendingName }}”. It's selected here as soon as it's ready;
      you can also start without it.
    </span>
    <span v-else class="env-layer-hint">
      Optional. Its packages are importable in the notebook. Search by name or by a package.
      <button v-if="canCreate && computeNodeId" type="button" class="env-layer-create" @click="emit('create')">
        Create one…
      </button>
    </span>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.env-layer-selector {
  width: 100%;
}

.env-layer-meta {
  font-size: 12px;
  color: theme.$gray_4;
}

.env-layer-create {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: theme.$link-color;
  cursor: pointer;

  &:hover {
    color: theme.$link-color-hover;
  }
}

.env-layer-hint {
  font-size: 11px;
  color: theme.$gray_4;
  margin-top: 4px;
  display: block;
}
</style>

<style lang="scss">
@use "../../../styles/_theme.scss";

// Options are two lines (name, then packages); the dropdown is teleported, so
// this isn't scoped.
.env-layer-popper .env-layer-option {
  height: auto;
  line-height: 1.4;
  padding-top: 6px;
  padding-bottom: 6px;
}
.env-layer-popper .env-layer-pkgs {
  font-size: 11px;
  color: theme.$gray_4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
