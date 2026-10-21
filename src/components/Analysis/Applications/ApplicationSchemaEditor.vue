<template>
  <div class="application-schema-editor">
    <!-- ───────────── Resources & Runtime ───────────── -->
    <section v-if="showRuntime" class="schema-section">
      <h4 class="schema-section-title">Resources &amp; Runtime</h4>

      <div class="field-row">
        <label class="field-label">CPU</label>
        <el-select
          v-model="schema.resources.cpu"
          class="field-control"
          placeholder="Choose CPU"
          @change="onCpuChange"
        >
          <el-option
            v-for="opt in STANDARD_CPU_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="Number(opt.value)"
          />
        </el-select>
      </div>

      <div class="field-row">
        <label class="field-label">Memory</label>
        <el-select
          v-model="schema.resources.memory"
          class="field-control"
          :disabled="!schema.resources.cpu"
          placeholder="Select CPU before Memory"
        >
          <el-option
            v-for="opt in memoryOptions"
            :key="opt.value"
            :label="opt.label"
            :value="Number(opt.value)"
          />
        </el-select>
      </div>

      <!-- GPU is one of these, not a block of its own. -->
      <div class="field-row">
        <label class="field-label">Compute Types</label>
        <div class="field-control inline-checks">
          <el-checkbox :model-value="true" disabled>Standard</el-checkbox>
          <el-checkbox
            :model-value="schema.runtime.computeTypes.includes('lambda')"
            @change="(checked) => toggleComputeType('lambda', checked)"
          >
            Lambda
          </el-checkbox>
          <el-checkbox
            :model-value="schema.runtime.computeTypes.includes('gpu')"
            @change="(checked) => toggleComputeType('gpu', checked)"
          >
            GPU
          </el-checkbox>
        </div>
      </div>
    </section>

    <!-- ───────────── Parameters ───────────── -->
    <section class="schema-section">
      <h4 class="schema-section-title">
        Parameters <span class="label-helper">optional</span>
      </h4>
      <p class="schema-section-hint">
        Define the parameters this application accepts. Defaults set here
        pre-populate the value when the application is added to a workflow.
      </p>

      <div
        v-for="(param, index) in schema.parameters"
        :key="index"
        class="param-card"
      >
        <div class="param-card-grid">
          <div class="field-row">
            <label class="field-label">Name</label>
            <el-input
              :model-value="param.name"
              size="small"
              placeholder="parameter"
              maxlength="50"
              class="field-control"
              @input="(v) => onParamNameInput(param, v)"
            />
          </div>

          <div class="field-row">
            <label class="field-label">Type</label>
            <el-select
              :model-value="param.type"
              size="small"
              class="field-control"
              @change="(v) => onParamTypeChange(param, v)"
            >
              <el-option
                v-for="t in PARAM_TYPE_OPTIONS"
                :key="t.value"
                :label="t.label"
                :value="t.value"
              />
            </el-select>
          </div>

          <div class="field-row">
            <label class="field-label">Required</label>
            <div class="field-control">
              <el-switch v-model="param.required" />
            </div>
          </div>

          <!-- Valid values (enum) -->
          <div v-if="param.type === PARAM_TYPES.ENUM" class="field-row">
            <label class="field-label">Valid Values</label>
            <el-select
              v-model="param.validValues"
              size="small"
              multiple
              filterable
              allow-create
              default-first-option
              :reserve-keyword="false"
              placeholder="Type a value and press Enter"
              class="field-control"
            />
          </div>

          <!-- Min / Max (number) -->
          <template v-if="param.type === PARAM_TYPES.NUMBER">
            <div class="field-row">
              <label class="field-label">Min</label>
              <el-input
                v-model="param.min"
                size="small"
                type="number"
                placeholder="optional"
                class="field-control"
              />
            </div>
            <div class="field-row">
              <label class="field-label">Max</label>
              <el-input
                v-model="param.max"
                size="small"
                type="number"
                placeholder="optional"
                class="field-control"
              />
            </div>
          </template>

          <!-- Default value: control depends on type -->
          <div class="field-row">
            <label class="field-label">Default</label>
            <el-switch
              v-if="param.type === PARAM_TYPES.BOOLEAN"
              v-model="param.defaultValue"
            />
            <el-input
              v-else-if="param.type === PARAM_TYPES.NUMBER"
              v-model="param.defaultValue"
              size="small"
              type="number"
              placeholder="No default"
              class="field-control"
            />
            <el-select
              v-else-if="param.type === PARAM_TYPES.ENUM"
              v-model="param.defaultValue"
              size="small"
              clearable
              placeholder="No default"
              class="field-control"
            >
              <el-option
                v-for="v in param.validValues"
                :key="v"
                :label="v"
                :value="v"
              />
            </el-select>
            <el-input
              v-else
              v-model="param.defaultValue"
              size="small"
              placeholder="No default"
              class="field-control"
            />
          </div>

          <div class="field-row full-width">
            <label class="field-label">Description</label>
            <el-input
              v-model="param.description"
              size="small"
              placeholder="What does this parameter control? (optional)"
              class="field-control"
            />
          </div>
        </div>

        <button
          class="row-remove-btn"
          title="Remove parameter"
          @click.prevent="removeParameter(index)"
        >
          <el-icon><CircleClose /></el-icon>
        </button>
      </div>

      <el-button class="add-row-btn" plain type="primary" @click="addParameter">
        Add parameter <el-icon class="el-icon--right"><Plus /></el-icon>
      </el-button>
    </section>

    <!-- ───────────── Inputs / Outputs ───────────── -->
    <section v-for="kind in portKinds" :key="kind.key" class="schema-section">
      <h4 class="schema-section-title">
        {{ kind.label }} <span class="label-helper">optional</span>
      </h4>
      <p class="schema-section-hint">{{ kind.hint }}</p>

      <div
        v-for="(port, index) in schema[kind.key]"
        :key="index"
        class="param-card"
      >
        <div class="param-card-grid">
          <div class="field-row">
            <label class="field-label">Media Type</label>
            <el-select
              :model-value="port.dataType"
              size="small"
              class="field-control"
              @change="(v) => onPortDataTypeChange(port, v)"
            >
              <el-option
                v-for="dt in portDataTypes"
                :key="dt.value"
                :label="dt.label"
                :value="dt.value"
              />
            </el-select>
          </div>
          <div v-if="kind.key === 'inputs'" class="field-row">
            <label class="field-label">Required</label>
            <div class="field-control">
              <el-switch v-model="port.required" />
            </div>
          </div>
          <!--
            Name and description are not authored here: they come from the
            package format the selected media type belongs to, and are shown
            read-only so the author can see what will be written to app.yml.
          -->
          <div class="field-row full-width">
            <label class="field-label">Name</label>
            <span class="field-static" :class="{ 'is-empty': !port.name }">
              {{ port.name || "Select a media type" }}
            </span>
          </div>
          <div class="field-row full-width">
            <label class="field-label">Description</label>
            <span
              class="field-static"
              :class="{ 'is-empty': !port.description }"
            >
              {{ port.description || "—" }}
            </span>
          </div>
        </div>
        <button
          class="row-remove-btn"
          :title="`Remove ${kind.singular}`"
          @click.prevent="removePort(kind.key, index)"
        >
          <el-icon><CircleClose /></el-icon>
        </button>
      </div>

      <el-button
        class="add-row-btn"
        plain
        type="primary"
        @click="addPort(kind.key)"
      >
        Add {{ kind.singular }}
        <el-icon class="el-icon--right"><Plus /></el-icon>
      </el-button>
    </section>

    <!-- ───────────── Tags ───────────── -->
    <section class="schema-section">
      <h4 class="schema-section-title">Classification</h4>

      <div class="field-row">
        <label class="field-label">Tags</label>
        <el-select
          v-model="schema.tags"
          class="field-control"
          multiple
          filterable
          allow-create
          default-first-option
          :reserve-keyword="false"
          placeholder="Type a tag and press Enter"
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useStore } from "vuex";
import { CircleClose, Plus } from "@element-plus/icons-vue";
import {
  PARAM_TYPES,
  PARAM_TYPE_OPTIONS,
  createParameter,
  createPort,
  portDataTypeOptions,
  STANDARD_CPU_OPTIONS,
  getStandardMemoryOptions,
} from "./applicationSchema";

