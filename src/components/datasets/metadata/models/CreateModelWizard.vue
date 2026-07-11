<template>
  <el-dialog v-model="dialogVisible" :show-close="false" width="720px" class="create-model-wizard">
    <template #header>
      <bf-dialog-header title="Create model" />
    </template>

    <dialog-body>
      <el-steps :active="stepIndex" finish-status="success" align-center class="cmw-steps">
        <el-step v-for="s in steps" :key="s.key" :title="s.title" />
      </el-steps>

      <div v-if="stepHelp" class="cmw-instruction">
        <span class="cmw-instruction-icon"><component :is="stepIcon" :width="34" :height="34" /></span>
        <p class="cmw-instruction-text">{{ stepHelp }}</p>
      </div>

      <!-- START -->
      <div v-show="currentKey === 'start'" class="cmw-step">
        <div class="cmw-q">How do you want to start?</div>
        <div class="cmw-cards">
          <div :class="['cmw-card', { active: startMode === 'template' }]" @click="setStart('template')">
            <div class="cmw-card-title"><el-icon><Files /></el-icon> From a template</div>
            <div class="cmw-card-desc">Start from a reusable schema and adjust its properties.</div>
          </div>
          <div :class="['cmw-card', { active: startMode === 'scratch' }]" @click="setStart('scratch')">
            <div class="cmw-card-title"><el-icon><EditPen /></el-icon> From scratch</div>
            <div class="cmw-card-desc">Build the model property by property.</div>
          </div>
        </div>
      </div>

      <!-- TEMPLATE (choose one) -->
      <div v-show="currentKey === 'template'" class="cmw-step">
        <div class="cmw-select">
          <el-input v-model="templateFilter" placeholder="Filter templates" clearable>
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <div v-if="templatesLoading" class="cmw-status">Loading templates…</div>
          <div v-else-if="templatesError" class="cmw-status cmw-error">{{ templatesError }}</div>
          <ul v-else-if="filteredTemplates.length" class="cmw-tpl-list">
            <li
              v-for="t in filteredTemplates"
              :key="t.id"
              :class="['cmw-tpl', { active: selectedTemplateId === t.id }]"
              @click="chooseTemplate(t)"
            >
              <span class="cmw-tpl-name">{{ t.display_name || t.name }}</span>
              <span class="cmw-tpl-meta">{{ templatePropCount(t) }} properties</span>
            </li>
          </ul>
          <div v-else class="cmw-status">No templates available</div>
        </div>
      </div>

      <!-- DETAILS -->
      <div v-show="currentKey === 'details'" class="cmw-step">
        <el-form label-position="top">
          <el-form-item label="Display name">
            <el-input v-model="details.displayName" placeholder="e.g. Participant" @input="onDisplayNameInput" />
          </el-form-item>
          <el-form-item label="Model name">
            <el-input v-model="details.name" placeholder="participant" />
          </el-form-item>
          <el-form-item label="Description">
            <el-input v-model="details.description" type="textarea" :rows="2" />
          </el-form-item>
        </el-form>
      </div>

      <!-- PROPERTIES -->
      <div v-show="currentKey === 'properties'" class="cmw-step">
        <div class="cmw-props-head">
          <span class="cmw-q">Properties</span>
          <el-button size="small" @click="addVisible = true">
            <el-icon><Plus /></el-icon> Add property
          </el-button>
        </div>

        <div v-if="!properties.length" class="cmw-empty">
          No properties yet. Add common data elements, a bundle, or define them manually.
        </div>
        <ul v-else class="cmw-prop-list">
          <li v-for="(p, i) in properties" :key="i" class="cmw-prop">
            <div class="cmw-prop-main">
              <span class="cmw-prop-name">{{ p.propertyName }}</span>
              <span class="cmw-prop-meta">{{ propMeta(p) }}</span>
            </div>
            <el-button text size="small" @click="removeProperty(i)"><el-icon><Close /></el-icon></el-button>
          </li>
        </ul>
      </div>

      <!-- SAVE AS -->
      <div v-show="currentKey === 'save'" class="cmw-step">
        <div class="cmw-summary">
          {{ details.name }} · {{ properties.length }} propert{{ properties.length === 1 ? 'y' : 'ies' }}
        </div>
        <div class="cmw-label">Finish</div>
        <el-radio-group v-model="finishMode" @change="onFinishModeChange">
          <el-radio value="model">Create model — add it to this dataset now</el-radio>
          <el-radio value="advanced">Advanced — edit the JSON Schema before saving</el-radio>
        </el-radio-group>

        <div v-if="finishMode === 'advanced'" class="cmw-json">
          <el-input
            ref="jsonEditor"
            v-model="jsonContent"
            type="textarea"
            :rows="16"
            spellcheck="false"
            placeholder="JSON Schema…"
            @input="validateJson"
            @keydown="onJsonKeydown"
          />
          <div v-if="jsonError" class="cmw-error">{{ jsonError }}</div>
        </div>

        <div v-if="createError" class="cmw-error">{{ createError }}</div>
      </div>
    </dialog-body>

    <template #footer>
      <el-button @click="cancel">Cancel</el-button>
      <el-button v-if="stepIndex > 0" @click="stepIndex -= 1">Back</el-button>
      <el-button v-if="!isLastStep" type="primary" :disabled="!canAdvance" @click="next">Continue</el-button>
      <el-button v-else type="primary" :loading="creating" :disabled="!canCreate" @click="create">
        Create model
      </el-button>
    </template>

    <!-- Nested: reuse the add-property wizard to build each property -->
    <AddPropertyWizard v-model:visible="addVisible" :existing-properties="propertyNames" @save="onPropsAdded" />
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Close, Files, EditPen, Search } from '@element-plus/icons-vue'
import BfDialogHeader from '@/components/shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '@/components/shared/dialog-body/DialogBody.vue'
import AddPropertyWizard from '@/components/datasets/metadata/models/AddPropertyWizard.vue'
import IconGuide from '@/components/icons/IconGuide.vue'
import IconAddTemplate from '@/components/icons/IconAddTemplate.vue'
import IconDocument from '@/components/icons/IconDocument.vue'
import IconToolbarListBulleted from '@/components/icons/IconToolbarListBulleted.vue'
import IconDoneCheckCircle from '@/components/icons/IconDoneCheckCircle.vue'
import { useMetadataStore } from '@/stores/metadataStore.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  datasetId: { type: String, default: '' },
  orgId: { type: String, default: '' },
})
const emit = defineEmits(['update:visible', 'created', 'cancel'])

