<script setup>
import { computed, ref, reactive, onMounted, nextTick } from "vue";

import { useStore } from "vuex";
import { useRouter } from "vue-router";

// Vue Flow Imports
import { useVueFlow, VueFlow, Handle, Position } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import dagre from "@dagrejs/dagre";
import EventBus from "../../../utils/event-bus";
import IconFile from "../../icons/IconFile.vue";
import IconCollection from "../../icons/IconCollection.vue";
import IconAnalysis from "../../icons/IconAnalysis.vue";
import IconInfoSmall from "../../icons/IconInfoSmall.vue";
import IconPencil from "../../icons/IconPencil.vue";
import {
  FARGATE_CPU_OPTIONS,
  getMemoryOptionsForCpu,
  LAMBDA_MEMORY_OPTIONS,
  getCpuForMemory,
  formatResourceLabel,
} from "../RunMonitor/runHelpers";
import BfButton from "../../shared/bf-button/BfButton.vue";
import MetricsDashboard from "../Metrics/MetricsDashboard.vue";


const {
  onNodeClick,
  onPaneClick,
  onConnect,
  screenToFlowCoordinate,
  fitView,
} = useVueFlow();

const props = defineProps({
  uuid: {
    type: String,
    default: "",
  },
});

const router = useRouter();

/*
Local State
*/
const isLoading = ref(false);
const nodes = ref([]);
const edges = ref([]);
const workflowName = ref("");
const workflowDescription = ref("");
const draggedApp = ref(null);
const draggedType = ref(null); // 'application', 'data-source', or 'data-target'

// Mode & workflow list state
const mode = ref("browse"); // 'browse' | 'create'
const selectedWorkflow = ref(null);
const accordionActiveNames = ref(["workflows"]);

// Information panel state
const isEditingDetails = ref(false);
const editName = ref("");
const editDescription = ref("");
const isSavingDetails = ref(false);
const selectedNode = ref(null); // currently selected node on canvas
const editingTargetNodes = reactive(new Set()); // track which data-target nodes are in edit mode
const sidebarRef = ref(null);

// Resolve the original processor definition for the selected node
const selectedNodeProcessor = computed(() => {
  if (!selectedNode.value || !selectedWorkflow.value) return null;
  const wfNodes = selectedWorkflow.value.dag || [];
  return wfNodes.find((p) => p.id === selectedNode.value.id) || null;
});

// Resolve dependency labels for the selected node
const selectedNodeDependencies = computed(() => {
  const proc = selectedNodeProcessor.value;
  if (!proc || !proc.dependsOn || proc.dependsOn.length === 0) return [];
  const wfNodes = selectedWorkflow.value?.dag || [];
  return proc.dependsOn.map((depId) => {
    const depNode = nodes.value.find((n) => n.id === depId);
    const depProc = wfNodes.find((p) => p.id === depId);
    return {
      id: depId,
      label: depNode?.data?.label || depProc?.sourceUrl || depId,
    };
  });
});

const filterOptions = [
  { label: "Active", value: "active" },
  { label: "Archived", value: "inactive" },
  { label: "All", value: "all" },
];

/*
Global State
*/
const store = useStore();
const availableApplications = computed(
  () => store.getters["analysisModule/applications"] || []
);
const targetTypes = computed(
  () => store.getters["analysisModule/targetTypes"] || []
);
const profile = computed(() => store.state.profile);
const orgMembers = computed(() => store.state.orgMembers || []);

const getUserName = (userId) => {
  if (!userId) return "Unknown";
  if (profile.value && (profile.value.id === userId || profile.value.intId === userId)) {
    return `${profile.value.firstName} ${profile.value.lastName}`.trim() || "You";
  }
  const member = orgMembers.value.find((m) => m.id === userId || m.intId === userId);
  if (member) {
    return `${member.firstName} ${member.lastName}`.trim() || "Unknown User";
  }
  return String(userId).includes(":") ? String(userId).split(":").pop() : String(userId);
};

const getComputeTypesForTarget = (targetType) => {
  if (!targetType) return [];
  const tt = targetTypes.value.find((t) => t.targetType === targetType);
  return tt?.runtimeConfig?.computeTypes || [];
};

const onTargetTypeChange = (data) => {
  const types = getComputeTypesForTarget(data.targetType);
  data.computeType = types.length ? types[0] : null;
};

const toggleTargetEdit = (nodeId) => {
  if (editingTargetNodes.has(nodeId)) {
    editingTargetNodes.delete(nodeId);
  } else {
    editingTargetNodes.add(nodeId);
  }
};

/*
Filtered Workflow List
*/

/*
Mode Management
*/
const isReadOnly = computed(() => mode.value === "browse");

const enterCreateMode = () => {
  mode.value = "create";
  selectedWorkflow.value = null;
  selectedNode.value = null;
  isEditingDetails.value = false;
  clearWorkflow();
  accordionActiveNames.value = ["data-and-apps"];
};

const cancelCreate = () => {
  mode.value = "browse";
  selectedWorkflow.value = null;
  selectedNode.value = null;
  clearWorkflow();
  accordionActiveNames.value = ["workflows"];
};

const extractRepoName = (gitUrl) => {
  if (!gitUrl) return "";
  const parts = gitUrl.split("/");
  const name = parts[parts.length - 1] || gitUrl;
  return name.replace(/\.git$/, "");
};

const normalizeUrl = (url) => {
  if (!url) return "";
  return url.replace(/\.git$/, "").replace(/\/$/, "");
};

const findAppByUrl = (applications, sourceUrl) => {
  if (!sourceUrl) return null;
  const normalized = normalizeUrl(sourceUrl);
  return applications.find(
    (app) => normalizeUrl(app.source?.url) === normalized
  ) || null;
};

const nodeTypeColor = (type) => {
  if (type === "data-source") return "#6366f1";
  if (type === "data-target") return "#64748b";
  return "#cccccc";
};

