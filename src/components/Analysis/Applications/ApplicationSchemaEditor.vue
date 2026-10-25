<template>
  <div class="application-schema-editor">
    <!-- ───────────── About: tags ───────────── -->
    <template v-if="part === 'tags'">
      <div class="field-row" data-field="application.tags" :class="{ 'has-problem': at('application.tags').length }">
        <label class="field-label">Tags <field-hint text="What the app is for; it colours its card and helps people find it." /></label>
        <div class="field-control">
          <!-- Preferred tags first (a domain's own, colouring the card), then
               the aliases that colour it the same way. -->
          <el-select
            :model-value="schema.tags"
            multiple
            filterable
            allow-create
            default-first-option
            :reserve-keyword="false"
            :filter-method="(q) => (tagQuery = q)"
            placeholder="Pick a preferred tag, or type your own"
            class="full"
            popper-class="tag-options"
            @update:model-value="setTags"
            @visible-change="(open) => open || (tagQuery = '')"
          >
            <template #tag>
              <el-tag
                v-for="t in schema.tags"
                :key="t"
                closable
                disable-transitions
                class="domain-tag-chip"
                :style="tagChipStyle(t)"
                @close="removeTag(t)"
              >{{ t }}</el-tag>
            </template>
            <el-option-group v-if="preferredOptions.length" label="Preferred">
              <el-option v-for="o in preferredOptions" :key="o.tag" :label="o.tag" :value="o.tag">
                <span class="tag-option">
                  <span class="tag-dot" :style="{ background: domainColors(o.domain).accent }" />
                  <svg class="tag-icon" viewBox="0 0 24 24" aria-hidden="true"><path :d="o.domain.icon" /></svg>
                  <span class="tag-name">{{ o.tag }}</span>
                  <span class="tag-meta">{{ o.domain.label }}</span>
                </span>
              </el-option>
            </el-option-group>
            <el-option-group v-if="aliasOptions.length" label="Also recognised">
              <el-option v-for="o in aliasOptions" :key="o.tag" :label="o.tag" :value="o.tag">
                <span class="tag-option tag-option--alias">
                  <span class="tag-name">{{ o.tag }}</span>
                  <span class="tag-meta">→ {{ o.domain.label }}</span>
                </span>
              </el-option>
            </el-option-group>
          </el-select>
          <p v-for="m in at('application.tags')" :key="m" class="field-error">{{ m }}</p>
          <p v-if="tagNudge" class="tag-note">
            Also add <strong>{{ tagNudge.tag }}</strong>, the preferred tag for this domain?
            <button type="button" class="tag-note-action" @click="setTags([...schema.tags, tagNudge.tag])">Add</button>
          </p>
          <p v-else-if="!hasDomainTag(schema.tags)" class="tag-note">
            No domain tag, so the card is grey. Pick one from Preferred.
          </p>
        </div>
      </div>
    </template>

    <!-- ───────────── What it does: inputs, parameters, outputs ───────────── -->
    <template v-else-if="part === 'io'">
      <template v-for="block in ioBlocks" :key="block.key">
        <!-- Parameters, between what goes in and what comes out -->
        <div v-if="block.key === 'parameters'" class="sub-section">
          <h5 class="sub-section-title">
            Parameters <span class="label-helper">optional</span>
            <field-hint text="Settings people choose when they run the app; defaults fill them in." />
          </h5>

          <div
            v-for="(param, index) in schema.parameters"
            :key="`p${index}`"
            class="param-card"
            :data-field="`parameters.${index}`"
          >
            <div class="card-head">
              <span class="card-title">{{ param.name || `Parameter ${index + 1}` }}</span>
              <button type="button" class="app-outline-button" @click="removeParameter(index)">Remove</button>
            </div>
            <div class="param-card-grid">
              <div class="field-row" :data-field="`parameters.${index}.name`" :class="rowClass(`parameters.${index}.name`)">
                <label class="field-label">Name</label>
                <div class="field-control">
                  <el-input
                    :model-value="param.name"
                   
                    placeholder="parameter"
                    maxlength="50"
                    @input="(v) => onParamNameInput(param, v)"
                  />
                  <p v-for="m in at(`parameters.${index}.name`)" :key="m" class="field-error">{{ m }}</p>
                </div>
              </div>

              <div class="field-row" :data-field="`parameters.${index}.type`" :class="rowClass(`parameters.${index}.type`)">
                <label class="field-label">Type</label>
                <div class="field-control">
                  <el-select :model-value="param.type" class="full" @change="(v) => onParamTypeChange(param, v)">
                    <el-option v-for="t in PARAM_TYPE_OPTIONS" :key="t.value" :label="t.label" :value="t.value" />
                  </el-select>
                  <p v-for="m in at(`parameters.${index}.type`)" :key="m" class="field-error">{{ m }}</p>
                </div>
              </div>

              <div class="field-row">
                <label class="field-label">Required</label>
                <div class="field-control">
                  <el-switch v-model="param.required" />
                </div>
              </div>

              <!-- Valid values (enum) -->
              <div
                v-if="param.type === PARAM_TYPES.ENUM"
                class="field-row"
                :data-field="`parameters.${index}.validValues`"
                :class="rowClass(`parameters.${index}.validValues`)"
              >
                <label class="field-label">Valid values</label>
                <div class="field-control">
                  <el-select
                    v-model="param.validValues"
                   
                    multiple
                    filterable
                    allow-create
                    default-first-option
                    :reserve-keyword="false"
                    placeholder="Type a value and press Enter"
                    class="full"
                  />
                  <p v-for="m in at(`parameters.${index}.validValues`)" :key="m" class="field-error">{{ m }}</p>
                </div>
              </div>

              <!-- Default value: control depends on type -->
              <div class="field-row" :data-field="`parameters.${index}.defaultValue`" :class="rowClass(`parameters.${index}.defaultValue`)">
                <label class="field-label">Default</label>
                <div class="field-control">
                  <el-switch v-if="param.type === PARAM_TYPES.BOOLEAN" v-model="param.defaultValue" />
                  <el-input
                    v-else-if="isNumericType(param.type)"
                    v-model="param.defaultValue"
                   
                    type="number"
                    placeholder="No default"
                  />
                  <el-select
                    v-else-if="param.type === PARAM_TYPES.ENUM"
                    v-model="param.defaultValue"
                   
                    clearable
                    placeholder="No default"
                    class="full"
                  >
                    <el-option v-for="v in param.validValues" :key="v" :label="v" :value="v" />
                  </el-select>
                  <el-input v-else v-model="param.defaultValue" placeholder="No default" />
                  <p v-for="m in at(`parameters.${index}.defaultValue`)" :key="m" class="field-error">{{ m }}</p>
                </div>
              </div>

              <div class="field-row full-width" :data-field="`parameters.${index}.description`">
                <label class="field-label">Description</label>
                <div class="field-control">
                  <el-input v-model="param.description" placeholder="What does this parameter control? (optional)" />
                </div>
              </div>

              <!-- Min / Max (number), the advanced part -->
              <more-options
                v-if="isNumericType(param.type)"
                :force-open="hasValue(param.min) || hasValue(param.max) || !!at(`parameters.${index}.min`).length || !!at(`parameters.${index}.max`).length"
              >
                <div class="field-row" :data-field="`parameters.${index}.min`" :class="rowClass(`parameters.${index}.min`)">
                  <label class="field-label">Min</label>
                  <div class="field-control">
                    <el-input v-model="param.min" type="number" placeholder="optional" />
                    <p v-for="m in at(`parameters.${index}.min`)" :key="m" class="field-error">{{ m }}</p>
                  </div>
                </div>
                <div class="field-row" :data-field="`parameters.${index}.max`" :class="rowClass(`parameters.${index}.max`)">
                  <label class="field-label">Max</label>
                  <div class="field-control">
                    <el-input v-model="param.max" type="number" placeholder="optional" />
                    <p v-for="m in at(`parameters.${index}.max`)" :key="m" class="field-error">{{ m }}</p>
                  </div>
                </div>
              </more-options>
            </div>
          </div>

          <button type="button" class="app-outline-button add-row" @click="addParameter">+ Add parameter</button>
        </div>

        <!-- Inputs / Outputs -->
        <div v-else class="sub-section">
          <h5 class="sub-section-title">
            {{ block.label }} <span class="label-helper">optional</span>
            <field-hint :text="block.hint" />
          </h5>

          <div
            v-for="(port, index) in schema[block.key]"
            :key="`${block.key}${index}`"
            class="param-card"
            :data-field="`${block.key}.${index}`"
            :class="{ 'has-problem': at(`${block.key}.${index}`).length }"
          >
            <div class="card-head">
              <span class="card-title">{{ port.name || `${block.singular} ${index + 1}` }}</span>
              <button type="button" class="app-outline-button" @click="removePort(block.key, index)">Remove</button>
            </div>
            <p v-for="m in at(`${block.key}.${index}`)" :key="m" class="field-error">{{ m }}</p>
            <div class="param-card-grid">
              <!-- Name first: the card is about "study", not "input 1" -->
              <div class="field-row full-width" :data-field="`${block.key}.${index}.name`" :class="rowClass(`${block.key}.${index}.name`)">
                <label class="field-label">Name</label>
                <div class="field-control">
                  <el-input v-if="portMode(port) !== 'file' || port.dataType === 'any'" v-model="port.name" :placeholder="portMode(port) === 'layout' ? 'study' : 'files'" maxlength="50" />
                  <span v-else class="field-static" :class="{ 'is-empty': !port.name }">{{ port.name || "Select a media type" }}</span>
                  <p v-for="m in at(`${block.key}.${index}.name`)" :key="m" class="field-error">{{ m }}</p>
                </div>
              </div>

              <!--
                What the input is made of at its root: files, folders of a
                folder format (OME-Zarr), or one folder with a set layout (BIDS).
              -->
              <div class="field-row full-width">
                <label class="field-label">{{ block.key === "inputs" ? "Each item given is" : "Each item written is" }}</label>
                <div class="field-control">
                  <div class="kind-switch" role="radiogroup" :aria-label="`What each ${block.singular} item is`">
                    <button
                      v-for="m in PORT_MODES"
                      :key="m.value"
                      type="button"
                      role="radio"
                      class="kind-option"
                      :class="{ active: portMode(port) === m.value }"
                      :aria-checked="portMode(port) === m.value"
                      @click="setPortMode(port, m.value)"
                    >
                      {{ m.label }}
                    </button>
                  </div>
                  <p class="field-hint">{{ PORT_MODES.find((m) => m.value === portMode(port)).hint }}</p>
                </div>
              </div>

              <!-- A file or a folder: its format -->
              <div v-if="portMode(port) !== 'layout'" class="field-row full-width" :data-field="`${block.key}.${index}.mediaTypes`" :class="rowClass(`${block.key}.${index}.mediaTypes`)">
                <label class="field-label">{{ portMode(port) === "folder" ? "Folder format" : "Media type" }}</label>
                <div class="field-control">
                  <!-- Searchable by format name, extension or media type -->
                  <el-select
                    :model-value="port.dataType"
                    class="full"
                    filterable
                    :filter-method="(q) => (mediaTypeQuery = q)"
                    :placeholder="portMode(port) === 'folder' ? 'e.g. OME-Zarr, MEF3' : 'Search formats, e.g. NWB, .edf'"
                    @visible-change="(open) => open || (mediaTypeQuery = '')"
                    @change="(v) => onPortDataTypeChange(port, v)"
                  >
                    <el-option
                      v-for="dt in formatChoices(port).filter((o) => mediaTypeMatches(o, mediaTypeQuery))"
                      :key="dt.value"
                      :label="dt.formats && dt.formats.length ? `${dt.formats.join(' / ')} (${dt.value})` : dt.label"
                      :value="dt.value"
                    >
                      <span class="mt-option">
                        <span class="mt-name">{{ dt.formats && dt.formats.length ? dt.formats.join(" / ") : dt.label }}</span>
                        <span v-if="dt.formats && dt.formats.length" class="mt-meta">
                          {{ dt.value }}<template v-if="portMode(port) === 'folder' && dt.folderExtensions && dt.folderExtensions.length"> · {{ dt.folderExtensions.map((e) => `*${e}/`).join(", ") }}</template><template v-else-if="dt.extensions && dt.extensions.length"> · {{ dt.extensions.join(", ") }}</template><template v-if="dt.edam"> · EDAM {{ dt.edam }}</template>
                        </span>
                      </span>
                    </el-option>
                  </el-select>
                  <p v-for="m in at(`${block.key}.${index}.mediaTypes`)" :key="m" class="field-error">{{ m }}</p>
                </div>
              </div>

              <!-- One folder with a set layout -->
              <template v-if="portMode(port) === 'layout'">
                <div class="field-row full-width" :data-field="`${block.key}.${index}.conformsTo`">
                  <label class="field-label">Layout</label>
                  <div class="field-control">
                    <!-- A link from app.yml is kept, shown as is; the builder offers registry layouts -->
                    <span v-if="isStructureLink(port.conformsTo[0])" class="field-static">
                      {{ port.conformsTo[0] }} <span class="label-helper">(edit in app.yml)</span>
                    </span>
                    <el-select
                      v-else
                      :model-value="port.conformsTo[0] ? structureId(port.conformsTo[0]) : ''"
                      class="full"
                      filterable
                      :filter-method="(q) => (mediaTypeQuery = q)"
                      placeholder="e.g. BIDS, SPARC SDS"
                      @visible-change="(open) => open || (mediaTypeQuery = '')"
                      @change="(v) => onLayoutChange(port, v)"
                    >
                      <el-option
                        v-for="s in structureOptions.filter((o) => structureMatches(o, mediaTypeQuery))"
                        :key="s.id"
                        :label="s.name"
                        :value="s.id"
                      >
                        <span class="mt-option">
                          <span class="mt-name">{{ s.name }}</span>
                          <span v-if="s.description" class="mt-meta mt-wrap">{{ s.description }}</span>
                        </span>
                      </el-option>
                    </el-select>
                    <p class="field-hint">
                      The folder {{ block.key === "inputs" ? "given" : "written" }} is the root of the layout<template v-if="port.conformsTo[1]">, and {{ structureName(port.conformsTo[1]) }} starts at its {{ contentRootOf(port) }}/ folder</template>.
                    </p>
                  </div>
                </div>
                <!-- Nesting: a layout with a content root (files/) may hold another -->
                <div v-if="contentRootOf(port)" class="field-row full-width">
                  <label class="field-label">Its {{ contentRootOf(port) }}/ folder is laid out as</label>
                  <div class="field-control">
                    <el-select :model-value="port.conformsTo[1] ? structureId(port.conformsTo[1]) : ''" class="full" @change="(v) => onInnerStructure(port, v)">
                      <el-option label="No particular layout" value="" />
                      <el-option v-for="s in structureOptions.filter((o) => o.id !== structureId(port.conformsTo[0]))" :key="s.id" :label="s.name" :value="s.id" />
                    </el-select>
                  </div>
                </div>
                <div class="field-row full-width">
                  <label class="field-label">Files in it <span class="label-helper">optional</span></label>
                  <div class="field-control">
                    <el-select
                      :model-value="port.mediaTypes"
                      class="full"
                      multiple
                      filterable
                      :filter-method="(q) => (mediaTypeQuery = q)"
                      placeholder="Any files"
                      @visible-change="(open) => open || (mediaTypeQuery = '')"
                      @change="(v) => onContainsChange(port, v)"
                    >
                      <el-option
                        v-for="dt in portDataTypes.filter((o) => o.value !== 'any' && mediaTypeMatches(o, mediaTypeQuery))"
                        :key="dt.value"
                        :label="dt.formats && dt.formats.length ? dt.formats.join(' / ') : dt.label"
                        :value="dt.value"
                      />
                    </el-select>
                  </div>
                </div>
                <!-- Folder formats inside the layout: as folders (default) or as stored -->
                <div v-if="showsContainer(port)" class="field-row full-width">
                  <label class="field-label">Folder formats in it are {{ block.key === "inputs" ? "given" : "written" }} as</label>
                  <div class="field-control">
                    <el-select :model-value="containerChoice(port)" class="full" @change="(v) => onContainerChange(port, v)">
                      <el-option label="Folders, as the layout expects" value="directory" />
                      <el-option label="As stored (compressed)" value="file" />
                    </el-select>
                  </div>
                </div>
              </template>

              <div class="field-row full-width" :data-field="`${block.key}.${index}.description`">
                <label class="field-label">Description</label>
                <div class="field-control">
                  <el-input v-if="portMode(port) !== 'file' || port.dataType === 'any'" v-model="port.description" placeholder="What goes here (optional)" />
                  <span v-else class="field-static" :class="{ 'is-empty': !port.description }">{{ port.description || "—" }}</span>
                </div>
              </div>
              <div v-if="block.key === 'inputs'" class="field-row">
                <label class="field-label">Required</label>
                <div class="field-control">
                  <el-switch v-model="port.required" />
                </div>
              </div>
              <!-- EDAM formats come with the media type; any others the app.yml
                   already had are kept, shown here. -->
              <p v-if="extraFormats(port).length" class="field-hint">
                Also from app.yml: {{ extraFormats(port).join(", ") }} (EDAM)
              </p>
            </div>
          </div>

          <button type="button" class="app-outline-button add-row" @click="addPort(block.key)">+ Add {{ block.singular }}</button>
        </div>
      </template>
    </template>

    <!-- ───────────── How it runs: resources and compute types ───────────── -->
    <template v-else-if="part === 'runtime'">
      <component :is="kind === 'interactive' ? MoreOptions : 'div'" v-bind="resourceWrapProps" class="runtime-fields">
        <div class="field-row" data-field="runtime.cpu" :class="rowClass('runtime.cpu')">
          <label class="field-label">CPU</label>
          <div class="field-control">
            <el-select v-model="schema.resources.cpu" placeholder="Choose CPU" class="full" @change="onCpuChange">
              <el-option v-for="opt in STANDARD_CPU_OPTIONS" :key="opt.value" :label="opt.label" :value="Number(opt.value)" />
            </el-select>
            <p v-for="m in at('runtime.cpu')" :key="m" class="field-error">{{ m }}</p>
          </div>
        </div>
        <div class="field-row" data-field="runtime.memory" :class="rowClass('runtime.memory')">
          <label class="field-label">Memory</label>
          <div class="field-control">
            <el-select v-model="schema.resources.memory" :disabled="!schema.resources.cpu" placeholder="Choose CPU first" class="full">
              <el-option v-for="opt in memoryOptions" :key="opt.value" :label="opt.label" :value="Number(opt.value)" />
            </el-select>
            <p v-for="m in at('runtime.memory')" :key="m" class="field-error">{{ m }}</p>
          </div>
        </div>
      </component>

      <!-- Compute types, the advanced part. GPU is one of these. -->
      <more-options :force-open="schema.runtime.computeTypes.length > 1 || !!at('runtime.computeTypes').length" label="More options">
        <div class="field-row full-width" data-field="runtime.computeTypes" :class="rowClass('runtime.computeTypes')">
          <label class="field-label">Compute types</label>
          <div class="field-control">
            <div class="inline-checks">
              <el-checkbox :model-value="true" disabled>Standard</el-checkbox>
              <el-checkbox :model-value="schema.runtime.computeTypes.includes('lambda')" @change="(c) => toggleComputeType('lambda', c)">
                Lambda
              </el-checkbox>
              <el-checkbox :model-value="schema.runtime.computeTypes.includes('gpu')" @change="(c) => toggleComputeType('gpu', c)">
                GPU
              </el-checkbox>
            </div>
            <p v-for="m in at('runtime.computeTypes')" :key="m" class="field-error">{{ m }}</p>
          </div>
        </div>
      </more-options>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, toRaw } from "vue";