const metadataStore = useMetadataStore()

const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const stepIndex = ref(0)
const startMode = ref('') // '' | 'template' | 'scratch'

// Template picker
const templatesList = ref([])
const templatesLoading = ref(false)
const templatesError = ref('')
const templateFilter = ref('')
const selectedTemplateId = ref('')

// Model details + properties
const details = reactive({ name: '', displayName: '', description: '' })
const properties = ref([]) // [{ propertyName, propertySchema, required }]
const addVisible = ref(false)
const finishMode = ref('model') // 'model' | 'advanced'
const creating = ref(false)
const createError = ref('')

// Inline "Advanced" JSON Schema editor (mirrors ModelSpecGenerator's JSON mode).
const jsonContent = ref('')
const jsonError = ref('')
const jsonEditor = ref(null)

const propertyNames = computed(() => properties.value.map((p) => p.propertyName))
const filteredTemplates = computed(() => {
  const f = templateFilter.value.trim().toLowerCase()
  return f
    ? templatesList.value.filter((t) => (t.display_name || t.name || '').toLowerCase().includes(f))
    : templatesList.value
})

const steps = computed(() => {
  const start = { key: 'start', title: 'Start' }
  const rest = [
    { key: 'details', title: 'Details' },
    { key: 'properties', title: 'Properties' },
    { key: 'save', title: 'Save' },
  ]
  return startMode.value === 'template'
    ? [start, { key: 'template', title: 'Template' }, ...rest]
    : [start, ...rest]
})
const currentKey = computed(() => (steps.value[stepIndex.value] || steps.value[0]).key)
const isLastStep = computed(() => stepIndex.value >= steps.value.length - 1)

// Keep the advanced JSON in sync with the latest properties when arriving at
// the final step (e.g. after going back to add a property).
watch(currentKey, (k) => {
  if (k === 'save' && finishMode.value === 'advanced') refreshJson()
})

const canAdvance = computed(() => {
  switch (currentKey.value) {
    case 'start':
      return !!startMode.value
    case 'template':
      return !!selectedTemplateId.value
    case 'details':
      return !!details.name
    case 'properties':
      return properties.value.length > 0
    default:
      return true
  }
})
const canCreate = computed(() => {
  if (!details.name) return false
  if (finishMode.value === 'advanced') return !!jsonContent.value.trim() && !jsonError.value
  return properties.value.length > 0
})

