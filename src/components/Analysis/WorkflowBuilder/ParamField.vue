<script setup>
// One parameter of a step, with the control its app.yml declares: choices
// (validValues) as a dropdown, a number (with min/max) as a number field, a
// boolean as a switch, else text. The description is its help; the default
// shows until it's overridden, with Reset to default. One with no default is
// required: set here, or when the workflow runs. Values are strings, as the
// workflow stores them; an empty override means "use the default".
import { computed } from "vue";

const props = defineProps({
  // { name, type, description, defaultValue, validValues, required, min, max }
  param: { type: Object, required: true },
  // The workflow's override, or undefined for the default.
  modelValue: { type: [String, Number, Boolean], default: undefined },
  editable: { type: Boolean, default: true },
});
const emit = defineEmits(["update:modelValue"]);

const type = computed(() => {
  if ((props.param.validValues || []).length) return "choice";
  const t = String(props.param.type || "").toLowerCase();
  if (t === "boolean" || t === "bool") return "boolean";
  if (t === "number" || t === "integer" || t === "float" || t === "int") return "number";
  return "text";
});
const hasDefault = computed(() => props.param.defaultValue != null && props.param.defaultValue !== "");
const overridden = computed(() => props.modelValue != null && props.modelValue !== "");
// app.yml's convention: a parameter with no default is required.
const required = computed(() => !hasDefault.value);
const shownValue = computed(() => (overridden.value ? String(props.modelValue) : hasDefault.value ? String(props.param.defaultValue) : ""));

function set(value) {
  emit("update:modelValue", value == null || value === "" ? undefined : String(value));
}
const boolValue = computed(() => shownValue.value === "true");
const numberError = computed(() => {
  if (type.value !== "number" || !overridden.value) return "";
  const n = Number(props.modelValue);
  if (!Number.isFinite(n)) return "Must be a number";
  if (props.param.min != null && n < Number(props.param.min)) return `At least ${props.param.min}`;
  if (props.param.max != null && n > Number(props.param.max)) return `At most ${props.param.max}`;
  return "";
});
</script>

<template>
  <div class="pf">
    <div class="pf-head">
      <label class="pf-name" :for="`pf-${param.name}`">{{ param.label || param.name }}</label>
      <el-tooltip v-if="required && !overridden" content="No default: set it here, or when the workflow runs" placement="left">
        <span class="pf-required">required</span>
      </el-tooltip>
      <button v-if="editable && overridden && hasDefault" type="button" class="pf-reset" @click="set(undefined)">
        Reset to default
      </button>
    </div>
    <p v-if="param.description" class="pf-help">{{ param.description }}</p>

    <template v-if="editable">
      <el-select
        v-if="type === 'choice'"
        :id="`pf-${param.name}`"
        :model-value="overridden ? String(modelValue) : ''"
        size="small"
        clearable
        :placeholder="hasDefault ? `Default: ${param.defaultValue}` : 'Choose…'"
        class="pf-control"
        @update:model-value="set"
      >
        <el-option v-for="v in param.validValues" :key="v" :label="v" :value="v" />
      </el-select>
      <div v-else-if="type === 'boolean'" class="pf-switch">
        <el-switch :id="`pf-${param.name}`" :model-value="boolValue" size="small" @update:model-value="(v) => set(v ? 'true' : 'false')" />
        <span class="pf-switch-label">{{ boolValue ? "On" : "Off" }}<template v-if="!overridden && hasDefault"> (default)</template></span>
      </div>
      <el-input
        v-else
        :id="`pf-${param.name}`"
        :model-value="overridden ? String(modelValue) : ''"
        size="small"
        :type="type === 'number' ? 'number' : 'text'"
        :min="param.min"
        :max="param.max"
        :placeholder="hasDefault ? `Default: ${param.defaultValue}` : 'Required: set here or when running'"
        class="pf-control"
        @update:model-value="set"
      />
      <p v-if="numberError" class="pf-error">{{ numberError }}</p>
    </template>
    <span v-else class="pf-value">{{ shownValue || "—" }}<template v-if="!overridden && hasDefault"> (default)</template></span>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.pf {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 0;
}
.pf-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pf-name {
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_6;
}
.pf-required {
  padding: 0 5px;
  border-radius: 3px;
  background: rgba(245, 158, 11, 0.15);
  font-size: 10px;
  font-weight: 600;
  color: #92400e;
}
.pf-reset {
  margin-left: auto;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 11px;
  color: theme.$link-color;
  cursor: pointer;

  &:hover {
    color: theme.$link-color-hover;
  }
}
.pf-help {
  margin: 0;
  font-size: 11px;
  line-height: 1.35;
  color: theme.$gray_4;
}
.pf-control {
  width: 100%;
}
.pf-switch {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pf-switch-label,
.pf-value {
  font-size: 12px;
  color: theme.$gray_5;
}
.pf-error {
  margin: 0;
  font-size: 11px;
  color: theme.$red_2;
}
</style>
