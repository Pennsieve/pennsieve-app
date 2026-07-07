<script setup>
import { computed, onMounted, watch } from "vue";
import { useComputeResourcesStore } from "@/stores/computeResourcesStore";

const props = defineProps({
  modelValue: { type: String, default: "" },
  computeNodeId: { type: String, default: "" },
  // The notebook kernel: "jupyter" -> python-env layers, "r" -> r-env layers.
  sessionType: { type: String, default: "jupyter" },
});

const emit = defineEmits(["update:modelValue"]);

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
      @change="onChange"
    >
      <el-option
        v-for="layer in envLayers"
        :key="layer.layerName"
        :label="layer.layerName"
        :value="layer.layerName"
      >
        <span>{{ layer.layerName }}</span>
        <span v-if="layerMeta(layer)" class="env-layer-meta"> — {{ layerMeta(layer) }}</span>
      </el-option>
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
    <span class="env-layer-hint">
      Optional. Mounts a prebuilt {{ envType === 'r-env' ? 'R' : 'Python' }}
      environment layer so its packages are importable in the notebook.
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

.env-layer-hint {
  font-size: 11px;
  color: theme.$gray_4;
  margin-top: 4px;
  display: block;
}
</style>
