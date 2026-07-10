<template>
  <el-dialog v-model="dialogVisible" :show-close="false" width="720px" class="add-property-wizard">
    <template #header>
      <bf-dialog-header title="Add property" />
    </template>

    <dialog-body>
      <el-steps :active="step - 1" finish-status="success" align-center class="wiz-steps">
        <el-step title="Source" />
        <el-step :title="isBundle ? 'Members' : 'Details'" />
        <el-step title="Options" />
      </el-steps>

      <!-- STEP 1 — SOURCE -->
      <div v-show="step === 1" class="wiz-step">
        <div class="wiz-q">How are this property's values defined?</div>
        <div class="wiz-cards">
          <div :class="['wiz-card', { active: sourceMode === 'cde' }]" @click="setSource('cde')">
            <div class="wiz-card-head">
              <span class="wiz-card-title"><el-icon><Link /></el-icon> Link a common data element</span>
              <span class="wiz-rec">Recommended</span>
            </div>
            <div class="wiz-card-desc">Reuse a standardized element. Sets the type and allowed values, and harmonizes this field across datasets.</div>
          </div>
          <div :class="['wiz-card', { active: sourceMode === 'bundle' }]" @click="setSource('bundle')">
            <div class="wiz-card-head"><span class="wiz-card-title"><el-icon><Files /></el-icon> Link a bundle</span></div>
            <div class="wiz-card-desc">Add a group of related elements at once — one property per member.</div>
          </div>
          <div :class="['wiz-card', { active: sourceMode === 'manual' }]" @click="setSource('manual')">
            <div class="wiz-card-head"><span class="wiz-card-title"><el-icon><EditPen /></el-icon> Define manually</span></div>
            <div class="wiz-card-desc">Set the data type, format, and values yourself.</div>
          </div>
        </div>

        <div v-if="sourceMode === 'cde'" class="wiz-select">
          <CdePicker v-model="binding" @select="onCdeSelected" />
        </div>

        <div v-else-if="sourceMode === 'bundle'" class="wiz-select">
          <el-input v-model="bundleFilter" placeholder="Filter bundles" clearable>
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <div v-if="bundlesLoading" class="wiz-status">Loading bundles…</div>
          <div v-else-if="bundlesError" class="wiz-status wiz-error">{{ bundlesError }}</div>
          <ul v-else class="wiz-bundle-list">
            <li
              v-for="b in filteredBundles"
              :key="b.bundle_name"
              :class="['wiz-bundle', { active: selectedBundleName === b.bundle_name }]"
              @click="selectBundle(b)"
            >
              <span class="wiz-bundle-name">{{ b.bundle_name }}</span>
              <span class="wiz-bundle-meta">
                {{ b.member_count }} element{{ b.member_count === 1 ? '' : 's' }}<template v-if="b.domain"> · {{ b.domain }}</template>
              </span>
            </li>
          </ul>
          <div v-if="selectedBundleName" class="wiz-strength">
            <div class="wiz-label">Binding strength (applies to all members)</div>
            <el-radio-group v-model="bundleStrength" size="small">
              <el-radio-button value="required">Required</el-radio-button>
              <el-radio-button value="preferred">Preferred</el-radio-button>
              <el-radio-button value="example">Example</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </div>

      <!-- STEP 2 — DETAILS (single) / MEMBERS (bundle) -->
      <div v-show="step === 2" class="wiz-step">
        <el-form v-if="!isBundle" label-position="top">
          <el-form-item label="Display name">
            <el-input v-model="basics.displayName" @input="onDisplayNameInput" />
          </el-form-item>
          <el-form-item label="Property name">
            <el-input v-model="basics.name" />
          </el-form-item>
          <el-form-item label="Description">
            <el-input v-model="basics.description" type="textarea" :rows="2" />
          </el-form-item>

          <el-form-item v-if="sourceMode === 'manual'" label="Data type">
            <el-select v-model="manual.type">
              <el-option v-for="t in manualTypes" :key="t.value" :label="t.label" :value="t.value" />
            </el-select>
          </el-form-item>

          <div v-else class="wiz-cde-preview">
            <div class="wiz-label">
              Set by the CDE<span v-if="strength === 'required'"> — enforced on save</span>
            </div>
            <div class="wiz-kv">Data type <b>{{ selectedCde && selectedCde.cde_data_type }}</b></div>
            <div v-if="cdeValues.length" class="wiz-values">
              <span v-for="(v, i) in cdeValues.slice(0, 8)" :key="i" class="wiz-chip">{{ v }}</span>
              <span v-if="cdeValues.length > 8" class="wiz-chip more">+{{ cdeValues.length - 8 }} more</span>
            </div>
          </div>
        </el-form>

        <template v-else>
          <div class="wiz-q">{{ memberRows.length }} properties will be created from “{{ selectedBundleName }}”</div>
          <div class="wiz-members">
            <div v-for="(m, i) in memberRows" :key="i" class="wiz-member">
              <el-checkbox v-model="m.include" />
              <el-input v-model="m.name" :disabled="!m.include" class="wiz-member-name" size="small" />
              <span class="wiz-member-cde" :title="m.cde.cde_name">{{ m.cde.cde_name }}</span>
              <span v-if="m.include && collides(m.name, i)" class="wiz-collision">name in use</span>
            </div>
          </div>
        </template>
      </div>

      <!-- STEP 3 — OPTIONS / REVIEW -->
      <div v-show="step === 3" class="wiz-step">
        <div v-if="isBundle" class="wiz-summary">
          {{ includedMembers.length }} propert{{ includedMembers.length === 1 ? 'y' : 'ies' }} from
          “{{ selectedBundleName }}” · strength {{ bundleStrength }}
        </div>
        <div v-else class="wiz-summary">{{ basics.name }} · {{ summaryType }}</div>

        <el-checkbox v-model="options.required">Required on every record</el-checkbox>
        <template v-if="!isBundle">
          <el-checkbox v-model="options.isKey">Part of key</el-checkbox>
          <el-checkbox v-model="options.isSensitive">Sensitive data</el-checkbox>
        </template>
      </div>
    </dialog-body>

    <template #footer>
      <el-button @click="cancel">Cancel</el-button>
      <el-button v-if="step > 1" @click="step -= 1">Back</el-button>
      <el-button v-if="step < 3" type="primary" :disabled="!canAdvance" @click="next">Continue</el-button>
      <el-button v-else type="primary" :disabled="!canCreate" @click="create">Create</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Link, Files, EditPen, Search } from '@element-plus/icons-vue'