import { useStore } from "vuex";
import MoreOptions from "./MoreOptions.vue";
import FieldHint from "./FieldHint.vue";
import { PARAM_TYPES, PARAM_TYPE_OPTIONS, createParameter, createPort, portDataTypeOptions, STANDARD_CPU_OPTIONS, getStandardMemoryOptions, isNumericType, mediaTypeMatches, structureId, structureOptionsFor, structureMatches, isStructureLink, conformsToList } from "./applicationSchema";
import { canonicalTag, preferredTagGroups, tagOptionMatches, tagDomainNudge, hasDomainTag, domainOfTag, domainColors } from "./appDomains";

/**
 * One part of the app manifest builder's form, bound to an ApplicationSchema
 * (applicationSchema.js) it changes in place; the builder owns it and lays the
 * parts out in its sections.
 */
const schema = defineModel({ type: Object, required: true });

const props = defineProps({
  // Which part: "tags" (About), "io" (What it does: inputs, parameters,
  // outputs), "runtime" (How it runs).
  part: { type: String, required: true },
  // "batch" or "interactive" (manifestBuilder.appKind): an interactive app
  // has no parameters, and its resources are only defaults.
  kind: { type: String, default: "batch" },
  // Problems by the field they point at: { "parameters.0.name": ["…"] }.
  problems: { type: Object, default: () => ({}) },
});