/**
 * v-model is an ApplicationSchema (see applicationSchema.js). The component
 * mutates the bound object in place; the parent owns it.
 */
const schema = defineModel({ type: Object, required: true });

defineProps({
  // Hide the CPU/Memory/Compute/GPU block when the host form owns runtime
  // configuration itself (e.g. an edit flow that can't change resources).
  showRuntime: { type: Boolean, default: true },
});

const store = useStore();

/*
  A port's media type is a platform package format, not a vocabulary this form
  invents: the list comes from GET /packages/formats. Types already written
  into the manifest are kept in the list too, so editing an older app.yml
  cannot quietly blank its ports.
*/
onMounted(() => store.dispatch("analysisModule/fetchPackageFormats"));

const portDataTypes = computed(() =>
  portDataTypeOptions(store.state.analysisModule.packageFormats, [
    ...(schema.value.inputs || []).map((p) => p.dataType),
    ...(schema.value.outputs || []).map((p) => p.dataType),
  ]),
);

const portKinds = [
  {
    key: "inputs",
    label: "Inputs",
    singular: "input",
    hint: "Data this application consumes. Used to validate connections between applications in a workflow.",
  },
  {
    key: "outputs",
    label: "Outputs",
    singular: "output",
    hint: "Data this application produces, made available to downstream applications.",
  },
];

