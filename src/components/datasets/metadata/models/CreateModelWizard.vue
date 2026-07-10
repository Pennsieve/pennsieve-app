<template>
  <el-dialog v-model="dialogVisible" :show-close="false" width="720px" class="create-model-wizard">
    <template #header>
      <bf-dialog-header title="Create model" />
    </template>

    <dialog-body>
      <el-steps :active="stepIndex" finish-status="success" align-center class="cmw-steps">
        <el-step title="Details" />
        <el-step title="Properties" />
        <el-step title="Save" />
      </el-steps>

      <!-- STEP 1 — DETAILS -->
      <div v-show="stepIndex === 0" class="cmw-step">
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

      <!-- STEP 2 — PROPERTIES -->
      <div v-show="stepIndex === 1" class="cmw-step">
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

      <!-- STEP 3 — SAVE AS -->
      <div v-show="stepIndex === 2" class="cmw-step">
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
      <el-button v-if="stepIndex < 2" type="primary" :disabled="!canAdvance" @click="next">Continue</el-button>
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
import { Plus, Close } from '@element-plus/icons-vue'
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
const details = reactive({ name: '', displayName: '', description: '' })
const properties = ref([]) // [{ propertyName, propertySchema, required }]
const addVisible = ref(false)
const saveAs = ref('model')
const creating = ref(false)
const createError = ref('')

const propertyNames = computed(() => properties.value.map((p) => p.propertyName))

const canAdvance = computed(() => {
  if (stepIndex.value === 0) return !!details.name
  if (stepIndex.value === 1) return properties.value.length > 0
  return true
})
const canCreate = computed(() => !!details.name && properties.value.length > 0)

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
  if (canAdvance.value && stepIndex.value < 2) stepIndex.value += 1
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
  details.name = ''
  details.displayName = ''
  details.description = ''
  properties.value = []
  addVisible.value = false
  saveAs.value = 'model'
  creating.value = false
  createError.value = ''
}

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
.cmw-error {
  color: #e94b4b;
  font-size: 13px;
  margin-top: 12px;
}
:deep(.el-radio) {
  display: flex;
  height: auto;
  margin: 0 0 10px;
  white-space: normal;
}
</style>