const store = useStore();

const at = (key) => props.problems[key] || [];
const rowClass = (key) => ({ "has-problem": at(key).length > 0 });
const hasValue = (v) => v != null && v !== "";

// A typed tag lands on the suggestion it spells ("EEG" -> "eeg"), so the
// same thing gets one tag across apps.
function setTags(tags) {
  schema.value.tags = [...new Set((tags || []).map(canonicalTag).filter(Boolean))];
}
const removeTag = (tag) => setTags(schema.value.tags.filter((t) => t !== tag));

// The tag options, filtered by what's typed; preferred tags also match their
// domain's aliases, so "spike" offers spike-sorting first.
const tagQuery = ref("");
const tagGroups = preferredTagGroups();
const preferredOptions = computed(() => tagGroups.preferred.filter((o) => tagOptionMatches(o, tagQuery.value, { preferred: true })));
const aliasOptions = computed(() => tagGroups.aliases.filter((o) => tagOptionMatches(o, tagQuery.value)));
const tagNudge = computed(() => tagDomainNudge(schema.value.tags || []));
// A chip in its domain's colours, as on the Apps tab; neutral without one.
const tagChipStyle = (tag) => {
  const d = domainOfTag(tag);
  if (!d) return {};
  const c = domainColors(d);
  return { "--el-tag-bg-color": c.bg, "--el-tag-border-color": c.line, "--el-tag-text-color": c.ink };
};