const memoryOptions = computed(() =>
  getStandardMemoryOptions(schema.value.resources.cpu),
);

const onCpuChange = () => {
  // Memory choices depend on CPU; clear a now-invalid selection.
  schema.value.resources.memory = null;
};

const toggleComputeType = (type, checked) => {
  const types = new Set(schema.value.runtime.computeTypes);
  if (checked) types.add(type);
  else types.delete(type);
  // Standard is always supported and is not user-removable.
  types.add("standard");
  schema.value.runtime.computeTypes = Array.from(types);
};

/*
  Parameter names are referenced by the running application, so they must be
  single tokens. Whitespace is stripped as it is typed (or pasted) rather than
  flagged after the fact.
*/
const onParamNameInput = (param, value) => {
  param.name = String(value ?? "").replace(/\s+/g, "");
};

/*
  A port's media type is the only thing the author picks. Its name and
  description are the package format's, copied from the option the platform
  served, and its `mediaTypes` is kept in step so a manifest round-trips.
*/
const onPortDataTypeChange = (port, value) => {
  port.dataType = value || "any";
  const option = portDataTypes.value.find((o) => o.value === port.dataType);
  port.name = option?.name || "";
  port.description = option?.description || "";
  port.mediaTypes = port.dataType && port.dataType !== "any" ? [port.dataType] : [];
};

const onParamTypeChange = (param, type) => {
  param.type = type;
  // A default carried over from another type is usually invalid; reset it.
  param.defaultValue = type === PARAM_TYPES.BOOLEAN ? false : null;
  if (type !== PARAM_TYPES.ENUM) param.validValues = [];
  if (type !== PARAM_TYPES.NUMBER) {
    param.min = null;
    param.max = null;
  }
};

const addParameter = () => schema.value.parameters.push(createParameter());
const removeParameter = (i) => schema.value.parameters.splice(i, 1);

const addPort = (key) =>
  schema.value[key].push(createPort({ required: key === "inputs" ? false : undefined }));
const removePort = (key, i) => schema.value[key].splice(i, 1);
</script>

<style scoped lang="scss">
@use "../../../styles/theme";

.application-schema-editor {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.schema-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.schema-section-title {
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
  margin: 0;

  .label-helper {
    font-size: 12px;
    font-weight: 400;
    color: theme.$gray_4;
    margin-left: 6px;
  }
}

.schema-section-hint {
  font-size: 12px;
  color: theme.$gray_5;
  margin: 0 0 4px;
  line-height: 1.4;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 12px;

  &.sub-field {
    padding-left: 16px;
  }

  &.full-width {
    align-items: flex-start;
  }
}

.field-label {
  flex: 0 0 110px;
  font-size: 13px;
  color: theme.$gray_6;
}

.field-control {
  flex: 1 1 auto;
  width: 100%;
}

/* Values the form fills in from the selected package format, not fields. */
.field-static {
  flex: 1 1 auto;
  font-size: 13px;
  line-height: 24px;
  color: theme.$gray_6;
  word-break: break-word;

  &.is-empty {
    color: theme.$gray_4;
    font-style: italic;
  }
}

.inline-checks {
  display: flex;
  gap: 20px;
}

.param-card {
  position: relative;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  padding: 14px 40px 14px 14px;
  background: theme.$gray_1;
}

.param-card + .param-card {
  margin-top: 10px;
}

.param-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 18px;

  .full-width {
    grid-column: 1 / -1;
  }
}

.row-remove-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: theme.$gray_4;
  padding: 2px;

  &:hover {
    color: theme.$red_1;
  }
}

.add-row-btn {
  width: 100%;
  margin-top: 6px;
}
</style>
