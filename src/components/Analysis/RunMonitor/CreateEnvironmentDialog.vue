<script setup>
import { ref, computed, watch } from "vue";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";
import { useComputeResourcesStore } from "@/stores/computeResourcesStore";
import BfButton from "../../shared/bf-button/BfButton.vue";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // Public build workflows by language: { python: wf|null, r: wf|null }. A
  // language is offered only when its workflow is published.
  buildWorkflows: { type: Object, default: () => ({ python: null, r: null }) },
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

// Per-language config. version param key + defaults differ; the builder workflow
// for each language is the matching public "Pennsieve - Build … Environment".
// Version is fixed by the builder image (e.g. processor-build-python-layer is
// python:3.12) and must match the notebook session's interpreter — it's not a
// user choice, just shown for clarity.
const LANGS = {
  python: {
    label: "Python (Jupyter)",
    layerType: "python-env",
    versionLabel: "Python version",
    version: "3.12",
    versionParam: "PYTHON_VERSION",
    reqLabel: "requirements.txt",
    reqPlaceholder: "numpy\npandas==2.3.3\nmatplotlib\nscikit-learn",
  },
  r: {
    label: "R",
    layerType: "r-env",
    versionLabel: "R version",
    version: "4.4",
    versionParam: "R_VERSION",
    reqLabel: "R packages (one per line)",
    reqPlaceholder: "ggplot2\ndplyr\ntidyr",
  },
};
// Layer names: lowercase, digits, dashes (matches the backend validLayerName).
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

const form = ref({ language: "python", name: "", nodeId: "", requirements: "" });
const submitting = ref(false);

const availableLangs = computed(() =>
  Object.keys(LANGS).filter((k) => props.buildWorkflows[k])
);
const langCfg = computed(() => LANGS[form.value.language] || LANGS.python);
const selectedWorkflow = computed(() => props.buildWorkflows[form.value.language] || null);

function resetForm() {
  const lang = availableLangs.value[0] || "python";
  form.value = {
    language: lang,
    name: "",
    nodeId: props.defaultNodeId || props.computeNodes[0]?.uuid || "",
    requirements: "",
  };
}
watch(visible, (open) => {
  if (open) resetForm();
});

const nameValid = computed(() => NAME_RE.test(form.value.name));
const canSubmit = computed(
  () =>
    !!selectedWorkflow.value &&
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

// Build-workflow node IDs are builder-generated, so resolve by type.
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
    const cfg = langCfg.value;
    const def = await store.dispatch(
      "analysisModule/fetchWorkflowDefinition",
      selectedWorkflow.value.uuid
    );
    const { builder, target, dataSource } = resolveNodes(def && def.dag);
    if (!builder || !target) {
      throw new Error("Build workflow is missing a processor or persistent-layer node.");
    }
    if (dataSource) {
      throw new Error("The environment builder workflow must be data-source-free.");
    }

    await cr.createNodeLayer(form.value.nodeId, {
      layerName: form.value.name,
      layerType: cfg.layerType,
    });

    await store.dispatch("analysisModule/createRun", {
      workflowInstanceConfiguration: {
        workflowId: selectedWorkflow.value.uuid,
        computeNodeId: form.value.nodeId,
      },
      processorParams: {
        [builder]: {
          REQUIREMENTS: form.value.requirements,
          [cfg.versionParam]: cfg.version,
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
  <el-dialog v-model="visible" title="New environment" width="560px">
    <div v-if="availableLangs.length === 0" class="env-warn">
      The environment builder isn’t available yet. (It needs a public
      “Pennsieve - Build Python Environment” / “… Build R Environment” workflow.)
    </div>
    <template v-else>
      <label class="env-label">Language</label>
      <div class="env-langs">
        <button
          v-for="k in ['python', 'r']"
          :key="k"
          type="button"
          class="env-lang"
          :class="{ active: form.language === k, disabled: !buildWorkflows[k] }"
          :disabled="!buildWorkflows[k]"
          @click="form.language = k"
        >
          {{ LANGS[k].label }}
          <span v-if="!buildWorkflows[k]" class="env-lang-note">unavailable</span>
        </button>
      </div>

      <label class="env-label">Name</label>
      <el-input v-model="form.name" placeholder="e.g. my-analysis-stack" size="default" />
      <span class="env-hint" :class="{ err: form.name && !nameValid }">
        Lowercase letters, numbers and dashes.
      </span>

      <div class="env-grid">
        <div>
          <label class="env-label">Compute node</label>
          <el-select v-model="form.nodeId" size="default" style="width: 100%">
            <el-option v-for="n in computeNodes" :key="n.uuid" :label="n.name" :value="n.uuid" />
          </el-select>
        </div>
        <div>
          <label class="env-label">{{ langCfg.versionLabel }}</label>
          <div class="env-version" :title="`Set by the builder — must match the notebook's ${langCfg.versionLabel.toLowerCase()}`">
            {{ langCfg.version }}
          </div>
        </div>
      </div>

      <div class="env-req-head">
        <label class="env-label">{{ langCfg.reqLabel }}</label>
        <label class="env-upload">
          Upload file
          <input type="file" accept=".txt,text/plain" style="display: none" @change="onFile" />
        </label>
      </div>
      <el-input
        v-model="form.requirements"
        type="textarea"
        :rows="9"
        :placeholder="langCfg.reqPlaceholder"
        spellcheck="false"
      />
    </template>

    <template #footer>
      <div class="env-footer">
        <bf-button class="secondary" @click="visible = false">Cancel</bf-button>
        <bf-button :disabled="!canSubmit" :processing="submitting" @click="submit">
          Create environment
        </bf-button>
      </div>
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
.env-langs {
  display: flex;
  gap: 8px;
}
.env-lang {
  flex: 1;
  padding: 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 6px;
  background: theme.$white;
  font-size: 13px;
  color: theme.$gray_6;
  cursor: pointer;

  &.active {
    border-color: theme.$purple_1;
    color: theme.$purple_1;
    font-weight: 500;
  }
  &.disabled {
    color: theme.$gray_4;
    cursor: not-allowed;
  }
}
.env-lang-note {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-left: 6px;
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
.env-version {
  height: 32px;
  display: flex;
  align-items: center;
  padding: 0 11px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$gray_1;
  color: theme.$gray_6;
  font-size: 13px;
}
.env-footer {
  display: flex;
  justify-content: flex-end;
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