/*
  A port's media type is a platform package format, not a vocabulary this form
  invents: the list comes from GET /packages/formats. Types already written
  into the manifest are kept in the list too, so editing an older app.yml
  cannot quietly blank its ports.
*/
onMounted(() => {
  if (props.part === "io") store.dispatch("analysisModule/fetchPackageFormats");
});

// The media type search, shared by the selects (one is open at a time).
const mediaTypeQuery = ref("");
const portDataTypes = computed(() =>
  portDataTypeOptions(store.state.analysisModule.packageFormats, [
    ...(schema.value.inputs || []).map((p) => p.dataType),
    ...(schema.value.outputs || []).map((p) => p.dataType),
  ])
);

// In, the app's settings, out: as the app card and the workflow graph
// read. An interactive app has no settings of its own.
const PORT_BLOCKS = {
  inputs: {
    key: "inputs",
    label: "Inputs",
    singular: "input",
    hint: "What the app takes in.",
  },
  outputs: {
    key: "outputs",
    label: "Outputs",
    singular: "output",
    hint: "What the app produces.",
  },
};
const ioBlocks = computed(() =>
  props.kind === "interactive"
    ? [PORT_BLOCKS.inputs, PORT_BLOCKS.outputs]
    : [PORT_BLOCKS.inputs, { key: "parameters" }, PORT_BLOCKS.outputs]
);