const stepHelp = computed(
  () =>
    ({
      start: 'A model describes one kind of record (like a participant or a sample). Start from a template or build it from scratch.',
      template: 'Pick a template to start from — its properties come along and you can adjust them in the next steps.',
      details: 'Give your model a name and a short description.',
      properties: 'Add the fields this model captures. Reuse common data elements wherever you can.',
      save: 'Create the model now — or switch to Advanced to fine-tune the raw JSON Schema first. (Templates are created later, from a saved model.)',
    }[currentKey.value] || '')
)
const stepIcon = computed(
  () =>
    ({
      start: IconGuide,
      template: IconAddTemplate,
      details: IconDocument,
      properties: IconToolbarListBulleted,
      save: IconDoneCheckCircle,
    }[currentKey.value] || IconGuide)
)

const setStart = (mode) => {
  startMode.value = mode
  if (mode === 'template' && !templatesList.value.length) loadTemplates()
}

const loadTemplates = async () => {
  templatesLoading.value = true
  templatesError.value = ''
  try {
    templatesList.value = await metadataStore.fetchTemplates(props.orgId)
  } catch (e) {
    templatesError.value = e?.message || String(e)
    templatesList.value = []
  } finally {
    templatesLoading.value = false
  }
}

const chooseTemplate = (tpl) => {
  selectedTemplateId.value = tpl.id
  const schema = tpl.latest_version?.schema || tpl.schema || {}
  const propsObj = schema.properties || {}
  const req = new Set(schema.required || [])
  properties.value = Object.entries(propsObj).map(([name, propSchema]) => ({
    propertyName: name,
    propertySchema: propSchema,
    required: req.has(name),
  }))
  // Seed details from the template (editable).
  details.displayName = tpl.display_name || tpl.name || ''
  details.name = toName(details.displayName)
  details.description = tpl.description || ''
}

const onDisplayNameInput = () => {
  details.name = toName(details.displayName)
}

const onPropsAdded = (defs) => {
  const taken = new Set(propertyNames.value)
  for (const def of defs) {
    let name = def.propertyName
    if (taken.has(name)) name = dedupe(name, taken)
    taken.add(name)
    properties.value.push({ ...def, propertyName: name })
  }
}

const removeProperty = (i) => {
  properties.value.splice(i, 1)
}

const next = () => {
  if (canAdvance.value && !isLastStep.value) stepIndex.value += 1
}

// Assemble the JSON Schema from the properties collected in the wizard.
const buildSchema = () => {
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {},
    required: [],
  }
  for (const p of properties.value) {
    schema.properties[p.propertyName] = p.propertySchema
    if (p.required) schema.required.push(p.propertyName)
  }
  return schema
}
const buildPayload = (schema) => ({
  name: details.name,
  display_name: details.displayName || details.name,
  description: details.description,
  schema,
})

// Advanced mode: expose the assembled schema as editable JSON. Re-derive from
// the current properties whenever the user enters advanced mode (or returns to
// this step) so it always reflects what they built.
const refreshJson = () => {
  jsonContent.value = JSON.stringify(buildSchema(), null, 2)
  jsonError.value = ''
}
const onFinishModeChange = (mode) => {
  if (mode === 'advanced') refreshJson()
}
const validateJson = () => {
  const text = jsonContent.value.trim()
  if (!text) {
    jsonError.value = 'JSON Schema cannot be empty'
    return false
  }
  let parsed
  try {
    parsed = JSON.parse(jsonContent.value)
  } catch (e) {
    jsonError.value = `Invalid JSON: ${e.message}`
    return false
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    jsonError.value = 'Schema must be a JSON object'
    return false
  }
  if (parsed.type !== 'object') {
    jsonError.value = 'Root schema "type" must be "object"'
    return false
  }
  if (!parsed.properties || typeof parsed.properties !== 'object') {
    jsonError.value = 'Schema must have a "properties" object'
    return false
  }
  jsonError.value = ''
  return true
}
// TAB inserts two spaces instead of moving focus.
const onJsonKeydown = (event) => {
  if (event.key !== 'Tab') return
  event.preventDefault()
  const el = jsonEditor.value?.$refs?.textarea || jsonEditor.value?.textarea
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const v = jsonContent.value
  jsonContent.value = `${v.slice(0, start)}  ${v.slice(end)}`
  requestAnimationFrame(() => {
    el.selectionStart = el.selectionEnd = start + 2
  })
}

const create = async () => {
  createError.value = ''
  let schema
  if (finishMode.value === 'advanced') {
    if (!validateJson()) return
    schema = JSON.parse(jsonContent.value)
  } else {
    schema = buildSchema()
  }
  creating.value = true
  try {
    const result = await metadataStore.createModel(props.datasetId, buildPayload(schema))
    ElMessage.success('Model created')
    emit('created', { kind: 'model', result })
    close()
  } catch (e) {
    createError.value = e?.message || String(e)
  } finally {
    creating.value = false
  }
}

