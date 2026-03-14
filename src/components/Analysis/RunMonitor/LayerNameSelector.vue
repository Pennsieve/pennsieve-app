<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { ElMessage } from "element-plus";
import { useComputeResourcesStore } from "@/stores/computeResourcesStore";

const props = defineProps({
  modelValue: { type: String, default: "" },
  computeNodeId: { type: String, default: "" },
  placeholder: { type: String, default: "Select or create a layer" },
});

const emit = defineEmits(["update:modelValue"]);

const computeResourcesStore = useComputeResourcesStore();

const layerData = computed(() =>
  props.computeNodeId ? computeResourcesStore.getNodeLayers(props.computeNodeId) : { layers: [] }
);
const emptyLayers = computed(() =>
  (layerData.value.layers || []).filter((l) => l.status === "EMPTY")
);
const isLoading = computed(() =>
  props.computeNodeId ? computeResourcesStore.isNodeLayersLoading(props.computeNodeId) : false
);

// Create layer inline
const isCreating = ref(false);
const newLayerName = ref("");
const newLayerDescription = ref("");
const isSaving = ref(false);
const LAYER_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

async function fetchLayers() {
  if (props.computeNodeId) {
    await computeResourcesStore.fetchNodeLayers(props.computeNodeId);
  }
}

onMounted(fetchLayers);
watch(() => props.computeNodeId, fetchLayers);

function onSelect(val) {
  if (val === "__create__") {
    isCreating.value = true;
    emit("update:modelValue", "");
  } else {
    emit("update:modelValue", val);
  }
}

function cancelCreate() {
  isCreating.value = false;
  newLayerName.value = "";
  newLayerDescription.value = "";
}

async function createAndSelect() {
  if (!newLayerName.value || !LAYER_NAME_PATTERN.test(newLayerName.value)) {
    ElMessage.error("Layer name must be lowercase with dashes (e.g., hg38-reference)");
    return;
  }
  isSaving.value = true;
  try {
    await computeResourcesStore.createNodeLayer(props.computeNodeId, {
      layerName: newLayerName.value,
      description: newLayerDescription.value || undefined,
    });
    emit("update:modelValue", newLayerName.value);
    ElMessage.success(`Layer "${newLayerName.value}" created`);
    isCreating.value = false;
    newLayerName.value = "";
    newLayerDescription.value = "";
  } catch (err) {
    ElMessage.error(err.message || "Failed to create layer");
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div class="layer-selector">
    <!-- Create inline form -->
    <template v-if="isCreating">
      <div class="create-inline">
        <input
          v-model="newLayerName"
          placeholder="layer-name"
          class="layer-input"
          :class="{ invalid: newLayerName && !LAYER_NAME_PATTERN.test(newLayerName) }"
        />
        <input
          v-model="newLayerDescription"
          placeholder="Description (optional)"
          class="layer-input grow"
        />
        <button class="layer-btn save" :disabled="isSaving" @click="createAndSelect">
          {{ isSaving ? '...' : 'Create' }}
        </button>
        <button class="layer-btn cancel" @click="cancelCreate">Cancel</button>
      </div>
      <span class="layer-hint">Lowercase letters, numbers, and dashes</span>
    </template>

    <!-- Select existing -->
    <template v-else>
      <el-select
        :model-value="modelValue"
        @change="onSelect"
        size="small"
        style="width: 100%"
        :placeholder="placeholder"
        :loading="isLoading"
      >
        <el-option
          v-for="layer in emptyLayers"
          :key="layer.layerName"
          :label="layer.layerName"
          :value="layer.layerName"
        >
          <span>{{ layer.layerName }}</span>
          <span v-if="layer.description" class="layer-option-desc"> — {{ layer.description }}</span>
        </el-option>
        <el-option
          v-if="!computeNodeId"
          disabled
          label="Select a compute node first"
          value=""
        />
        <el-option
          v-else-if="emptyLayers.length === 0 && !isLoading"
          disabled
          label="No empty layers available"
          value=""
        />
        <el-option
          key="__create__"
          label="+ Create new layer"
          value="__create__"
          class="create-option"
        />
      </el-select>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.layer-selector {
  width: 100%;
}

.create-inline {
  display: flex;
  gap: 6px;
  align-items: center;
}

.layer-input {
  padding: 4px 8px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  font-size: 12px;
  color: theme.$gray_6;
  min-width: 120px;

  &.grow {
    flex: 1;
  }

  &:focus {
    outline: none;
    border-color: theme.$purple_1;
  }

  &.invalid {
    border-color: theme.$red_1;
  }
}

.layer-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;

  &.save {
    background: theme.$purple_1;
    color: white;

    &:hover { background: theme.$purple_2; }
    &:disabled { background: theme.$gray_4; cursor: not-allowed; }
  }

  &.cancel {
    background: theme.$gray_3;
    color: theme.$gray_6;

    &:hover { background: theme.$gray_4; }
  }
}

.layer-hint {
  font-size: 11px;
  color: theme.$gray_4;
  margin-top: 2px;
  display: block;
}

.layer-option-desc {
  font-size: 12px;
  color: theme.$gray_4;
}

:deep(.create-option) {
  color: theme.$purple_1 !important;
  font-weight: 500;
}
</style>