const definitionToNodesAndEdges = (workflow, applications) => {
  const raw = workflow.dag || [];
  if (raw.length === 0) return { nodes: [], edges: [], needsAutoLayout: false };

  // Normalize IDs
  const idMap = {};
  raw.forEach((p, idx) => {
    idMap[p.id || `_old_${idx}`] = p.id || `proc_${idx}`;
  });
  const processors = raw.map((p, idx) => ({
    ...p,
    id: p.id || `proc_${idx}`,
    dependsOn: (p.dependsOn || [])
      .filter(Boolean)
      .map((dep) => idMap[dep] || dep),
  }));

  // Check if any node has a saved position
  const hasSavedPositions = processors.some(
    (p) => p.position && typeof p.position.x === "number"
  );

  // Build VueFlow nodes
  const resultNodes = processors.map((p) => {
    let label = p.type;
    let nodeType = "default";

    if (p.type === "data-source") {
      label = "Data Source";
      nodeType = "data-source";
    } else if (p.type === "data-target") {
      label = "Data Target";
      nodeType = "data-target";
    } else {
      const matchedApp = findAppByUrl(applications, p.sourceUrl);
      label = matchedApp ? matchedApp.name : extractRepoName(p.sourceUrl);
    }

    const matchedApplication =
      p.type !== "data-source" && p.type !== "data-target"
        ? findAppByUrl(applications, p.sourceUrl) || {}
        : {};

    return {
      id: p.id,
      type: nodeType,
      data: {
        label,
        targetType: p.targetType || null,
        computeType: p.computeType || (nodeType === "default"
          ? (matchedApplication?.runtimeConfig?.computeTypes?.[0] || "standard")
          : getComputeTypesForTarget(p.targetType)?.[0] || null),
        cpu: String(p.cpu || matchedApplication?.runtimeConfig?.cpu || "") || "",
        memory: String(p.memory || matchedApplication?.runtimeConfig?.memory || "") || "",
        application: matchedApplication,
      },
      position: hasSavedPositions && p.position
        ? { x: p.position.x, y: p.position.y }
        : { x: 0, y: 0 },
    };
  });

  // Build edges from dependsOn
  const procMap = Object.fromEntries(processors.map((p) => [p.id, p]));
  const resultEdges = [];
  for (const p of processors) {
    for (const dep of p.dependsOn || []) {
      const srcNode = procMap[dep];
      resultEdges.push({
        id: `e${dep}-${p.id}`,
        source: dep,
        target: p.id,
        animated: false,
        style: { stroke: nodeTypeColor(srcNode?.type) },
      });
    }
  }

  return { nodes: resultNodes, edges: resultEdges, needsAutoLayout: !hasSavedPositions };
};

const startEditDetails = () => {
  if (!selectedWorkflow.value) return;
  editName.value = selectedWorkflow.value.name || "";
  editDescription.value = selectedWorkflow.value.description || "";
  isEditingDetails.value = true;
};

const cancelEditDetails = () => {
  isEditingDetails.value = false;
};

const saveDetails = async () => {
  if (!selectedWorkflow.value || !editName.value.trim()) return;
  isSavingDetails.value = true;
  try {
    await store.dispatch("analysisModule/updateWorkflow", {
      uuid: selectedWorkflow.value.uuid,
      payload: {
        name: editName.value,
        description: editDescription.value,
      },
    });
    selectedWorkflow.value = {
      ...selectedWorkflow.value,
      name: editName.value,
      description: editDescription.value,
    };
    isEditingDetails.value = false;
    EventBus.$emit("toast", {
      detail: { type: "success", msg: "Workflow updated." },
    });
  } catch {
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Failed to update workflow." },
    });
  } finally {
    isSavingDetails.value = false;
  }
};

const toggleArchive = async () => {
  if (!selectedWorkflow.value) return;
  const newStatus = !selectedWorkflow.value.isActive;
  try {
    await store.dispatch("analysisModule/updateWorkflow", {
      uuid: selectedWorkflow.value.uuid,
      payload: { isActive: newStatus },
    });
    selectedWorkflow.value = { ...selectedWorkflow.value, isActive: newStatus };
    EventBus.$emit("toast", {
      detail: {
        type: "success",
        msg: newStatus ? "Workflow activated." : "Workflow archived.",
      },
    });
  } catch {
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Failed to update workflow status." },
    });
  }
};

const selectWorkflow = (workflow) => {
  mode.value = "browse";
  selectedWorkflow.value = workflow;
  selectedNode.value = null;
  isEditingDetails.value = false;
  accordionActiveNames.value = ["information", "workflow-metrics"];
  workflowName.value = workflow.name || "";
  workflowDescription.value = workflow.description || "";

  const result = definitionToNodesAndEdges(
    workflow,
    availableApplications.value
  );
  nodes.value = result.nodes;
  edges.value = result.edges;

  if (result.needsAutoLayout) {
    autoLayout();
  } else {
    setTimeout(() => fitView({ padding: 0.2 }), 50);
  }
};

/*
Helpers
*/