const cancel = () => {
  emit('cancel')
  close()
}
const close = () => {
  dialogVisible.value = false
}

watch(
  () => props.visible,
  (v) => {
    if (v) reset()
  }
)
const reset = () => {
  stepIndex.value = 0
  startMode.value = ''
  templateFilter.value = ''
  selectedTemplateId.value = ''
  details.name = ''
  details.displayName = ''
  details.description = ''
  properties.value = []
  addVisible.value = false
  finishMode.value = 'model'
  jsonContent.value = ''
  jsonError.value = ''
  creating.value = false
  createError.value = ''
}

const templatePropCount = (t) => Object.keys(t.latest_version?.schema?.properties || t.schema?.properties || {}).length

const propMeta = (p) => {
  const s = p.propertySchema || {}
  if (s['x-pennsieve-cde']) return `CDE · ${s['x-pennsieve-cde'].strength}`
  const t = Array.isArray(s.type) ? s.type.filter((x) => x !== 'null')[0] : s.type
  return s.type === 'array' ? `array of ${(s.items && s.items.type) || 'items'}` : t || 'property'
}

function toName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
}
function dedupe(name, taken) {
  let i = 2
  while (taken.has(`${name}_${i}`)) i += 1
  return `${name}_${i}`
}
</script>

<style scoped lang="scss">
@use "../../../../styles/theme" as theme;
.cmw-steps {
  margin-bottom: 20px;
}
.cmw-instruction {
  text-align: center;
  max-width: 520px;
  margin: 4px auto 24px;
}
.cmw-instruction-icon {
  display: inline-flex;
  color: theme.$purple_2;
}
.cmw-instruction-text {
  font-size: 15px;
  line-height: 1.5;
  color: theme.$gray_5;
  margin: 8px 0 0;
}
:deep(.el-form-item) {
  margin-bottom: 18px;
}
:deep(.el-form-item__label) {
  color: theme.$gray_6;
  font-weight: 500;
  padding-bottom: 4px;
  line-height: 1.4;
}
.cmw-step {
  min-height: 220px;
}
.cmw-q {
  font-size: 15px;
  font-weight: 500;
  color: theme.$gray_6;
}
.cmw-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0;
}
.cmw-card {
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  padding: 12px 14px;
  cursor: pointer;
  &:hover {
    border-color: theme.$purple_0_7;
  }
  &.active {
    border-color: theme.$purple_2;
    background: theme.$purple_tint;
  }
}
.cmw-card-title {
  font-weight: 500;
  color: theme.$gray_6;
  display: flex;
  align-items: center;
  gap: 6px;
}
.cmw-card-desc {
  font-size: 13px;
  color: theme.$gray_4;
  margin-top: 4px;
}
.cmw-select {
  margin-top: 8px;
}
.cmw-status {
  color: theme.$gray_4;
  font-size: 13px;
  margin-top: 8px;
}
.cmw-error {
  color: theme.$status_red;
  font-size: 13px;
  margin-top: 12px;
}
.cmw-tpl-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
}
.cmw-tpl {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid theme.$gray_1;
  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: theme.$gray_1;
  }
  &.active {
    background: theme.$purple_tint;
  }
}
.cmw-tpl-name {
  color: theme.$gray_6;
}
.cmw-tpl-meta {
  font-size: 12px;
  color: theme.$gray_4;
}
.cmw-props-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.cmw-empty {
  color: theme.$gray_4;
  font-size: 13px;
  padding: 24px 0;
  text-align: center;
}
.cmw-prop-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
}
.cmw-prop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid theme.$gray_1;
  &:last-child {
    border-bottom: none;
  }
}
.cmw-prop-name {
  color: theme.$gray_6;
  font-weight: 500;
}
.cmw-prop-meta {
  font-size: 12px;
  color: theme.$gray_4;
  margin-left: 10px;
}
.cmw-summary {
  font-size: 14px;
  color: theme.$gray_6;
  margin-bottom: 16px;
}
.cmw-label {
  font-size: 12px;
  color: theme.$gray_4;
  margin-bottom: 8px;
}
.cmw-json {
  margin-top: 14px;
  :deep(.el-textarea__inner) {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 12px;
    line-height: 1.5;
  }
}
:deep(.el-radio) {
  display: flex;
  height: auto;
  margin: 0 0 10px;
  white-space: normal;
}
</style>