import BfDialogHeader from '@/components/shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '@/components/shared/dialog-body/DialogBody.vue'
import CdePicker from '@/components/datasets/metadata/models/CdePicker.vue'
import { useCdeCatalogStore } from '@/stores/cdeCatalogStore'

const props = defineProps({
  visible: { type: Boolean, default: false },
  // Property names already on the model — used to flag/auto-dedupe collisions.
  existingProperties: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:visible', 'save', 'cancel'])

const store = useCdeCatalogStore()

const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const step = ref(1)
const sourceMode = ref('')

// CDE (single) state
const binding = ref(null) // { persistent_id, strength }
const selectedCde = ref(null) // full record
const strength = computed(() => (binding.value && binding.value.strength) || 'preferred')

// Bundle state
const bundles = ref([])
const bundlesLoading = ref(false)
const bundlesError = ref('')
const bundleFilter = ref('')
const selectedBundleName = ref('')
const bundleStrength = ref('preferred')
const memberRows = ref([]) // [{ cde, name, include }]

// Shared form state
const basics = reactive({ name: '', displayName: '', description: '' })
const manual = reactive({ type: 'string' })
const options = reactive({ required: false, isKey: false, isSensitive: false })

const manualTypes = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'boolean', label: 'True/False' },
]

const isBundle = computed(() => sourceMode.value === 'bundle')
const summaryType = computed(() =>
  sourceMode.value === 'manual' ? manual.type : (selectedCde.value && selectedCde.value.cde_data_type) || ''
)
const cdeValues = computed(() =>
  ((selectedCde.value && selectedCde.value.permissible_values) || []).map((pv) => pv.label || pv.code || '')
)
const filteredBundles = computed(() => {
  const f = bundleFilter.value.trim().toLowerCase()
  return f ? bundles.value.filter((b) => b.bundle_name.toLowerCase().includes(f)) : bundles.value
})
const includedMembers = computed(() => memberRows.value.filter((m) => m.include))

