<template>
  <el-dialog v-model="dialogVisible" :show-close="false" width="720px" class="create-model-wizard">
    <template #header>
      <bf-dialog-header title="Create model" />
    </template>

    <dialog-body>
      <el-steps :active="stepIndex" finish-status="success" align-center class="cmw-steps">
        <el-step title="Start" />
        <el-step title="Details" />
        <el-step title="Properties" />
        <el-step title="Save" />
      </el-steps>

      <!-- STEP 1 — START -->
      <div v-show="stepIndex === 0" class="cmw-step">
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

        <div v-if="startMode === 'template'" class="cmw-select">
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

      <!-- STEP 2 — DETAILS -->
      <div v-show="stepIndex === 1" class="cmw-step">
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

      <!-- STEP 3 — PROPERTIES -->
      <div v-show="stepIndex === 2" class="cmw-step">
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

      <!-- STEP 4 — SAVE AS -->
      <div v-show="stepIndex === 3" class="cmw-step">
        <div class="cmw-summary">
          {{ details.name }} · {{ properties.length }} propert{{ properties.length === 1 ? 'y' : 'ies' }}
        </div>
        <div class="cmw-label">Save as</div>
        <el-radio-group v-model="saveAs">
          <el-radio value="model">Model — a metadata schema in this dataset</el-radio>
          <el-radio value="template">Template — a reusable schema shared across the workspace</el-radio>
        </el-radio-group>
        <div v-if="createError" class="cmw-error">{{ createError }}</div>
      </div>
    </dialog-body>

    <template #footer>
      <el-button @click="cancel">Cancel</el-button>
      <el-button v-if="stepIndex > 0" @click="stepIndex -= 1">Back</el-button>
      <el-button v-if="stepIndex < 3" type="primary" :disabled="!canAdvance" @click="next">Continue</el-button>
      <el-button v-else type="primary" :loading="creating" :disabled="!canCreate" @click="create">
        Create {{ saveAs }}
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
const saveAs = ref('model')
const creating = ref(false)
const createError = ref('')

const propertyNames = computed(() => properties.value.map((p) => p.propertyName))
const filteredTemplates = computed(() => {
  const f = templateFilter.value.trim().toLowerCase()
  return f
    ? templatesList.value.filter((t) => (t.display_name || t.name || '').toLowerCase().includes(f))
    : templatesList.value
})

const canAdvance = computed(() => {
  if (stepIndex.value === 0) {
    if (startMode.value === 'scratch') return true
    if (startMode.value === 'template') return !!selectedTemplateId.value
    return false
  }
  if (stepIndex.value === 1) return !!details.name
  if (stepIndex.value === 2) return properties.value.length > 0
  return true
})
const canCreate = computed(() => !!details.name && properties.value.length > 0)

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
  if (canAdvance.value && stepIndex.value < 3) stepIndex.value += 1
}

const create = async () => {
  createError.value = ''
  creating.value = true
  try {
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
    const payload = {
      name: details.name,
      display_name: details.displayName || details.name,
      description: details.description,
      schema,
    }
    const result =
      saveAs.value === 'template'
        ? await metadataStore.createTemplateFromModel(payload, props.orgId)
        : await metadataStore.createModel(props.datasetId, payload)

    ElMessage.success(saveAs.value === 'template' ? 'Template created' : 'Model created')
    emit('created', { kind: saveAs.value, result })
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
  saveAs.value = 'model'
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
.cmw-steps {
  margin-bottom: 24px;
}
.cmw-step {
  min-height: 220px;
}
.cmw-q {
  font-size: 15px;
  font-weight: 500;
  color: #1c1d1f;
}
.cmw-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0;
}
.cmw-card {
  border: 1px solid #dadde3;
  border-radius: 8px;
  padding: 12px 14px;
  cursor: pointer;
  &:hover {
    border-color: #b6c0e6;
  }
  &.active {
    border-color: #2760ff;
    background: #f7f9ff;
  }
}
.cmw-card-title {
  font-weight: 500;
  color: #1c1d1f;
  display: flex;
  align-items: center;
  gap: 6px;
}
.cmw-card-desc {
  font-size: 13px;
  color: #71747c;
  margin-top: 4px;
}
.cmw-select {
  margin-top: 8px;
}
.cmw-status {
  color: #71747c;
  font-size: 13px;
  margin-top: 8px;
}
.cmw-error {
  color: #e94b4b;
  font-size: 13px;
  margin-top: 12px;
}
.cmw-tpl-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid #dadde3;
  border-radius: 4px;
}
.cmw-tpl {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f1f1f3;
  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: #f9f9fa;
  }
  &.active {
    background: #f7f9ff;
  }
}
.cmw-tpl-name {
  color: #1c1d1f;
}
.cmw-tpl-meta {
  font-size: 12px;
  color: #71747c;
}
.cmw-props-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.cmw-empty {
  color: #71747c;
  font-size: 13px;
  padding: 24px 0;
  text-align: center;
}
.cmw-prop-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid #dadde3;
  border-radius: 4px;
}
.cmw-prop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #f1f1f3;
  &:last-child {
    border-bottom: none;
  }
}
.cmw-prop-name {
  color: #1c1d1f;
  font-weight: 500;
}
.cmw-prop-meta {
  font-size: 12px;
  color: #71747c;
  margin-left: 10px;
}
.cmw-summary {
  font-size: 14px;
  color: #1c1d1f;
  margin-bottom: 16px;
}
.cmw-label {
  font-size: 12px;
  color: #71747c;
  margin-bottom: 8px;
}
:deep(.el-radio) {
  display: flex;
  height: auto;
  margin: 0 0 10px;
  white-space: normal;
}
</style>