// An interactive app's CPU and memory are folded away: they're only defaults.
const resourceWrapProps = computed(() =>
  props.kind === "interactive"
    ? {
        label: "Default CPU and memory (sessions are sized when they start)",
        forceOpen: schema.value.resources.cpu != null || !!at("runtime.cpu").length || !!at("runtime.memory").length,
      }
    : {}
);

const memoryOptions = computed(() => getStandardMemoryOptions(schema.value.resources.cpu));

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
  A port's media type is what the author picks. Its name and description are
  the package format's, copied from the option the platform served, and its
  `mediaTypes` is kept in step so a manifest round-trips. With "Any", the
  author names the port.
*/
const optionFor = (value) => portDataTypes.value.find((o) => o.value === value);
// The EDAM formats a port has beyond its media type's (kept from app.yml).
const extraFormats = (port) => {
  const edam = optionFor(port.dataType)?.edam;
  return (port.formats || []).filter((f) => f !== edam);
};
const onPortDataTypeChange = (port, value) => {
  const previous = optionFor(port.dataType)?.edam;
  port.dataType = value || "any";
  const option = optionFor(port.dataType);
  if (port.dataType !== "any") {
    port.name = option?.name || "";
    port.description = option?.description || "";
  }
  port.mediaTypes = port.dataType && port.dataType !== "any" ? [port.dataType] : [];
  // The media type brings its EDAM id; "Any" writes neither. Other formats
  // the app.yml had stay unless the port goes back to any file.
  const kept = (port.formats || []).filter((f) => f !== previous && f !== option?.edam);
  port.formats = port.dataType === "any" ? [] : [...kept, ...(option?.edam ? [option.edam] : [])];
};

