<script setup>
// The Library's facets: scope (and whether to list notebooks), status,
// domain, field, input and output, one section each. Shown in the Library's side panel and, on a phone, in a
// drawer; the Library keeps the values (v-model:<facet>).
import { useId } from "vue";
import { domainColors } from "../Applications/appDomains";
import { FACET_DEFAULTS, INPUT_OPTIONS, STATUS_OPTIONS } from "./galleryFilter";

defineProps({
  scopeOptions: { type: Array, required: true },
  domains: { type: Array, default: () => [] }, // domainOptions
  fields: { type: Array, default: () => [] }, // fieldOptions
  outputs: { type: Array, default: () => [] }, // outputOptions
  // Anything chosen (activeFilters), for Clear all.
  anySet: { type: Boolean, default: false },
  // Offer "Include notebooks" (the Workflows tab's Library).
  notebooksOption: { type: Boolean, default: false },
});
// Ids for the headings, unique to this copy (the panel's or the drawer's).
const uid = useId();
const scope = defineModel("scope", { type: String, required: true });
const domain = defineModel("domain", { type: String, default: "any" });
const field = defineModel("field", { type: String, default: "any" });
const input = defineModel("input", { type: String, default: "any" });
const output = defineModel("output", { type: String, default: "any" });
const status = defineModel("status", { type: String, default: "active" });
const includeNotebooks = defineModel("includeNotebooks", { type: Boolean, default: false });
const emit = defineEmits(["clear-all"]);

// Domain and field are one at a time, as their chips were: ticking one
// unticks the other; ticking it again clears it.
const toggleDomain = (key) => (domain.value = domain.value === key ? "any" : key);
const toggleField = (key) => (field.value = field.value === key ? "any" : key);
const dotStyle = (d) => ({ background: domainColors(d).accent });
</script>

<template>
  <div class="facets">
    <div class="facets-top">
      <span class="facets-title">Filters</span>
      <button v-if="anySet" type="button" class="facet-clear" @click="emit('clear-all')">Clear all</button>
      <!-- The fold button (side panel) or close (drawer) -->
      <slot name="action" />
    </div>

    <section class="facet" :aria-labelledby="`${uid}-scope`">
      <div :id="`${uid}-scope`" class="panel-heading facet-heading">Scope</div>
      <el-radio-group v-model="scope" class="facet-radios" :aria-labelledby="`${uid}-scope`">
        <el-radio v-for="o in scopeOptions" :key="o.value" :value="o.value" size="small">{{ o.label }}</el-radio>
      </el-radio-group>
      <el-checkbox v-if="notebooksOption" v-model="includeNotebooks" size="small" class="facet-check facet-notebooks">
        <span class="facet-label">Include notebooks</span>
      </el-checkbox>
    </section>

    <section class="facet" :aria-labelledby="`${uid}-status`">
      <div class="facet-head">
        <div :id="`${uid}-status`" class="panel-heading facet-heading">Status</div>
        <button v-if="status !== FACET_DEFAULTS.status" type="button" class="facet-clear" @click="status = FACET_DEFAULTS.status">
          Clear
        </button>
      </div>
      <el-radio-group v-model="status" class="facet-radios" :aria-labelledby="`${uid}-status`">
        <el-radio v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value" size="small">{{ o.label }}</el-radio>
      </el-radio-group>
    </section>

    <section v-if="domains.length" class="facet" :aria-labelledby="`${uid}-domain`">
      <div class="facet-head">
        <div :id="`${uid}-domain`" class="panel-heading facet-heading">Domain</div>
        <button v-if="domain !== FACET_DEFAULTS.domain" type="button" class="facet-clear" @click="domain = FACET_DEFAULTS.domain">
          Clear
        </button>
      </div>
      <el-checkbox
        v-for="{ domain: d, count } in domains"
        :key="d.key"
        class="facet-check"
        size="small"
        :model-value="domain === d.key"
        :title="d.subject ? `About ${d.label.toLowerCase()}` : `For ${d.label.toLowerCase()}`"
        @change="toggleDomain(d.key)"
      >
        <span class="facet-dot" :style="dotStyle(d)" />
        <span class="facet-label">{{ d.label }}</span>
        <span class="facet-count">{{ count }}</span>
      </el-checkbox>
    </section>

    <section v-if="fields.length" class="facet" :aria-labelledby="`${uid}-field`">
      <div class="facet-head">
        <div :id="`${uid}-field`" class="panel-heading facet-heading">Field</div>
        <button v-if="field !== FACET_DEFAULTS.field" type="button" class="facet-clear" @click="field = FACET_DEFAULTS.field">
          Clear
        </button>
      </div>
      <el-checkbox
        v-for="{ field: f, count } in fields"
        :key="f.key"
        class="facet-check"
        size="small"
        :model-value="field === f.key"
        @change="toggleField(f.key)"
      >
        <span class="facet-label">{{ f.label }}</span>
        <span class="facet-count">{{ count }}</span>
      </el-checkbox>
    </section>

    <section class="facet" :aria-labelledby="`${uid}-input`">
      <div class="facet-head">
        <div :id="`${uid}-input`" class="panel-heading facet-heading">Input</div>
        <button v-if="input !== FACET_DEFAULTS.input" type="button" class="facet-clear" @click="input = FACET_DEFAULTS.input">
          Clear
        </button>
      </div>
      <el-select v-model="input" size="small" class="facet-select" :aria-labelledby="`${uid}-input`">
        <el-option label="Any input" value="any" />
        <el-option v-for="o in INPUT_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
    </section>

    <section class="facet" :aria-labelledby="`${uid}-output`">
      <div class="facet-head">
        <div :id="`${uid}-output`" class="panel-heading facet-heading">Output</div>
        <button v-if="output !== FACET_DEFAULTS.output" type="button" class="facet-clear" @click="output = FACET_DEFAULTS.output">
          Clear
        </button>
      </div>
      <el-select v-model="output" size="small" class="facet-select" :aria-labelledby="`${uid}-output`">
        <el-option label="Any output" value="any" />
        <el-option v-for="o in outputs" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
    </section>

  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";
@use "../WorkflowBuilder/sidePanel";

.facets {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 13px;
}
/* As the builder's inspector header: a small title, the fold on the right. */
.facets-top {
  display: flex;
  align-items: center;
  gap: 8px;
  /* As tall as the search beside it, so the panel and the list start level. */
  min-height: 40px;
}
.facets-title {
  margin-right: auto;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_5;
}
.facet {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.facet-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.facet-heading {
  padding-left: 0;
}
.facet-clear {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  color: theme.$link-color;
  cursor: pointer;

  &:hover {
    color: theme.$link-color-hover;
  }
}
/* As the builder's palette rows: 13px text, 28px rows, small boxes. */
.facet-radios {
  display: flex;
  flex-direction: column;
  align-items: stretch;

  .el-radio {
    height: 28px;
    margin-right: 0;
  }
  :deep(.el-radio__label) {
    font-size: 13px;
    color: theme.$gray_6;
  }
}
/* A checkbox per option: the label fills the row, its count on the right. */
.facet-check {
  display: flex;
  height: 28px;
  margin-right: 0;

  :deep(.el-checkbox__label) {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 13px;
    color: theme.$gray_6;
  }
}
.facet-notebooks {
  margin-top: 2px;
}
.facet-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
}
.facet-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.facet-count {
  margin-left: auto;
  font-size: 12px;
  color: theme.$gray_4;
}
.facet-select {
  width: 100%;
  margin-top: 2px;
}
</style>
