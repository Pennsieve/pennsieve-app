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
          <div :class="['wiz-card', { active: sourceMode === 'catalog' }]" @click="setSource('catalog')">
            <div class="wiz-card-head">
              <span class="wiz-card-title"><el-icon><Link /></el-icon> Common data element(s)</span>
              <span class="wiz-rec">Recommended</span>
            </div>
            <div class="wiz-card-desc">Reuse a standardized element (or a group of them). Sets the type and allowed values, and harmonizes this field across datasets.</div>
          </div>
          <div :class="['wiz-card', { active: sourceMode === 'manual' }]" @click="setSource('manual')">
            <div class="wiz-card-head"><span class="wiz-card-title"><el-icon><EditPen /></el-icon> Define manually</span></div>
            <div class="wiz-card-desc">Set the data type, format, and values yourself.</div>
          </div>
        </div>

        <div v-if="sourceMode === 'catalog'" class="wiz-select">
          <!-- Search + grouped results -->
          <template v-if="!selectionKind">
            <el-input v-model="term" placeholder="Search common data elements" clearable @input="onSearchInput">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>

            <div v-if="searching" class="wiz-status">Searching…</div>
            <div v-else-if="searchError" class="wiz-status wiz-error">{{ searchError }}</div>
            <div v-else class="wiz-results">
              <template v-if="results.bundles.length">
                <div class="wiz-group">Bundles</div>
                <ul class="wiz-list">
                  <li v-for="b in results.bundles" :key="'b:' + b.bundle_name" class="wiz-row" @click="chooseBundle(b)">
                    <span class="wiz-row-name">{{ b.bundle_name }}</span>
                    <span class="wiz-row-meta">bundle · {{ b.member_count }} element{{ b.member_count === 1 ? '' : 's' }}</span>
                  </li>
                </ul>
              </template>
              <template v-if="results.cdes.length">
                <div class="wiz-group">Common data elements</div>
                <ul class="wiz-list">
                  <li v-for="c in results.cdes" :key="'c:' + c.persistent_id" class="wiz-row" @click="chooseCde(c)">
                    <span class="wiz-row-name">{{ c.cde_name }}</span>
                    <span class="wiz-row-meta">
                      {{ c.cde_data_type }}
                      <template v-if="c._bundles && c._bundles.length"> · part of {{ c._bundles.join(', ') }}</template>
                    </span>
                  </li>
                </ul>
              </template>
              <div v-if="term.trim() && !results.bundles.length && !results.cdes.length" class="wiz-status">
                No matching common data elements
              </div>
            </div>
          </template>

          <!-- Selected: summary + strength -->
          <div v-else class="wiz-selected">
            <div class="wiz-selected-head">
              <span class="wiz-selected-name">{{ selectionKind === 'bundle' ? selectedBundleName : (selectedCde && selectedCde.cde_name) }}</span>
              <el-button text size="small" @click="clearSelection"><el-icon><Close /></el-icon> Change</el-button>
            </div>
            <div class="wiz-selected-sub">
              <template v-if="selectionKind === 'bundle'">bundle · {{ memberRows.length }} elements</template>
              <template v-else>{{ selectedCde && selectedCde.cde_data_type }}</template>
            </div>
            <div class="wiz-strength">
              <div class="wiz-label">Binding strength<span v-if="selectionKind === 'bundle'"> (applies to all members)</span></div>
              <el-radio-group v-model="strength" size="small">
                <el-radio-button value="required">Required</el-radio-button>
                <el-radio-button value="preferred">Preferred</el-radio-button>
                <el-radio-button value="example">Example</el-radio-button>
              </el-radio-group>
              <div class="wiz-hint">{{ strengthHint }}</div>
            </div>
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

          <el-form-item v-if="isManual" label="Data type">
            <el-select v-model="manual.type">
              <el-option v-for="t in manualTypes" :key="t.value" :label="t.label" :value="t.value" />
            </el-select>
          </el-form-item>

          <div v-else class="wiz-cde-preview">
            <div class="wiz-label">Set by the CDE<span v-if="strength === 'required'"> — enforced on save</span></div>
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
          {{ includedMembers.length }} propert{{ includedMembers.length === 1 ? 'y' : 'ies' }} from “{{ selectedBundleName }}” · strength {{ strength }}
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
import { Link, EditPen, Search, Close } from '@element-plus/icons-vue'
import debounce from 'lodash.debounce'
import BfDialogHeader from '@/components/shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '@/components/shared/dialog-body/DialogBody.vue'
import { useCdeCatalogStore } from '@/stores/cdeCatalogStore'