/*
  A port is either a file format (a media type) or a whole folder that
  follows a structure (BIDS, app.yml conformsTo). One select offers both.
*/
const structureOptions = computed(() =>
  structureOptionsFor(store.state.analysisModule.packageStructures, [
    ...(schema.value.inputs || []).map((p) => p.conformsTo),
    ...(schema.value.outputs || []).map((p) => p.conformsTo),
  ])
);
/*
  What an input or output is made of at its root, the first thing the card
  asks: files, folders of a folder format (OME-Zarr, as container:
  directory), or one folder with a set layout (BIDS, as conformsTo). The
  mode is read from the port, and remembered while the author hasn't picked
  a format or layout yet.
*/
const PORT_MODES = [
  { value: "file", label: "A file", hint: "Each item is one file: an EDF recording, a DICOM slice, a CSV table. A folder of them is fine, paths are kept." },
  { value: "folder", label: "A folder", hint: "Each item is a folder that is one thing, of a folder format: an .ome.zarr image, a .mefd session." },
  { value: "layout", label: "One folder with a set layout", hint: "The whole input is one folder tree laid out by a standard, such as BIDS or a Pennsieve published dataset." },
];
const chosenModes = reactive(new WeakMap());
const portMode = (port) => {
  if (conformsToList(port.conformsTo).length) return "layout";
  if (port.container === "directory") return "folder";
  return chosenModes.get(toRaw(port)) || "file";
};
const setPortMode = (port, mode) => {
  if (portMode(port) === mode) return;
  chosenModes.set(toRaw(port), mode);
  // Start the new mode clean: what one mode picked means nothing in another.
  port.conformsTo = [];
  port.container = mode === "folder" ? "directory" : "";
  port.dataType = "any";
  port.mediaTypes = [];
  port.formats = [];
};
// A file is any format; a folder only a folder format.
const formatChoices = (port) =>
  portMode(port) === "folder"
    ? portDataTypes.value.filter((o) => o.kind === "directory" || o.value === port.dataType)
    : portDataTypes.value;

