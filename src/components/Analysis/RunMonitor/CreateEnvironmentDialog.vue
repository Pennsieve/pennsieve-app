<script setup>
import { ref, computed, watch } from "vue";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";
import { useComputeResourcesStore } from "@/stores/computeResourcesStore";
import BfButton from "../../shared/bf-button/BfButton.vue";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // The public "Pennsieve - Build Python Environment" workflow (resolved by the
  // parent from the workflow definitions). Null when it isn't published yet.
  buildWorkflow: { type: Object, default: null },
  computeNodes: { type: Array, default: () => [] },
  defaultNodeId: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue", "created"]);

const store = useStore();
const cr = useComputeResourcesStore();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const PY_VERSIONS = ["3.12", "3.11", "3.10"];
// Layer names: lowercase, digits, dashes (matches the backend validLayerName + LayerNameSelector).
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

const form = ref({ name: "", nodeId: "", pythonVersion: "3.12", requirements: "" });
const submitting = ref(false);

watch(visible, (open) => {
  if (open) {
    form.value = {
      name: "",
      nodeId: props.defaultNodeId || props.computeNodes[0]?.uuid || "",
      pythonVersion: "3.12",
      requirements: "",
    };
  }
});

const nameValid = computed(() => NAME_RE.test(form.value.name));
const canSubmit = computed(
  () =>
    !!props.buildWorkflow &&
    nameValid.value &&
    !!form.value.nodeId &&
    !!form.value.requirements.trim() &&
    !submitting.value
);

function onFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    form.value.requirements = String(reader.result || "");
  };
  reader.readAsText(file);
}

// Build-workflow node IDs are builder-generated, so resolve by type (mirrors how
// mcp-service keys its public quick-plot workflow).
function resolveNodes(dag) {
  let builder = null;
  let target = null;
  let dataSource = null;
  for (const n of dag || []) {
    if (n.type === "processor") builder = n.id;
    else if (n.type === "data-target") target = n.id;
    else if (n.type === "data-source") dataSource = n.id;
  }
  return { builder, target, dataSource };
}

async function submit() {
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    const def = await store.dispatch(
      "analysisModule/fetchWorkflowDefinition",
      props.buildWorkflow.uuid
    );
    const { builder, target, dataSource } = resolveNodes(def && def.dag);
    if (!builder || !target) {
      throw new Error("Build workflow is missing a processor or persistent-layer node.");
    }
    if (dataSource) {
      throw new Error(
        "The environment builder workflow must be data-source-free (no input dataset)."
      );
    }

    // 1. Create the EMPTY python-env layer the build will populate.
    await cr.createNodeLayer(form.value.nodeId, {
      layerName: form.value.name,
      layerType: "python-env",
    });

    // 2. Run the public build workflow, overriding REQUIREMENTS + the target layer.
    await store.dispatch("analysisModule/createRun", {
      workflowInstanceConfiguration: {
        workflowId: props.buildWorkflow.uuid,
        computeNodeId: form.value.nodeId,
      },
      processorParams: {
        [builder]: {
          REQUIREMENTS: form.value.requirements,
          PYTHON_VERSION: form.value.pythonVersion,
        },
      },
      dataTargets: { [target]: { params: { layerName: form.value.name } } },
      name: `build-${form.value.name}`,
    });

    ElMessage.success(`Building environment "${form.value.name}" — this can take a few minutes.`);
    visible.value = false;
    emit("created", { nodeId: form.value.nodeId });
  } catch (err) {
    ElMessage.error((err && err.message) || "Failed to start environment build");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="New Python environment" width="560px">
    <div v-if="!buildWorkflow" class="env-warn">
      The environment builder isn’t available yet. (It needs the public
      “Pennsieve - Build Python Environment” workflow.)
    </div>
    <template v-else>
      <label class="env-label">Name</label>
      <el-input v-model="form.name" placeholder="e.g. my-analysis-stack" size="default" />
      <span v-if="form.name && !nameValid" class="env-hint err">
        Lowercase letters, numbers and dashes only.
      </span>
      <span v-else class="env-hint">Lowercase letters, numbers and dashes.</span>

      <div class="env-grid">
        <div>
          <label class="env-label">Compute node</label>
          <el-select v-model="form.nodeId" size="default" style="width: 100%">
            <el-option v-for="n in computeNodes" :key="n.uuid" :label="n.name" :value="n.uuid" />
          </el-select>
        </div>
        <div>
          <label class="env-label">Python version</label>
          <el-select v-model="form.pythonVersion" size="default" style="width: 100%">
            <el-option v-for="v in PY_VERSIONS" :key="v" :label="v" :value="v" />
          </el-select>
        </div>
      </div>

      <div class="env-req-head">
        <label class="env-label">requirements.txt</label>
        <label class="env-upload">
          Upload file
          <input type="file" accept=".txt,text/plain" style="display: none" @change="onFile" />
        </label>
      </div>
      <el-input
        v-model="form.requirements"
        type="textarea"
        :rows="9"
        placeholder="numpy&#10;pandas==2.3.3&#10;matplotlib&#10;scikit-learn"
        spellcheck="false"
      />
    </template>

    <template #footer>
      <bf-button class="secondary" @click="visible = false">Cancel</bf-button>
      <bf-button :disabled="!canSubmit" :processing="submitting" @click="submit">
        Create environment
      </bf-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.env-warn {
  font-size: 13px;
  color: theme.$gray_6;
  background: #faeeda;
  border-radius: 6px;
  padding: 12px;
}
.env-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: theme.$gray_6;
  margin: 12px 0 4px;
}
.env-hint {
  font-size: 11px;
  color: theme.$gray_4;

  &.err {
    color: theme.$red_1;
  }
}
.env-grid {
  display: grid;
  grid-template-columns: 1fr 140px;
  gap: 12px;
}
.env-req-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.env-upload {
  font-size: 12px;
  color: theme.$purple_1;
  cursor: pointer;
  margin-top: 12px;
}
</style>