const generateNodeId = () => {
  return `node_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

const dragOffset = ref({ x: 0, y: 0 });

const onDragStart = (item, event, type = "application") => {
  if (isReadOnly.value) return;
  draggedType.value = type;
  draggedApp.value = type === "application" ? item : null;

  // Capture where within the element the user clicked
  const rect = event.target.getBoundingClientRect();
  dragOffset.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
};

const onDrop = (event) => {
  event.preventDefault();
  if (isReadOnly.value) return;

  if (!draggedType.value) return;

  // Convert drop position to flow coordinates, applying the grab offset
  const flowPos = screenToFlowCoordinate({
    x: event.clientX,
    y: event.clientY,
  });
  const position = {
    x: flowPos.x - dragOffset.value.x,
    y: flowPos.y - dragOffset.value.y,
  };

  const nodeId = generateNodeId();
  let newNode;

  if (draggedType.value === "data-source") {
    newNode = {
      id: nodeId,
      type: "data-source",
      data: {
        label: "Data Source",
      },
      position,
    };
  } else if (draggedType.value === "data-target") {
    newNode = {
      id: nodeId,
      type: "data-target",
      data: {
        label: "Data Target",
        targetType:
          targetTypes.value.length === 1 ? targetTypes.value[0].targetType : null,
        computeType:
          targetTypes.value.length === 1 && targetTypes.value[0].runtimeConfig?.computeTypes?.length
            ? targetTypes.value[0].runtimeConfig.computeTypes[0] : null,
      },
      position,
    };
  } else if (draggedApp.value) {
    newNode = {
      id: nodeId,
      type: "default",
      data: {
        label: draggedApp.value.name,
        application: draggedApp.value,
        computeType: draggedApp.value.runtimeConfig?.computeTypes?.[0] || "standard",
        cpu: String(draggedApp.value.runtimeConfig?.cpu || "") || "",
        memory: String(draggedApp.value.runtimeConfig?.memory || "") || "",
      },
      position,
    };
  }

  if (newNode) {
    nodes.value.push(newNode);
  }

  draggedApp.value = null;
  draggedType.value = null;
};

const onDragOver = (event) => {
  if (isReadOnly.value) return;
  event.preventDefault();
};

// Handle edge connections from user dragging between node handles
onConnect((params) => {
  if (isReadOnly.value) return;

  // Guard against self-loops
  if (params.source === params.target) return;

  // Guard against duplicate edges
  const duplicate = edges.value.some(
    (e) => e.source === params.source && e.target === params.target
  );
  if (duplicate) return;

  const srcNode = nodes.value.find((n) => n.id === params.source);
  edges.value.push({
    id: `e${params.source}-${params.target}`,
    source: params.source,
    target: params.target,
    animated: false,
    style: { stroke: nodeTypeColor(srcNode?.type) },
  });
});

const removeNode = (nodeId) => {
  const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) return;

  // Remove associated edges
  edges.value = edges.value.filter(
    (edge) => edge.source !== nodeId && edge.target !== nodeId
  );

  // Remove node
  nodes.value.splice(nodeIndex, 1);
};

const clearWorkflow = () => {
  nodes.value = [];
  edges.value = [];
  workflowName.value = "";
  workflowDescription.value = "";
};

const NODE_WIDTH = 280;
const NODE_HEIGHT = 100;

const autoLayout = () => {
  if (nodes.value.length === 0) return;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 120, ranksep: 150 });

  for (const node of nodes.value) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges.value) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  nodes.value = nodes.value.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  // Fit the view after layout settles
  setTimeout(() => fitView({ padding: 0.2 }), 50);
};

const saveWorkflow = async () => {
  if (!workflowName.value.trim()) {
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "Please provide a workflow name.",
      },
    });
    return;
  }

  if (nodes.value.length === 0) {
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "Please add at least one application to the workflow.",
      },
    });
    return;
  }

  const processors = nodes.value.map((node) => {
    // Build dependsOn from incoming edges (edges whose target is this node)
    const dependsOn = edges.value
      .filter((e) => e.target === node.id)
      .map((e) => e.source);

    const position = { x: node.position.x, y: node.position.y };

    if (node.type === "data-source") {
      return {
        id: node.id,
        type: "data-source",
        dependsOn: [],
        position,
      };
    }

    if (node.type === "data-target") {
      return {
        id: node.id,
        type: "data-target",
        targetType: node.data.targetType,
        computeType: node.data.computeType,
        dependsOn: dependsOn,
        position,
      };
    }

    // Default: processor
    const proc = {
      id: node.id,
      type: "processor",
      sourceUrl: node.data.application?.source?.url,
      computeType: node.data.computeType || "standard",
      dependsOn: dependsOn,
      position,
    };
    if (node.data.cpu) proc.cpu = node.data.cpu;
    if (node.data.memory) proc.memory = node.data.memory;
    return proc;
  });

  const workflowData = {
    name: workflowName.value,
    description: workflowDescription.value,
    processors: processors,
  };

  try {
    await store.dispatch("analysisModule/createWorkflow", workflowData);
    EventBus.$emit("toast", {
      detail: {
        type: "success",
        msg: "Your request to create a Workflow has been initiated.",
        duration: 8000,
      },
    });
    clearWorkflow();
    await store.dispatch("analysisModule/fetchWorkflows");
    mode.value = "browse";
  } catch (error) {
    console.error(error);
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "There was a problem submitting your request.",
        duration: 6000,
      },
    });
  }
};

/*
Fetch Initial Data
*/
onMounted(async () => {
  try {
    isLoading.value = true;

    await Promise.all([
      store.dispatch("analysisModule/fetchApplications"),
      store.dispatch("analysisModule/fetchTargetTypes"),
    ]);

    if (props.uuid) {
      const wf = await store.dispatch("analysisModule/fetchWorkflowDefinition", props.uuid);
      if (wf) {
        selectWorkflow(wf);
      }
    } else {
      enterCreateMode();
    }
  } catch (err) {
    console.error(err);
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "Failed to load data.",
      },
    });
  } finally {
    isLoading.value = false;
  }
});

/*
Event Handler for Node Click
*/
onNodeClick(({ node }) => {
  // Deselect previous
  nodes.value.forEach((n) => (n.selected = false));
  // Select clicked node
  const target = nodes.value.find((n) => n.id === node.id);
  if (target) target.selected = true;

  selectedNode.value = node;
  const toOpen = ["information", "node-metrics"];
  const current = accordionActiveNames.value;
  const missing = toOpen.filter((n) => !current.includes(n));
  if (missing.length) {
    accordionActiveNames.value = [...current, ...missing];
  }
});

onPaneClick(() => {
  nodes.value.forEach((n) => (n.selected = false));
  selectedNode.value = null;
});

const openNodeSettings = (id) => {
  nodes.value.forEach((n) => (n.selected = false));
  const target = nodes.value.find((n) => n.id === id);
  if (target) target.selected = true;
  selectedNode.value = target;

  // Ensure information accordion is open
  if (!accordionActiveNames.value.includes("information")) {
    accordionActiveNames.value = [...accordionActiveNames.value, "information"];
  }

  nextTick(() => {
    sidebarRef.value?.scrollTo({ top: 0, behavior: "smooth" });
  });
};
</script>

<template>
  <div class="workflow-builder">
    <!-- Header -->
    <div class="builder-header">
      <span class="header-title">
        <router-link :to="{ name: 'workflows' }" class="header-back-link">Workflows</router-link>
        <template v-if="mode === 'create'">
          <span class="header-breadcrumb-sep">/</span>
          <span class="header-detail-name">New Workflow</span>
        </template>
        <template v-else-if="selectedWorkflow">
          <span class="header-breadcrumb-sep">/</span>
          <span class="header-detail-name">{{ selectedWorkflow.name }}</span>
        </template>
      </span>
      <template v-if="mode === 'create'">
        <el-input
          v-model="workflowName"
          placeholder="Workflow name"
          class="header-name-input"
        />
        <el-input
          v-model="workflowDescription"
          placeholder="Description (optional)"
          class="header-desc-input"
        />
        <div class="header-actions">
          <bf-button class="secondary" @click="clearWorkflow">Clear</bf-button>
          <bf-button @click="saveWorkflow">Save</bf-button>
        </div>
      </template>
    </div>

    <div class="builder-content">
      <!-- Left: Main Panel -->
      <div class="main-panel">
        <!-- Workflow Canvas -->
        <div class="workflow-canvas" @drop="onDrop" @dragover="onDragOver">
        <div v-if="nodes.length === 0" class="empty-canvas">
          <template v-if="mode === 'create'">
            <h3>Drag items here to build your workflow</h3>
            <p>
              Drop data sources, applications, and data targets onto the canvas,
              then connect them by dragging between handles
            </p>
          </template>
          <template v-else>
            <h3>No workflow loaded</h3>
            <p>
              Return to the workflows gallery to select a workflow
            </p>
          </template>
        </div>

        <div class="workflow-builder-flow">
          <VueFlow
            v-model:nodes="nodes"
            v-model:edges="edges"
            :default-viewport="{ zoom: 1 }"
            :min-zoom="0.2"
            :max-zoom="4"
            :nodes-draggable="true"
            :nodes-connectable="!isReadOnly"
            :elements-selectable="true"
            :pan-on-drag="true"
            :zoom-on-scroll="true"
          >
            <Background pattern-color="#aaa" :gap="16" />
            <Controls position="top-left" />

            <div class="canvas-toolbar">
              <button
                v-if="nodes.length > 0"
                class="auto-layout-btn"
                @click="autoLayout"
              >
                Auto Layout
              </button>
            </div>

            <template #node-default="{ data, id }">
              <Handle id="target" type="target" :position="Position.Top" />
              <div class="custom-node">
                <div class="node-header">
                  <span class="node-title">{{ data.label }}</span>
                  <button
                    v-if="!isReadOnly"
                    class="settings-btn"
                    @click.stop="openNodeSettings(id)"
                    title="Configure"
                  >
                    <IconPencil :width="12" :height="12" />
                  </button>
                  <button
                    v-if="!isReadOnly"
                    class="remove-btn"
                    @click.stop="removeNode(id)"
                  >
                    &times;
                  </button>
                </div>
                <div
                  v-if="data.application && data.application.description"
                  class="node-description"
                >
                  {{ data.application.description }}
                </div>
                <div class="node-resources">
                  <template v-if="data.computeType !== 'lambda'">
                    CPU: {{ data.cpu || data.application?.runtimeConfig?.cpu || "N/A" }} |
                  </template>
                  Memory: {{ data.memory ? formatResourceLabel(data.memory) : (data.application?.runtimeConfig?.memory || "N/A") }}
                  <span v-if="data.computeType" class="runtime-tag">{{ data.computeType }}</span>
                </div>
              </div>
              <Handle id="source" type="source" :position="Position.Bottom" />
            </template>

            <template #node-input="{ data, id }">
              <Handle id="target" type="target" :position="Position.Top" />
              <div class="custom-node input-node">
                <div class="node-header">
                  <span class="node-title">{{ data.label }}</span>
                  <button
                    v-if="!isReadOnly"
                    class="remove-btn"
                    @click.stop="removeNode(id)"
                  >
                    &times;
                  </button>
                </div>
                <div class="node-badge">Start</div>
                <div
                  v-if="data.application && data.application.description"
                  class="node-description"
                >
                  {{ data.application.description }}
                </div>
                <div
                  v-if="data.application && data.application.runtimeConfig"
                  class="node-resources"
                >
                  CPU: {{ data.application.runtimeConfig.cpu || "N/A" }} | Memory:
                  {{ data.application.runtimeConfig.memory || "N/A" }}
                </div>
              </div>
              <Handle id="source" type="source" :position="Position.Bottom" />
            </template>

            <template #node-output="{ data, id }">
              <Handle id="target" type="target" :position="Position.Top" />
              <div class="custom-node output-node">
                <div class="node-header">
                  <span class="node-title">{{ data.label }}</span>
                  <button
                    v-if="!isReadOnly"
                    class="remove-btn"
                    @click.stop="removeNode(id)"
                  >
                    &times;
                  </button>
                </div>
                <div class="node-badge">End</div>
                <div
                  v-if="data.application && data.application.description"
                  class="node-description"
                >
                  {{ data.application.description }}
                </div>
                <div
                  v-if="data.application && data.application.runtimeConfig"
                  class="node-resources"
                >
                  CPU: {{ data.application.runtimeConfig.cpu || "N/A" }} | Memory:
                  {{ data.application.runtimeConfig.memory || "N/A" }}
                </div>
              </div>
              <Handle id="source" type="source" :position="Position.Bottom" />
            </template>

            <!-- Data Source Node: output only (feeds into processors) -->
            <template #node-data-source="{ data, id }">
              <div class="custom-node data-source-node">
                <div class="node-header">
                  <span class="node-type-badge source-badge">Source</span>
                  <span class="node-title">{{ data.label }}</span>
                  <button
                    v-if="!isReadOnly"
                    class="remove-btn"
                    @click.stop="removeNode(id)"
                  >
                    &times;
                  </button>
                </div>
              </div>
              <Handle id="source" type="source" :position="Position.Bottom" />
            </template>

            <!-- Data Target Node: input only (receives from processors) -->
            <template #node-data-target="{ data, id }">
              <Handle id="target" type="target" :position="Position.Top" />
              <div class="custom-node data-target-node">
                <div class="node-header">
                  <span class="node-type-badge target-badge">Target</span>
                  <span class="node-title">{{ data.targetType || 'No target selected' }}</span>
                  <button
                    v-if="!isReadOnly"
                    class="settings-btn"
                    @click.stop="openNodeSettings(id)"
                    title="Configure"
                  >
                    <IconPencil :width="12" :height="12" />
                  </button>
                  <button
                    v-if="!isReadOnly"
                    class="remove-btn"
                    @click.stop="removeNode(id)"
                  >
                    &times;
                  </button>
                </div>
                <div class="node-body">
                  <span v-if="data.computeType" class="runtime-tag">{{ data.computeType }}</span>
                </div>
              </div>
            </template>
          </VueFlow>
        </div>
      </div>
      </div>

      <!-- Sidebar (Right) -->
      <div ref="sidebarRef" class="applications-sidebar">
        <el-collapse v-model="accordionActiveNames" class="sidebar-accordion">
          <!-- Information Section -->
          <el-collapse-item title="Information" name="information">
            <!-- Selected Node Info -->
            <template v-if="selectedNode">
              <h4 class="sidebar-section-title">Selected Node</h4>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">Name</span>
                  <span class="info-value">{{ selectedNode.data?.label || 'Unnamed' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Type</span>
                  <span class="info-value">{{ selectedNode.type }}</span>
                </div>
                <template v-if="selectedNode.data?.application?.description">
                  <div class="info-row">
                    <span class="info-label">Description</span>
                    <span class="info-value">{{ selectedNode.data.application.description }}</span>
                  </div>
                </template>
                <template v-if="selectedNode.data?.application?.applicationType">
                  <div class="info-row">
                    <span class="info-label">App Type</span>
                    <span class="info-value">{{ selectedNode.data.application.applicationType }}</span>
                  </div>
                </template>
                <template v-if="selectedNode.type === 'data-target'">
                  <div class="info-row">
                    <span class="info-label">Target Type</span>
                    <span class="info-value" v-if="isReadOnly">{{ selectedNode.data.targetType || 'Not set' }}</span>
                    <el-select
                      v-else
                      v-model="selectedNode.data.targetType"
                      size="small"
                      placeholder="Select target type"
                      class="info-inline-select"
                      @change="onTargetTypeChange(selectedNode.data)"
                    >
                      <el-option
                        v-for="tt in targetTypes"
                        :key="tt.targetType"
                        :label="tt.targetType"
                        :value="tt.targetType"
                      />
                    </el-select>
                  </div>
                </template>
                <template v-if="selectedNode.data?.computeType && isReadOnly">
                  <div class="info-row">
                    <span class="info-label">Compute Type</span>
                    <span class="info-value">{{ selectedNode.data.computeType }}</span>
                  </div>
                </template>
              </div>

              <!-- Data target runtime config (editable in create mode) -->
              <template v-if="selectedNode.type === 'data-target' && !isReadOnly">
                <h4 class="sidebar-section-title">Runtime Configuration</h4>
                <div class="info-card">
                  <div class="info-row">
                    <span class="info-label">Compute Type</span>
                    <el-select
                      v-model="selectedNode.data.computeType"
                      size="small"
                      class="info-inline-select"
                    >
                      <el-option
                        v-for="ct in getComputeTypesForTarget(selectedNode.data.targetType)"
                        :key="ct"
                        :label="ct.charAt(0).toUpperCase() + ct.slice(1)"
                        :value="ct"
                      />
                    </el-select>
                  </div>
                </div>
              </template>

              <!-- Processor settings (editable in create mode) -->
              <template v-if="selectedNode.type === 'default' && !isReadOnly">
                <h4 class="sidebar-section-title">Runtime Configuration</h4>
                <div class="info-card">
                  <div class="info-row">
                    <span class="info-label">Compute Type</span>
                    <el-select
                      v-model="selectedNode.data.computeType"
                      size="small"
                      class="info-inline-select"
                    >
                      <el-option
                        v-for="ct in (selectedNode.data.application?.runtimeConfig?.computeTypes || ['standard'])"
                        :key="ct"
                        :label="ct.charAt(0).toUpperCase() + ct.slice(1)"
                        :value="ct"
                      />
                    </el-select>
                  </div>
                  <!-- Standard: CPU then dependent Memory -->
                  <template v-if="selectedNode.data.computeType !== 'lambda'">
                    <div class="info-row">
                      <span class="info-label">CPU</span>
                      <el-select
                        v-model="selectedNode.data.cpu"
                        size="small"
                        placeholder="Default"
                        clearable
                        class="info-inline-select"
                        @change="() => { selectedNode.data.memory = '' }"
                      >
                        <el-option
                          v-for="cpu in FARGATE_CPU_OPTIONS"
                          :key="cpu"
                          :label="`${cpu} (${(cpu / 1024).toFixed(cpu >= 1024 ? 0 : 2)} vCPU)`"
                          :value="cpu"
                        />
                      </el-select>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Memory</span>
                      <el-select
                        v-model="selectedNode.data.memory"
                        size="small"
                        placeholder="Default"
                        clearable
                        :disabled="!selectedNode.data.cpu"
                        class="info-inline-select"
                      >
                        <el-option
                          v-for="mem in getMemoryOptionsForCpu(selectedNode.data.cpu)"
                          :key="mem"
                          :label="formatResourceLabel(mem)"
                          :value="mem"
                        />
                      </el-select>
                    </div>
                  </template>
                  <!-- Lambda: Memory + auto-matched CPU -->
                  <template v-else>
                    <div class="info-row">
                      <span class="info-label">CPU</span>
                      <el-select
                        v-model="selectedNode.data.cpu"
                        size="small"
                        disabled
                        class="info-inline-select"
                      >
                        <el-option
                          v-for="cpu in FARGATE_CPU_OPTIONS"
                          :key="cpu"
                          :label="`${cpu} (${(cpu / 1024).toFixed(cpu >= 1024 ? 0 : 2)} vCPU)`"
                          :value="cpu"
                        />
                      </el-select>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Memory</span>
                      <el-select
                        v-model="selectedNode.data.memory"
                        size="small"
                        placeholder="Default"
                        clearable
                        class="info-inline-select"
                        @change="(val) => { selectedNode.data.cpu = getCpuForMemory(val) }"
                      >
                        <el-option
                          v-for="mem in LAMBDA_MEMORY_OPTIONS"
                          :key="mem"
                          :label="formatResourceLabel(mem)"
                          :value="mem"
                        />
                      </el-select>
                    </div>
                    <p class="runtime-note">
                      Lambda allocates CPU proportionally to memory. CPU and Fargate memory settings are only applied if the run is overridden to execute as a standard processor.
                    </p>
                  </template>
                </div>
              </template>

              <!-- Processor configuration -->
              <template v-if="selectedNodeProcessor">
                <h4 class="sidebar-section-title">Configuration</h4>
                <div class="info-card">
                  <div class="info-row">
                    <span class="info-label">ID</span>
                    <span class="info-value info-url">{{ selectedNodeProcessor.id }}</span>
                  </div>
                  <template v-if="selectedNodeProcessor.sourceUrl">
                    <div class="info-row">
                      <span class="info-label">Source URL</span>
                      <span class="info-value info-url">{{ selectedNodeProcessor.sourceUrl }}</span>
                    </div>
                  </template>
                  <div class="info-row">
                    <span class="info-label">Depends On</span>
                    <span class="info-value">
                      <template v-if="selectedNodeDependencies.length > 0">
                        <span
                          v-for="dep in selectedNodeDependencies"
                          :key="dep.id"
                          class="dep-tag"
                        >{{ dep.label }}</span>
                      </template>
                      <template v-else>None</template>
                    </span>
                  </div>
                </div>
              </template>

              <!-- Source -->
              <template v-if="selectedNode.data?.application?.source">
                <h4 class="sidebar-section-title">Source</h4>
                <div class="info-card">
                  <template v-if="selectedNode.data.application.source.url">
                    <div class="info-row">
                      <span class="info-label">Repository</span>
                      <span class="info-value info-url">{{ selectedNode.data.application.source.url }}</span>
                    </div>
                  </template>
                  <template v-if="selectedNode.data.application.source.branch">
                    <div class="info-row">
                      <span class="info-label">Branch</span>
                      <span class="info-value">{{ selectedNode.data.application.source.branch }}</span>
                    </div>
                  </template>
                  <template v-if="selectedNode.data.application.source.path">
                    <div class="info-row">
                      <span class="info-label">Path</span>
                      <span class="info-value info-url">{{ selectedNode.data.application.source.path }}</span>
                    </div>
                  </template>
                </div>
              </template>

              <button class="text-link-btn" @click="selectedNode = null">
                Clear selection
              </button>
            </template>

            <!-- Workflow Details -->
            <template v-if="selectedWorkflow">
              <h4 class="sidebar-section-title">Workflow Details</h4>
              <template v-if="isEditingDetails">
                <div class="info-edit-form">
                  <label class="info-edit-label">Name</label>
                  <el-input v-model="editName" size="small" />
                  <label class="info-edit-label">Description</label>
                  <el-input
                    v-model="editDescription"
                    type="textarea"
                    :rows="3"
                    size="small"
                  />
                  <div class="info-edit-actions">
                    <bf-button
                      class="secondary"
                      @click="cancelEditDetails"
                    >
                      Cancel
                    </bf-button>
                    <bf-button
                      :disabled="isSavingDetails || !editName.trim()"
                      @click="saveDetails"
                    >
                      {{ isSavingDetails ? 'Saving...' : 'Save' }}
                    </bf-button>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="info-card">
                  <div class="info-row">
                    <span class="info-label">Name</span>
                    <span class="info-value">{{ selectedWorkflow.name }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Description</span>
                    <span class="info-value">{{ selectedWorkflow.description || 'No description' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Status</span>
                    <span class="info-value">
                      <span
                        class="status-dot"
                        :class="selectedWorkflow.isActive ? 'active' : 'inactive'"
                      />
                      {{ selectedWorkflow.isActive ? 'Active' : 'Inactive' }}
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Nodes</span>
                    <span class="info-value">{{ (selectedWorkflow.dag || []).length }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Created</span>
                    <span class="info-value">{{ new Date(selectedWorkflow.createdAt).toLocaleDateString() }}</span>
                  </div>
                  <div v-if="selectedWorkflow.createdBy" class="info-row">
                    <span class="info-label">Created By</span>
                    <span class="info-value">{{ getUserName(selectedWorkflow.createdBy) }}</span>
                  </div>
                </div>
                <div class="info-actions">
                  <button class="text-link-btn" @click="startEditDetails">
                    Edit name & description
                  </button>
                  <button class="text-link-btn archive-btn" @click="toggleArchive">
                    {{ selectedWorkflow.isActive ? 'Archive workflow' : 'Activate workflow' }}
                  </button>
                </div>
              </template>
            </template>

            <div v-if="!selectedWorkflow && !selectedNode" class="info-empty">
              Select a workflow or click a node to see details
            </div>
          </el-collapse-item>

          <!-- Workflow Metrics Section -->
          <el-collapse-item
            v-if="mode === 'browse' && selectedWorkflow"
            title="Workflow Metrics"
            name="workflow-metrics"
          >
            <MetricsDashboard
              :key="selectedWorkflow.uuid"
              filter-column="workflowUuid"
              :filter-value="selectedWorkflow.uuid"
              vertical
              hide-header
            />
          </el-collapse-item>

          <!-- Node Metrics Section -->
          <el-collapse-item
            v-if="selectedNode && selectedNodeProcessor?.sourceUrl"
            title="Node Metrics"
            name="node-metrics"
          >
            <MetricsDashboard
              :key="selectedNodeProcessor.sourceUrl"
              filter-column="sourceUrl"
              :filter-value="selectedNodeProcessor.sourceUrl"
              vertical
              hide-header
            />
          </el-collapse-item>

          <!-- Data & Applications Section (create mode only) -->
          <el-collapse-item v-if="mode === 'create'" title="Data & Applications" name="data-and-apps">
            <!-- Data Section -->
            <h4 class="sidebar-section-title">Data</h4>
            <div class="data-items-list">
              <div
                class="data-item data-source-item"
                :class="{ disabled: isReadOnly }"
                :draggable="!isReadOnly"
                @dragstart="onDragStart(null, $event, 'data-source')"
              >
                <IconFile class="data-item-icon" :width="20" :height="20" />
                <div class="data-item-info">
                  <div class="data-item-name">Source</div>
                  <div class="data-item-description">
                    Select input sources
                  </div>
                </div>
              </div>
              <div
                class="data-item data-target-item"
                :class="{ disabled: isReadOnly }"
                :draggable="!isReadOnly"
                @dragstart="onDragStart(null, $event, 'data-target')"
              >
                <IconCollection
                  class="data-item-icon"
                  :width="20"
                  :height="20"
                />
                <div class="data-item-info">
                  <div class="data-item-name">Target</div>
                  <div class="data-item-description">
                    Select output target
                  </div>
                </div>
              </div>
            </div>

            <!-- Applications Section -->
            <h4 class="sidebar-section-title">Applications</h4>
            <div v-if="isLoading" class="loading">
              Loading applications...
            </div>
            <div v-else class="applications-list">
              <div
                v-for="app in availableApplications"
                :key="app.uuid"
                class="application-item"
                :class="{ disabled: isReadOnly }"
                :draggable="!isReadOnly"
                @dragstart="onDragStart(app, $event, 'application')"
              >
                <IconAnalysis class="app-icon" :width="20" :height="20" />
                <div class="app-info">
                  <div class="app-name">{{ app.name }}</div>
                  <span class="app-type-badge">{{ app.applicationType }}</span>
                  <div class="app-description">
                    {{ app.description || "No description" }}
                  </div>
                  <div class="app-resources">
                    CPU: {{ app.runtimeConfig?.cpu || "N/A" }} | Memory:
                    {{ app.runtimeConfig?.memory || "N/A" }}
                  </div>
                </div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

    <!-- Workflow Summary -->
    <div v-if="nodes.length > 0 && mode === 'create'" class="workflow-summary">
      <h4>Workflow Summary</h4>
      <div class="summary-content">
        <span><strong>Steps:</strong> {{ nodes.length }}</span>
        <span><strong>Name:</strong> {{ workflowName || "Unnamed" }}</span>
        <span v-if="workflowDescription"
          ><strong>Description:</strong> {{ workflowDescription }}</span
        >
      </div>
    </div>
  </div>
</template>

<style lang="scss">
/* these are necessary styles for vue flow */
@import "@vue-flow/core/dist/style.css";
@import "@vue-flow/core/dist/theme-default.css";

/* Handle styles — must be unscoped so VueFlow can render them */
.workflow-builder-flow {
  .vue-flow__node {
    --node-border-color: #cccccc;

    &:has(.input-node) { --node-border-color: #17BB62; }
    &:has(.output-node) { --node-border-color: #17BB62; }
    &:has(.data-source-node) { --node-border-color: #6366f1; }
    &:has(.data-target-node) { --node-border-color: #64748b; }
  }

  .vue-flow__handle {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--node-border-color, #cccccc) !important;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px var(--node-border-color, #cccccc);
    cursor: crosshair;
    transition: background-color 0.15s, box-shadow 0.15s;
    z-index: 0;

    /* Invisible expanded hit area so it's easy to grab */
    &::after {
      content: "";
      position: absolute;
      top: -8px;
      left: -8px;
      right: -8px;
      bottom: -8px;
      border-radius: 50%;
    }

    &:hover {
      background-color: #111;
      box-shadow: 0 0 0 2px #111;
    }

    &.vue-flow__handle-top {
      top: -5px;
      left: 50% !important;
      transform: translateX(-50%) !important;
    }

    &.vue-flow__handle-bottom {
      bottom: -5px;
      left: 50% !important;
      transform: translateX(-50%) !important;
    }

    /* Valid connection target highlight */
    &.valid {
      background-color: #16a34a;
      box-shadow: 0 0 0 2px #16a34a;
    }

    /* Active / connecting state */
    &.connecting {
      background-color: #111;
      box-shadow: 0 0 0 2px #111;
    }
  }
}

</style>

<style lang="scss" scoped>
@use "../../../styles/theme";

.workflow-builder {
  height: calc(100vh - 112px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.builder-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background-color: theme.$white;
  border-bottom: 1px solid theme.$gray_3;
  min-height: 48px;

  .header-title {
    font-weight: 400;
    font-size: 13px;
    color: theme.$gray_4;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-back-link {
    color: theme.$purple_3;
    cursor: pointer;
    font-weight: 500;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .header-breadcrumb-sep {
    color: theme.$gray_4;
    font-weight: 400;
  }

  .header-detail-name {
    font-weight: 600;
    font-size: 14px;
    color: theme.$black;
  }

  .header-name-input {
    width: 220px;
    flex-shrink: 0;
  }

  .header-desc-input {
    width: 280px;
    flex-shrink: 1;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }
}

.builder-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.applications-sidebar {
  width: 350px;
  background-color: theme.$white;
  border-left: 1px solid theme.$gray_3;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .loading {
    text-align: center;
    padding: 20px;
    color: theme.$gray_4;
  }
}

.new-workflow-btn {
  width: 100%;
}

.filter-btn {
  padding: 5px 12px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: white;
  color: theme.$gray_5;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_1;
  }

  &.active {
    background: theme.$purple_1;
    border-color: theme.$purple_1;
    color: white;
  }
}

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.workflow-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.workflow-list-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background-color: theme.$gray_1;
  border: 1px solid theme.$gray_3;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: theme.$purple_1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &.selected {
    border-color: theme.$purple_1;
    background-color: theme.$purple_tint;
    box-shadow: 0 2px 8px rgba(80, 57, 247, 0.15);
  }

  .wf-item-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .wf-item-info {
    flex: 1;
    min-width: 0;
  }

  .wf-item-name {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
    color: theme.$black;
  }

  .wf-item-description {
    font-size: 12px;
    color: theme.$gray_4;
    margin-bottom: 4px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .wf-item-meta {
    font-size: 11px;
    color: theme.$gray_5;
    font-weight: 500;
  }
}

.workflow-list-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: theme.$gray_4;
}

.sidebar-accordion {
  border-top: none;
}

.sidebar-section-title {
  margin: 10px 0 6px 0;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: theme.$gray_4;
}

.data-items-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.data-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid theme.$gray_3;
  cursor: grab;
  transition: all 0.2s;

  &:active {
    cursor: grabbing;
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;

    &:active {
      cursor: not-allowed;
    }
  }

  .data-item-icon {
    flex-shrink: 0;
  }

  .data-item-info {
    flex: 1;
    min-width: 0;
  }

  .data-item-name {
    font-weight: 600;
    font-size: 14px;
    color: theme.$black;
  }

  .data-item-description {
    font-size: 12px;
    color: theme.$gray_4;
    margin-top: 2px;
  }
}

.data-source-item {
  background-color: #eef2ff;
  border-color: #6366f1;

  &:not(.disabled):hover {
    border-color: #4f46e5;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
  }
}

.data-target-item {
  background-color: #f1f5f9;
  border-color: #64748b;

  &:not(.disabled):hover {
    border-color: #047857;
    box-shadow: 0 2px 8px rgba(5, 150, 105, 0.2);
  }
}

.applications-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.application-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background-color: theme.$gray_1;
  border: 1px solid theme.$gray_3;
  cursor: grab;
  transition: all 0.2s;

  &:not(.disabled):hover {
    border-color: theme.$black;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &:active {
    cursor: grabbing;
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;

    &:active {
      cursor: not-allowed;
    }
  }

  .app-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .app-info {
    flex: 1;
    min-width: 0;
  }

  .app-name {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
    color: theme.$black;
  }

  .app-type-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 2px 6px;
    border-radius: 3px;
    background: theme.$gray_2;
    color: theme.$gray_5;
    margin-bottom: 4px;
  }

  .app-description {
    font-size: 12px;
    color: theme.$gray_4;
    margin-bottom: 4px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .app-resources {
    font-size: 11px;
    color: theme.$gray_5;
    font-weight: 500;
  }
}

.workflow-canvas {
  flex: 1;
  position: relative;
  background-color: theme.$gray_1;
}

.empty-canvas {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: theme.$gray_4;
  z-index: 5;
  pointer-events: none;

  h3 {
    margin: 0 0 10px 0;
  }

  p {
    margin: 0;
    font-size: 14px;
  }
}

.canvas-toolbar {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
}

.auto-layout-btn {
  padding: 6px 12px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  color: theme.$gray_5;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_1;
    background: theme.$white;
  }
}

.workflow-builder-flow {
  width: 100%;
  height: 100%;

  /* Hide default Vue Flow node styling only within workflow builder */
  :deep(.vue-flow__node) {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    width: auto !important;

    &.selected .custom-node {
      border-color: theme.$gray_4;
      box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.15);
    }
  }
}

.custom-node {
  background: white;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  padding: 14px;
  min-width: 250px;
  max-width: 350px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  position: relative;
  z-index: 1;

  &:hover {
    border-color: theme.$black;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .node-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 8px;
  }

  .node-title {
    font-weight: 600;
    font-size: 15px;
    color: theme.$black;
    flex: 1;
    line-height: 1.3;
  }

  .settings-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 3px;
    border-radius: 3px;
    color: theme.$gray_4;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    transition: color 0.15s, background 0.15s;

    &:hover {
      color: theme.$purple_1;
      background: rgba(theme.$purple_1, 0.1);
    }
  }

  .remove-btn {
    background: theme.$status_red;
    color: white;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
    transition: background 0.2s;

    &:hover {
      background: darken(theme.$status_red, 10%);
    }
  }

  .node-description {
    font-size: 12px;
    color: theme.$gray_4;
    margin-bottom: 8px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .node-resources {
    font-size: 11px;
    color: theme.$gray_5;
    font-weight: 500;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid theme.$gray_2;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .runtime-tag {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 8px;
    border-radius: 2px;
    background: rgba(5, 150, 105, 0.12);
    color: #047857;
    white-space: nowrap;
    margin-left: auto;
  }

  .node-badge {
    margin-top: 8px;
    margin-bottom: 8px;
    padding: 4px 8px;
    background: theme.$gray_2;
    border-radius: 4px;
    font-size: 11px;
    text-align: center;
    font-weight: 600;
  }

  &.input-node {
    border-color: theme.$status_green;

    .node-badge {
      background: theme.$status_green;
      color: white;
    }
  }

  &.output-node {
    border-color: theme.$status_green;

    .node-badge {
      background: theme.$status_green;
      color: white;
    }
  }

  &.data-source-node {
    border-color: #6366f1;
    background: #eef2ff;

    .node-header {
      align-items: center;
      margin-bottom: 0;
    }
  }

  &.data-target-node {
    border-color: #64748b;
    background: #f1f5f9;

    .node-body {
      margin-top: 8px;
    }

    .edit-target-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px;
      border-radius: 3px;
      color: theme.$gray_4;
      display: flex;
      align-items: center;
      transition: color 0.15s, background 0.15s;

      &:hover, &.active {
        color: #64748b;
        background: rgba(100, 116, 139, 0.1);
      }
    }

    .runtime-tag {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 2px 8px;
      border-radius: 2px;
      background: rgba(5, 150, 105, 0.12);
      color: #047857;
      white-space: nowrap;
      display: inline-block;
    }

    .target-edit {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .target-edit-field {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .target-edit-label {
        font-size: 10px;
        font-weight: 600;
        color: theme.$gray_4;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
    }
  }

  .node-type-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 8px;
    border-radius: 4px;
    flex-shrink: 0;

    &.source-badge {
      background: #6366f1;
      color: white;
    }

    &.target-badge {
      background: #64748b;
      color: white;
    }
  }
}

.workflow-summary {
  padding: 15px 20px;
  background-color: theme.$white;
  border-top: 1px solid theme.$gray_3;

  h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
  }

  .summary-content {
    display: flex;
    gap: 20px;
    font-size: 13px;
    flex-wrap: wrap;
  }
}

/* Information panel styles */
.info-card {
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  padding: 12px;
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 6px 0;

  &:not(:last-child) {
    border-bottom: 1px solid theme.$gray_2;
  }
}

.info-label {
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_5;
  flex-shrink: 0;
  min-width: 80px;
}

.info-value {
  font-size: 12px;
  color: theme.$black;
  text-align: right;
  word-break: break-word;
}

.info-inline-select {
  width: 130px;
}

.runtime-note {
  font-size: 11px;
  color: theme.$gray_4;
  margin: 8px 0 0 0;
  line-height: 1.4;
  font-style: italic;
}


.info-url {
  font-family: monospace;
  font-size: 11px;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;

  &.active {
    background-color: theme.$status_green;
  }

  &.inactive {
    background-color: theme.$gray_4;
  }
}

.info-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.text-link-btn {
  background: none;
  border: none;
  color: theme.$purple_3;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 0;
  text-align: left;

  &:hover {
    text-decoration: underline;
  }

  &.archive-btn {
    color: theme.$status_red;
  }
}

.info-edit-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-edit-label {
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_5;
}

.info-edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.dep-tag {
  display: inline-block;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  background: theme.$gray_2;
  color: theme.$gray_5;
  margin: 1px 3px 1px 0;
}

.info-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: theme.$gray_4;
}
</style>