const isStructurePort = (port) => portMode(port) === "layout";
const structureById = (id) => structureOptions.value.find((o) => o.id === id);
const structureName = (entry) => structureById(structureId(entry))?.name || entry;
// The content root of the port's outermost registry layout (files/ for a
// published dataset), when it has one: another layout may start there.
const contentRootOf = (port) => {
  const first = conformsToList(port.conformsTo)[0];
  return first && !isStructureLink(first) ? structureById(structureId(first))?.contentRoot || "" : "";
};
const onLayoutChange = (port, id) => {
  // A layout the app.yml named (bids@1.9, with its nesting) is kept as it was.
  if (structureId(conformsToList(port.conformsTo)[0]) !== id) port.conformsTo = id ? [id] : [];
  if (!contentRootOf(port)) port.conformsTo = port.conformsTo.slice(0, 1);
};
const onInnerStructure = (port, id) => {
  port.conformsTo = id ? [port.conformsTo[0], id] : port.conformsTo.slice(0, 1);
};
const onContainsChange = (port, values) => {
  port.mediaTypes = asList(values);
  port.formats = [...new Set(port.mediaTypes.map((v) => optionFor(v)?.edam).filter(Boolean))];
  if (!showsContainer(port)) port.container = "";
};
const asList = (v) => (Array.isArray(v) ? v.map(String) : []);
// Folder formats a layout holds: as folders (its default) or as stored.
const showsContainer = (port) =>
  isStructurePort(port) && (port.container === "file" || asList(port.mediaTypes).some((v) => optionFor(v)?.kind === "directory"));
