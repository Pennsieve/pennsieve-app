<script setup>
// Builds a Python or R environment from a requirements list, in environments-
// service. A new name is a new environment; editing one (initial.name) builds
// its next version, and a failed build is retried the same way. With the
// same requirements as a ready version, that version is reused and nothing is
// built. The environment is the user's, on no node: any notebook of theirs
// can switch to it from its sidebar.
import { ref, computed, watch } from "vue";
import { ElMessage } from "element-plus";
import BfButton from "../../shared/bf-button/BfButton.vue";
import { createEnvironment, ENVIRONMENT_LANGUAGES, ENVIRONMENT_NAME, requirementsProblem } from "@/utils/environmentsService";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // An edit or a retry: { name, language, requirements, retry }. Its name
  // and language are kept.
  initial: { type: Object, default: null },
  // Names of the user's environments, so a new one can't take one.
  takenNames: { type: Array, default: () => [] },
});
// created({ environment, version, reused })
const emit = defineEmits(["update:modelValue", "created"]);

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

// Each language's builder version: environments run on notebooks with the
// same one.
const LANGUAGES = Object.entries(ENVIRONMENT_LANGUAGES).map(([id, l]) => ({ id, ...l }));
const HINTS = {
  python: {
    label: "Packages (requirements.txt)",
    placeholder: "numpy\npandas==3.1.0\nmatplotlib\nscikit-learn",
    hint: "One package per line, as pip takes them. Versions are optional.",
  },
  r: {
    label: "Packages",
    placeholder: "tidyverse\ndata.table\nbioc::DESeq2",
    hint: "One package name per line; bioc:: before a Bioconductor package. CRAN packages come from the R notebooks' dated snapshot, so no versions.",
  },
};

const form = ref({ name: "", language: "python", requirements: "" });
const submitting = ref(false);
const touched = ref(false);
const editing = computed(() => !!props.initial?.name);

watch(visible, (open) => {
  if (!open) return;
  form.value = {
    name: props.initial?.name || "",
    language: props.initial?.language || "python",
    requirements: props.initial?.requirements || "",
  };
  touched.value = false;
});

const nameValid = computed(() => ENVIRONMENT_NAME.test(form.value.name));
const nameTaken = computed(() => !editing.value && props.takenNames.includes(form.value.name));
const reqProblem = computed(() => requirementsProblem(form.value.requirements, form.value.language));
const hints = computed(() => HINTS[form.value.language]);
const canSubmit = computed(() => nameValid.value && !nameTaken.value && !reqProblem.value && !submitting.value);

const title = computed(() =>
  props.initial?.retry ? `Retry ${props.initial.name}` : editing.value ? `New version of ${props.initial.name}` : "New environment"
);

function onFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    form.value.requirements = String(reader.result || "");
    touched.value = true;
  };
  reader.readAsText(file);
  e.target.value = "";
}

async function submit() {
  touched.value = true;
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    const out = await createEnvironment({ name: form.value.name, language: form.value.language, requirements: form.value.requirements });
    const n = out.version?.version;
    ElMessage.success(
      out.reused
        ? `Version ${n} of ${form.value.name} already has these packages.`
        : `Building ${form.value.name}${n > 1 ? ` version ${n}` : ""}. This usually takes a minute or two.`
    );
    visible.value = false;
    emit("created", out);
  } catch (err) {
    ElMessage.error(
      err?.status === 409
        ? `${form.value.name} is already building. Wait for it to finish, then try again.`
        : err?.message || "Could not start the build."
    );
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="title" width="560px" :close-on-click-modal="false">
    <label class="env-label" for="env-name">Name</label>
    <el-input id="env-name" v-model="form.name" placeholder="e.g. my-analysis-stack" :disabled="editing" />
    <span v-if="nameTaken" class="env-hint err">
      You already have an environment called "{{ form.name }}". Choose another name, or edit that one's packages.
    </span>
    <span v-else-if="editing" class="env-hint">
      Builds a new version. Notebooks using an earlier version keep it until they switch.
    </span>
    <span v-else class="env-hint" :class="{ err: form.name && !nameValid }">
      Lowercase letters, numbers and dashes, starting with a letter or number.
    </span>

    <label class="env-label">Language</label>
    <el-radio-group v-model="form.language" :disabled="editing" size="small">
      <el-radio-button v-for="l in LANGUAGES" :key="l.id" :value="l.id" :title="`Built for the notebooks' ${l.label}`">
        {{ l.label }} {{ l.version }}
      </el-radio-button>
    </el-radio-group>

    <div class="env-req-head">
      <label class="env-label" for="env-reqs">{{ hints.label }}</label>
      <label class="env-upload">
        Upload file
        <input type="file" accept=".txt,text/plain" style="display: none" @change="onFile" />
      </label>
    </div>
    <el-input
      id="env-reqs"
      v-model="form.requirements"
      type="textarea"
      :rows="9"
      :placeholder="hints.placeholder"
      spellcheck="false"
      @blur="touched = true"
    />
    <span v-if="touched && reqProblem" class="env-hint err">{{ reqProblem }}</span>
    <span v-else class="env-hint">{{ hints.hint }}</span>

    <template #footer>
      <div class="env-footer">
        <bf-button class="secondary" @click="visible = false">Cancel</bf-button>
        <bf-button :disabled="!canSubmit" :processing="submitting" @click="submit">
          {{ initial?.retry ? "Retry build" : editing ? "Build new version" : "Create environment" }}
        </bf-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.env-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: theme.$gray_6;
  margin: 12px 0 4px;
}
.env-label:first-child {
  margin-top: 0;
}
.env-hint {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: theme.$gray_4;

  &.err {
    color: theme.$red_1;
  }
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
