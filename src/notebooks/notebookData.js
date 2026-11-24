// The lists the notebook pages share (the overview, the new notebook dialog,
// a session): compute nodes, target types and GPU tiers, read through the
// backend and kept for the scope they were read for. Another scope (the user
// switched workspace) starts empty, so a list is never another workspace's.

import { ref } from "vue";
import { notebookBackend } from "./host";

export const computeNodes = ref([]);
export const targetTypes = ref([]);
export const gpuTiers = ref([]);

let scopeKey = null;
const loaded = { nodes: false, targetTypes: false, gpuTiers: false };

function forScope() {
  const s = notebookBackend().scope?.() || {};
  const key = `${s.kind}:${s.organizationId || s.userId || ""}`;
  if (key !== scopeKey) {
    scopeKey = key;
    computeNodes.value = [];
    targetTypes.value = [];
    gpuTiers.value = [];
    Object.keys(loaded).forEach((k) => (loaded[k] = false));
  }
  return key;
}

// Each reads once per scope, or again with force (a node's status changes).
export async function loadComputeNodes({ force = false } = {}) {
  const key = forScope();
  if (loaded.nodes && !force) return computeNodes.value;
  try {
    const nodes = await notebookBackend().listComputeNodes();
    if (key === scopeKey) {
      computeNodes.value = nodes;
      loaded.nodes = true;
    }
  } catch (err) {
    if (key === scopeKey) computeNodes.value = [];
    throw err;
  }
  return computeNodes.value;
}

export async function loadTargetTypes() {
  const key = forScope();
  if (loaded.targetTypes) return targetTypes.value;
  const types = await notebookBackend().listTargetTypes();
  if (key === scopeKey) {
    targetTypes.value = types;
    loaded.targetTypes = true;
  }
  return targetTypes.value;
}

export async function loadGpuTiers() {
  const key = forScope();
  if (loaded.gpuTiers) return gpuTiers.value;
  const tiers = await notebookBackend().listGpuTiers();
  if (key === scopeKey) {
    gpuTiers.value = tiers || [];
    loaded.gpuTiers = true;
  }
  return gpuTiers.value;
}
