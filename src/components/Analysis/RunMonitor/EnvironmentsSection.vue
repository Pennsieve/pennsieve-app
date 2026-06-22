<script setup>
import { ref, computed, watch } from "vue";
import { useStore } from "vuex";
import { useComputeResourcesStore } from "@/stores/computeResourcesStore";
import LayerTypeIcon from "../ComputeNodes/LayerTypeIcon.vue";
import { interactiveCapable } from "./notebookHelpers";

const store = useStore();
const cr = useComputeResourcesStore();

// Environments (python-env / r-env layers) are per compute node, so the section
// is scoped to one node at a time.
const computeNodes = computed(() =>
  (store.getters["analysisModule/computeNodes"] || []).filter(interactiveCapable)
);
const selectedNodeId = ref("");
const expanded = ref(null);

watch(
  computeNodes,
  (nodes) => {
    if (!selectedNodeId.value && nodes.length) selectedNodeId.value = nodes[0].uuid;
  },
  { immediate: true }
);
watch(
  selectedNodeId,
  (id) => {
    if (id) cr.fetchNodeLayers(id);
  },
  { immediate: true }
);

const layerData = computed(() =>
  selectedNodeId.value ? cr.getNodeLayers(selectedNodeId.value) : { layers: [] }
);
const isLoading = computed(() =>
  selectedNodeId.value ? cr.isNodeLayersLoading(selectedNodeId.value) : false
);
const environments = computed(() =>
  (layerData.value.layers || []).filter(
    (l) => l.layerType === "python-env" || l.layerType === "r-env"
  )
);

function toggle(name) {
  expanded.value = expanded.value === name ? null : name;
}
function langLabel(t) {
  return t === "r-env" ? "R" : "Python";
}
function pkgCount(env) {
  return (env.packages && env.packages.length) || env.packageCount || 0;
}
function formatSize(b) {
  if (!b) return "—";
  const gb = b / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(b / 1024 ** 2).toFixed(0)} MB`;
}
</script>

<template>
  <div class="dashboard-section">
    <div class="env-header">
      <h3 class="dashboard-section-title">Environments</h3>
      <el-select
        v-if="computeNodes.length > 1"
        v-model="selectedNodeId"
        size="small"
        style="width: 240px"
      >
        <el-option
          v-for="n in computeNodes"
          :key="n.uuid"
          :label="n.name"
          :value="n.uuid"
        />
      </el-select>
    </div>
    <p class="env-desc">
      Reusable Python &amp; R package environments on this compute node — attach one
      when launching a notebook.
    </p>

    <div v-if="isLoading" class="env-empty">Loading…</div>
    <div v-else-if="environments.length === 0" class="env-empty">
      No Python or R environments on this node yet.
    </div>
    <div v-else class="env-list">
      <div v-for="env in environments" :key="env.layerName" class="env-card">
        <div class="env-row" @click="toggle(env.layerName)">
          <span class="env-caret" :class="{ open: expanded === env.layerName }">▸</span>
          <LayerTypeIcon :layer-type="env.layerType" :size="22" />
          <div class="env-main">
            <div class="env-name">{{ env.layerName }}</div>
            <div class="env-meta">
              {{ langLabel(env.layerType) }}<span v-if="env.pythonVersion"> {{ env.pythonVersion }}</span>
              · {{ pkgCount(env) }} packages · {{ formatSize(env.sizeBytes) }}
            </div>
          </div>
          <span class="env-status" :class="env.status === 'READY' ? 'ok' : 'building'">
            {{ env.status === "READY" ? "Ready" : "Building…" }}
          </span>
        </div>
        <div
          v-if="expanded === env.layerName && env.packages && env.packages.length"
          class="env-packages"
        >
          <code v-for="p in env.packages" :key="p" class="pkg">{{ p }}</code>
        </div>
        <div v-else-if="expanded === env.layerName" class="env-packages-empty">
          No package list recorded for this environment.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.env-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.env-desc {
  font-size: 13px;
  color: theme.$gray_4;
  margin: 4px 0 12px;
}
.env-empty {
  font-size: 13px;
  color: theme.$gray_4;
  padding: 12px 0;
}
.env-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.env-card {
  border: 0.5px solid theme.$gray_2;
  border-radius: 8px;
  overflow: hidden;
}
.env-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;

  &:hover {
    background: theme.$gray_1;
  }
}
.env-caret {
  color: theme.$gray_4;
  font-size: 10px;
  width: 10px;
  transition: transform 0.12s ease;

  &.open {
    transform: rotate(90deg);
  }
}
.env-main {
  flex: 1;
  min-width: 0;
}
.env-name {
  font-weight: 500;
  color: theme.$gray_6;
}
.env-meta {
  font-size: 12px;
  color: theme.$gray_4;
}
.env-status {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;

  &.ok {
    background: #eaf3de;
    color: #3b6d11;
  }
  &.building {
    background: #faeeda;
    color: #854f0b;
  }
}
.env-packages {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 12px 12px 32px;
  max-height: 220px;
  overflow-y: auto;
}
.pkg {
  font-family: "Courier New", monospace;
  font-size: 12px;
  color: theme.$gray_6;
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  padding: 2px 6px;
}
.env-packages-empty {
  font-size: 12px;
  color: theme.$gray_4;
  padding: 0 12px 12px 32px;
}
</style>