const setSource = (mode) => {
  sourceMode.value = mode
  if (mode === 'bundle' && !bundles.value.length) loadBundles()
}

const loadBundles = async () => {
  bundlesLoading.value = true
  bundlesError.value = ''
  try {
    bundles.value = await store.listBundles()
  } catch (e) {
    bundlesError.value = e?.message || String(e)
  } finally {
    bundlesLoading.value = false
  }
}

const onCdeSelected = (cde) => {
  selectedCde.value = cde
  if (!cde) return
  basics.displayName = cde.cde_name || ''
  basics.name = toPropName(cde.cde_name)
  basics.description = cde.cde_definition || ''
}

const selectBundle = async (b) => {
  selectedBundleName.value = b.bundle_name
  try {
    const members = await store.getBundleMembers(b.bundle_name)
    const taken = new Set(props.existingProperties)
    memberRows.value = members.map((cde) => {
      const name = dedupe(toPropName(cde.cde_name), taken)
      taken.add(name)
      return { cde, name, include: true }
    })
  } catch (e) {
    ElMessage.error('Failed to load bundle members: ' + (e?.message || e))
    memberRows.value = []
  }
}

const onDisplayNameInput = () => {
  basics.name = toPropName(basics.displayName)
}

const canAdvance = computed(() => {
  if (step.value === 1) {
    if (sourceMode.value === 'cde') return !!selectedCde.value
    if (sourceMode.value === 'bundle') return memberRows.value.length > 0
    if (sourceMode.value === 'manual') return true
    return false
  }
  if (step.value === 2) {
    if (isBundle.value) return includedMembers.value.length > 0
    return !!basics.name
  }
  return true
})
const canCreate = computed(() =>
  isBundle.value ? includedMembers.value.length > 0 : !!basics.name
)

const next = () => {
  if (canAdvance.value) step.value += 1
}

const create = () => {
  const defs = isBundle.value ? buildBundleDefs() : [buildSingleDef()]
  if (!defs.length) return
  emit('save', defs)
  close()
}

const buildSingleDef = () => {
  const schema = { title: basics.displayName || basics.name }
  if (basics.description) schema.description = basics.description
  if (sourceMode.value === 'cde' && selectedCde.value) {
    Object.assign(schema, dataTypeSchema(selectedCde.value.cde_data_type))
    schema['x-pennsieve-cde'] = {
      persistent_id: selectedCde.value.persistent_id,
      strength: strength.value,
    }
  } else {
    schema.type = manual.type
  }
  if (options.isKey) schema['x-pennsieve-key'] = true
  if (options.isSensitive) schema['x-pennsieve-sensitive'] = true
  return {
    propertyName: basics.name,
    propertySchema: schema,
    required: options.required || options.isKey,
    oldPropertyName: null,
  }
}

const buildBundleDefs = () =>
  includedMembers.value.map((m) => {
    const schema = { title: m.cde.cde_name }
    if (m.cde.cde_definition) schema.description = m.cde.cde_definition
    Object.assign(schema, dataTypeSchema(m.cde.cde_data_type))
    schema['x-pennsieve-cde'] = { persistent_id: m.cde.persistent_id, strength: bundleStrength.value }
    return {
      propertyName: m.name,
      propertySchema: schema,
      required: options.required,
      oldPropertyName: null,
    }
  })