const containerChoice = (port) => port.container || "directory";
const onContainerChange = (port, value) => {
  port.container = value === "directory" ? "" : value;
};

const onParamTypeChange = (param, type) => {
  param.type = type;
  // A default carried over from another type is usually invalid; reset it.
  param.defaultValue = type === PARAM_TYPES.BOOLEAN ? false : null;
  if (type !== PARAM_TYPES.ENUM) param.validValues = [];
  if (!isNumericType(type)) {
    param.min = null;
    param.max = null;
  }
};

const addParameter = () => schema.value.parameters.push(createParameter());
const removeParameter = (i) => schema.value.parameters.splice(i, 1);

const addPort = (key) => schema.value[key].push(createPort({ required: key === "inputs" ? false : undefined }));
const removePort = (key, i) => schema.value[key].splice(i, 1);
</script>

<style scoped lang="scss">
@use "../../../styles/theme";

.application-schema-editor {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sub-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sub-section-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_6;
}
.label-helper {
  margin-left: 4px;
  font-size: 12px;
  font-weight: 400;
  color: theme.$gray_4;
}

/* A field: its label above, then the control. */
.field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;

  > .field-label {
    font-size: 13px;
    font-weight: 500;
    color: theme.$gray_6;
  }
}
.field-control {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;

  .full {
    width: 100%;
  }
}
/* A field with a problem: marked, its message under it. */
.has-problem :deep(.el-input__wrapper),
.has-problem :deep(.el-select__wrapper) {
  box-shadow: 0 0 0 1px theme.$red_1 inset;
}
.param-card.has-problem {
  border-color: theme.$red_1;
}
.field-error {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: theme.$red_2;
}
.field-hint {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: theme.$gray_4;

  a {
    color: theme.$purple_3;
  }
}

/* Values the form fills in from the selected package format, not fields. */
.field-static {
  font-size: 13px;
  line-height: 28px;
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
  padding-top: 4px;
}

.runtime-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.param-card {
  padding: 12px 14px 14px;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  background: theme.$gray_1;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.card-title {
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_6;
}
.kind-switch {
  display: inline-flex;
  flex-wrap: wrap;
  padding: 2px;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  background: theme.$gray_1;
}
.kind-option {
  padding: 5px 14px;
  border: none;
  border-radius: 4px;
  background: none;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    color: theme.$purple_3;
  }
  &.active {
    background: theme.$white;
    color: theme.$purple_3;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
}
.mt-wrap {
  white-space: normal;
  line-height: 1.35;
}
.param-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 18px;

  .full-width {
    grid-column: 1 / -1;
  }
}

/* The small outline buttons Applications uses. */
.app-outline-button {
  padding: 3px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
}
.add-row {
  align-self: flex-start;
}
.mt-option {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  padding: 4px 0;
}
.mt-name {
  font-size: 13px;
  color: theme.$gray_6;
}
.mt-meta {
  font-size: 11px;
  color: theme.$gray_4;
}
.domain-tag-chip {
  margin: 2px 4px 2px 0;
  border-radius: 3px;
  font-size: 12px;
}
.tag-note {
  margin: 6px 0 0;
  font-size: 12px;
  color: theme.$gray_5;
}
.tag-note-action {
  margin-left: 4px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: theme.$purple_3;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}
</style>

<style lang="scss">
@use "../../../styles/theme";

/* The tag dropdown is teleported, so its option styles can't be scoped. */
.tag-options {
  .tag-option {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .tag-dot {
    width: 8px;
    height: 8px;
    flex-shrink: 0;
    border-radius: 50%;
  }
  .tag-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    fill: none;
    stroke: theme.$gray_5;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .tag-name {
    color: theme.$gray_6;
  }
  .tag-meta {
    margin-left: auto;
    padding-left: 12px;
    font-size: 12px;
    color: theme.$gray_4;
  }
  .tag-option--alias .tag-name {
    color: theme.$gray_5;
  }
}
</style>