const props = defineProps({
  visible: { type: Boolean, default: false },
  existingProperties: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:visible', 'save', 'cancel'])

const store = useCdeCatalogStore()

const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const step = ref(1)
const sourceMode = ref('') // '' | 'catalog' | 'manual'

// Catalog search
const term = ref('')
const results = ref({ bundles: [], cdes: [] })
const searching = ref(false)
const searchError = ref('')

// Selection within the catalog
const selectionKind = ref('') // '' | 'cde' | 'bundle'
const selectedCde = ref(null)
const selectedBundleName = ref('')
const memberRows = ref([]) // [{ cde, name, include }]
const strength = ref('preferred')

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

const isBundle = computed(() => sourceMode.value === 'catalog' && selectionKind.value === 'bundle')
const isManual = computed(() => sourceMode.value === 'manual')
const summaryType = computed(() =>
  isManual.value ? manual.type : (selectedCde.value && selectedCde.value.cde_data_type) || ''
)
const cdeValues = computed(() =>
  ((selectedCde.value && selectedCde.value.permissible_values) || []).map((pv) => pv.label || pv.code || '')
)
const includedMembers = computed(() => memberRows.value.filter((m) => m.include))
const strengthHint = computed(
  () =>
    ({
      required: 'Records must use these values — type and allowed values are enforced on save.',
      preferred: 'Recommended values shown as guidance. Not enforced.',
      example: 'Linked for reference only.',
    }[strength.value] || '')
)

const setSource = (mode) => {
  sourceMode.value = mode
  if (mode === 'catalog' && !selectionKind.value) runSearch()
}

const runSearch = async () => {
  searching.value = true
  searchError.value = ''
  try {
    results.value = await store.searchCatalog(term.value, 25)
  } catch (e) {
    searchError.value = e?.message || String(e)
    results.value = { bundles: [], cdes: [] }
    console.error('CDE catalog search failed:', e)
  } finally {
    searching.value = false
  }
}
const onSearchInput = debounce(runSearch, 300)

const chooseCde = (cde) => {
  selectionKind.value = 'cde'
  selectedCde.value = cde
  basics.displayName = cde.cde_name || ''
  basics.name = toPropName(cde.cde_name)
  basics.description = cde.cde_definition || ''
}

const chooseBundle = async (b) => {
  selectionKind.value = 'bundle'
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
    clearSelection()
  }
}

const clearSelection = () => {
  selectionKind.value = ''
  selectedCde.value = null
  selectedBundleName.value = ''
  memberRows.value = []
}

const onDisplayNameInput = () => {
  basics.name = toPropName(basics.displayName)
}

const canAdvance = computed(() => {
  if (step.value === 1) {
    if (isManual.value) return true
    if (sourceMode.value === 'catalog') {
      if (selectionKind.value === 'cde') return !!selectedCde.value
      if (selectionKind.value === 'bundle') return memberRows.value.length > 0
    }
    return false
  }
  if (step.value === 2) {
    return isBundle.value ? includedMembers.value.length > 0 : !!basics.name
  }
  return true
})
const canCreate = computed(() => (isBundle.value ? includedMembers.value.length > 0 : !!basics.name))

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
  if (isManual.value) {
    schema.type = manual.type
  } else if (selectedCde.value) {
    Object.assign(schema, dataTypeSchema(selectedCde.value.cde_data_type))
    schema['x-pennsieve-cde'] = { persistent_id: selectedCde.value.persistent_id, strength: strength.value }
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
    schema['x-pennsieve-cde'] = { persistent_id: m.cde.persistent_id, strength: strength.value }
    return { propertyName: m.name, propertySchema: schema, required: options.required, oldPropertyName: null }
  })

const collides = (name, index) => {
  if (props.existingProperties.includes(name)) return true
  return memberRows.value.some((m, i) => i !== index && m.include && m.name === name)
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
  step.value = 1
  sourceMode.value = ''
  term.value = ''
  results.value = { bundles: [], cdes: [] }
  searchError.value = ''
  clearSelection()
  strength.value = 'preferred'
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
      return { type: 'string' }
  }
}
</script>

<style scoped lang="scss">
.wiz-steps {
  margin-bottom: 24px;
}
.wiz-step {
  min-height: 240px;
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
.wiz-results {
  margin-top: 8px;
  max-height: 260px;
  overflow-y: auto;
}
.wiz-group {
  font-size: 12px;
  font-weight: 500;
  color: #9b9ea6;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 12px 0 4px;
}
.wiz-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid #dadde3;
  border-radius: 4px;
}
.wiz-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f1f1f3;
  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: #f9f9fa;
  }
}
.wiz-row-name {
  color: #1c1d1f;
}
.wiz-row-meta {
  font-size: 12px;
  color: #71747c;
  white-space: nowrap;
}
.wiz-selected {
  border: 1px solid #b6c0e6;
  border-radius: 8px;
  padding: 12px 14px;
  background: #f7f9ff;
}
.wiz-selected-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.wiz-selected-name {
  font-weight: 500;
  color: #1c1d1f;
}
.wiz-selected-sub {
  font-size: 13px;
  color: #71747c;
  margin-top: 2px;
}
.wiz-strength {
  margin-top: 14px;
}
.wiz-label {
  font-size: 12px;
  color: #71747c;
  margin-bottom: 6px;
}
.wiz-hint {
  font-size: 12px;
  color: #71747c;
  margin-top: 6px;
  line-height: 1.4;
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
  max-height: 280px;
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