const collides = (name, index) => {
  if (props.existingProperties.includes(name)) return true
  // collide within the batch
  return memberRows.value.some((m, i) => i !== index && m.include && m.name === name)
}

const cancel = () => {
  emit('cancel')
  close()
}
const close = () => {
  dialogVisible.value = false
}

// Reset each time the wizard opens.
watch(
  () => props.visible,
  (v) => {
    if (v) reset()
  }
)
const reset = () => {
  step.value = 1
  sourceMode.value = ''
  binding.value = null
  selectedCde.value = null
  selectedBundleName.value = ''
  bundleStrength.value = 'preferred'
  bundleFilter.value = ''
  memberRows.value = []
  basics.name = ''
  basics.displayName = ''
  basics.description = ''
  manual.type = 'string'
  options.required = false
  options.isKey = false
  options.isSensitive = false
}

function toPropName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
}
function dedupe(name, taken) {
  if (!taken.has(name)) return name
  let i = 2
  while (taken.has(`${name}_${i}`)) i += 1
  return `${name}_${i}`
}
function dataTypeSchema(cdeType) {
  switch (cdeType) {
    case 'Number':
      return { type: 'number' }
    case 'Date':
      return { type: 'string', format: 'date' }
    case 'Datetime':
      return { type: 'string', format: 'date-time' }
    case 'Time':
      return { type: 'string', format: 'time' }
    default:
      return { type: 'string' } // Text, Value List, Other
  }
}
</script>

<style scoped lang="scss">
.wiz-steps {
  margin-bottom: 24px;
}
.wiz-step {
  min-height: 220px;
}
.wiz-q {
  font-size: 15px;
  font-weight: 500;
  color: #1c1d1f;
  margin-bottom: 12px;
}
.wiz-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.wiz-card {
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
.wiz-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.wiz-card-title {
  font-weight: 500;
  color: #1c1d1f;
  display: flex;
  align-items: center;
  gap: 6px;
}
.wiz-card-desc {
  font-size: 13px;
  color: #71747c;
  margin-top: 4px;
  line-height: 1.4;
}
.wiz-rec {
  font-size: 12px;
  color: #2760ff;
  background: #edf1ff;
  padding: 2px 10px;
  border-radius: 4px;
}
.wiz-select {
  margin-top: 16px;
}
.wiz-status {
  color: #71747c;
  font-size: 13px;
  margin-top: 8px;
}
.wiz-error {
  color: #e94b4b;
}
.wiz-bundle-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #dadde3;
  border-radius: 4px;
}
.wiz-bundle {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
.wiz-bundle-name {
  color: #1c1d1f;
}
.wiz-bundle-meta {
  font-size: 12px;
  color: #71747c;
}
.wiz-strength {
  margin-top: 16px;
}
.wiz-label {
  font-size: 12px;
  color: #71747c;
  margin-bottom: 6px;
}
.wiz-cde-preview {
  background: #f7f9ff;
  border: 1px solid #b6c0e6;
  border-radius: 8px;
  padding: 12px 14px;
}
.wiz-kv {
  font-size: 13px;
  color: #4a4b4f;
  margin-bottom: 8px;
  b {
    color: #1c1d1f;
    font-weight: 500;
  }
}
.wiz-values {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.wiz-chip {
  font-size: 12px;
  background: #fff;
  border: 1px solid #dadde3;
  border-radius: 4px;
  padding: 2px 8px;
  color: #4a4b4f;
  &.more {
    border-style: dashed;
    color: #71747c;
  }
}
.wiz-members {
  max-height: 260px;
  overflow-y: auto;
}
.wiz-member {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #f1f1f3;
}
.wiz-member-name {
  width: 200px;
}
.wiz-member-cde {
  flex: 1;
  font-size: 13px;
  color: #71747c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wiz-collision {
  font-size: 12px;
  color: #e6a23c;
}
.wiz-summary {
  font-size: 14px;
  color: #1c1d1f;
  margin-bottom: 16px;
}
</style>
