<template>
  <el-dialog v-model="dialogVisible" :show-close="false" width="720px" class="add-property-wizard">
    <template #header>
      <bf-dialog-header title="Add property" />
    </template>

    <dialog-body>
      <el-steps :active="stepIndex" finish-status="success" align-center class="wiz-steps">
        <el-step v-for="s in steps" :key="s.key" :title="s.title" />
      </el-steps>

      <div v-if="stepHelp" class="wiz-instruction">
        <span class="wiz-instruction-icon"><component :is="stepIcon" :width="34" :height="34" /></span>
        <p class="wiz-instruction-text">{{ stepHelp }}</p>
      </div>

      <!-- SOURCE -->
      <div v-show="currentKey === 'source'" class="wiz-step">
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

      </div>

      <!-- FIND (catalog) -->
      <div v-show="currentKey === 'find'" class="wiz-step">
        <div class="wiz-select">
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

      <!-- DETAILS -->
      <div v-show="currentKey === 'details'" class="wiz-step">
        <el-form label-position="top">
          <el-form-item label="Display name">
            <el-input v-model="basics.displayName" @input="onDisplayNameInput" />
          </el-form-item>
          <el-form-item label="Property name">
            <el-input v-model="basics.name" />
          </el-form-item>
          <el-form-item label="Description">
            <el-input v-model="basics.description" type="textarea" :rows="2" />
          </el-form-item>

          <div v-if="isSingleCde" class="wiz-cde-preview">
            <div class="wiz-label">Set by the CDE<span v-if="strength === 'required'"> — enforced on save</span></div>
            <div class="wiz-kv">Data type <b>{{ selectedCde && selectedCde.cde_data_type }}</b></div>
            <div v-if="cdeValues.length" class="wiz-values">
              <span v-for="(v, i) in cdeValues.slice(0, 8)" :key="i" class="wiz-chip">{{ v }}</span>
              <span v-if="cdeValues.length > 8" class="wiz-chip more">+{{ cdeValues.length - 8 }} more</span>
            </div>
          </div>
        </el-form>
      </div>

      <!-- TYPE & FORMAT (manual) -->
      <div v-show="currentKey === 'type'" class="wiz-step">
        <el-form label-position="top">
          <el-form-item label="Data type">
            <el-select v-model="manual.type">
              <el-option v-for="t in manualTypes" :key="t.value" :label="t.label" :value="t.value" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="manual.type === 'string'" label="Format">
            <el-select v-model="manual.format">
              <el-option v-for="f in stringFormats" :key="f.value" :label="f.label" :value="f.value" />
            </el-select>
          </el-form-item>
          <div class="wiz-manual-flags">
            <el-checkbox v-model="manual.isArray">List of values (array)</el-checkbox>
            <el-checkbox v-model="manual.allowNull">Allow null</el-checkbox>
          </div>
        </el-form>
      </div>

      <!-- VALUES & RULES (manual, type-aware) -->
      <div v-show="currentKey === 'values'" class="wiz-step">
        <el-form label-position="top">
          <el-form-item label="Allowed values">
            <el-input v-model="manual.enumInput" placeholder="Comma-separated, e.g. Low, Medium, High" />
          </el-form-item>

          <template v-if="manual.type === 'string'">
            <div class="wiz-two">
              <el-form-item label="Min length"><el-input v-model="manual.minLength" /></el-form-item>
              <el-form-item label="Max length"><el-input v-model="manual.maxLength" /></el-form-item>
            </div>
            <el-form-item label="Pattern (regex)"><el-input v-model="manual.pattern" /></el-form-item>
          </template>

          <div v-if="manual.type === 'number' || manual.type === 'integer'" class="wiz-two">
            <el-form-item label="Minimum"><el-input v-model="manual.minimum" /></el-form-item>
            <el-form-item label="Maximum"><el-input v-model="manual.maximum" /></el-form-item>
          </div>

          <template v-if="manual.isArray">
            <div class="wiz-two">
              <el-form-item label="Min items"><el-input v-model="manual.minItems" /></el-form-item>
              <el-form-item label="Max items"><el-input v-model="manual.maxItems" /></el-form-item>
            </div>
            <el-checkbox v-model="manual.uniqueItems">Unique items</el-checkbox>
          </template>
        </el-form>

        <div class="wiz-options">
          <div v-for="f in optionFlags" :key="f.key" class="wiz-option">
            <el-checkbox v-model="options[f.key]">{{ f.label }}</el-checkbox>
            <p class="wiz-option-desc">{{ f.desc }}</p>
          </div>
        </div>
      </div>

      <!-- MEMBERS (bundle) -->
      <div v-show="currentKey === 'members'" class="wiz-step">
        <div class="wiz-q">{{ memberRows.length }} properties from “{{ selectedBundleName }}”</div>
        <ul class="wiz-legend">
          <li><b>Required</b> — every record must include a value.</li>
          <li><b>Key</b> — its value helps identify a record (matching key values = the same record).</li>
          <li><b>PHI</b> — protected health information or other sensitive data.</li>
        </ul>
        <div class="wiz-members">
          <div class="wiz-members-head">
            <span>Property</span>
            <span class="col-flag">Required</span>
            <span class="col-flag">Key</span>
            <span class="col-flag">PHI</span>
          </div>
          <div v-for="(m, i) in memberRows" :key="i" class="wiz-member">
            <div class="wiz-member-prop">
              <el-input v-model="m.name" size="small" />
              <div class="wiz-member-sub">
                <span class="wiz-member-cde" :title="m.cde.cde_name">{{ m.cde.cde_name }}</span>
                <span v-if="collides(m.name, i)" class="wiz-collision"> · name in use</span>
              </div>
            </div>
            <div class="col-flag"><el-checkbox v-model="m.required" /></div>
            <div class="col-flag"><el-checkbox v-model="m.isKey" /></div>
            <div class="col-flag"><el-checkbox v-model="m.isSensitive" /></div>
          </div>
        </div>
      </div>

      <!-- OPTIONS (single CDE) -->
      <div v-show="currentKey === 'options'" class="wiz-step">
        <div class="wiz-summary">{{ basics.name }} · {{ summaryType }}</div>
        <div class="wiz-options">
          <div v-for="f in optionFlags" :key="f.key" class="wiz-option">
            <el-checkbox v-model="options[f.key]">{{ f.label }}</el-checkbox>
            <p class="wiz-option-desc">{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </dialog-body>

    <template #footer>
      <el-button @click="cancel">Cancel</el-button>
      <el-button v-if="stepIndex > 0" @click="back">Back</el-button>
      <el-button v-if="!isLastStep" type="primary" :disabled="!canAdvance" @click="next">Continue</el-button>
      <el-button v-else type="primary" :disabled="!canCreate" @click="create">Create</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Link, EditPen, Search, Close } from '@element-plus/icons-vue'
import debounce from 'lodash.debounce'
import IconGuide from '@/components/icons/IconGuide.vue'
import IconSearch from '@/components/icons/IconSearch.vue'
import IconDocument from '@/components/icons/IconDocument.vue'
import IconTag from '@/components/icons/IconTag.vue'
import IconToolbarListBulleted from '@/components/icons/IconToolbarListBulleted.vue'
import IconCollection from '@/components/icons/IconCollection.vue'
import IconSettings from '@/components/icons/IconSettings.vue'
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

const stepIndex = ref(0)
const sourceMode = ref('') // '' | 'catalog' | 'manual'

// Catalog search
const term = ref('')
const results = ref({ bundles: [], cdes: [] })
const searching = ref(false)
const searchError = ref('')

// Selection
const selectionKind = ref('') // '' | 'cde' | 'bundle'
const selectedCde = ref(null)
const selectedBundleName = ref('')
const memberRows = ref([])
const strength = ref('required')

// Forms
const basics = reactive({ name: '', displayName: '', description: '' })
const manual = reactive({
  type: 'string',
  format: 'plain',
  isArray: false,
  allowNull: false,
  enumInput: '',
  minLength: '',
  maxLength: '',
  pattern: '',
  minimum: '',
  maximum: '',
  minItems: '',
  maxItems: '',
  uniqueItems: false,
})
const options = reactive({ required: false, isKey: false, isSensitive: false })

// Plain-language definitions of the property behaviors, shown as labeled
// options (single/manual) and as the bundle Members legend.
const optionFlags = [
  { key: 'required', label: 'Required', desc: 'Every record must include a value for this property.' },
  {
    key: 'isKey',
    label: 'Part of the record key',
    desc: 'Its value helps identify each record — records with the same key values are treated as the same record.',
  },
  {
    key: 'isSensitive',
    label: 'Sensitive / PHI',
    desc: 'Protected health information or other sensitive data — flagged so it’s handled and redacted appropriately.',
  },
]

const manualTypes = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'boolean', label: 'True/False' },
]
const stringFormats = [
  { value: 'plain', label: 'Plain text' },
  { value: 'date', label: 'Date' },
  { value: 'date-time', label: 'Date & time' },
  { value: 'time', label: 'Time' },
  { value: 'email', label: 'Email address' },
  { value: 'uri', label: 'URL / URI' },
  { value: 'uuid', label: 'UUID' },
  { value: 'ipv4', label: 'IPv4 address' },
  { value: 'ipv6', label: 'IPv6 address' },
  { value: 'hostname', label: 'Hostname' },
]

const isBundle = computed(() => sourceMode.value === 'catalog' && selectionKind.value === 'bundle')
const isManual = computed(() => sourceMode.value === 'manual')
const isSingleCde = computed(() => sourceMode.value === 'catalog' && selectionKind.value === 'cde')

// Steps vary by path so each stays light.
const steps = computed(() => {
  const source = { key: 'source', title: 'Source' }
  if (isManual.value) {
    return [
      source,
      { key: 'details', title: 'Details' },
      { key: 'type', title: 'Type & format' },
      { key: 'values', title: 'Values & rules' },
    ]
  }
  if (sourceMode.value === 'catalog') {
    const find = { key: 'find', title: 'Find' }
    if (selectionKind.value === 'bundle') {
      // The Members table carries all per-property behavior, so no Options step.
      return [source, find, { key: 'members', title: 'Members' }]
    }
    return [source, find, { key: 'details', title: 'Details' }, { key: 'options', title: 'Options' }]
  }
  return [source]
})
const currentKey = computed(() => (steps.value[stepIndex.value] || steps.value[0]).key)
const isLastStep = computed(() => stepIndex.value >= steps.value.length - 1)

const stepHelp = computed(() => {
  // The Find step changes purpose once something is selected: searching vs.
  // tuning the picked element. Keep enforcement wording with the strength
  // control (below), not repeated here.
  if (currentKey.value === 'find') {
    return selectionKind.value
      ? 'Set how strongly records should follow this element, then continue — or pick a different one.'
      : 'Search the catalog and pick a data element — or a bundle to add several related properties at once.'
  }
  return (
    {
      source: 'A common data element (CDE) is a standardized, reusable field — a shared name, data type, and allowed values — so the same concept is recorded the same way across datasets. Reuse one to keep your data comparable and mergeable, or define the property yourself.',
      details: 'Name the property and describe it. If you linked a CDE these are pre-filled — adjust as needed.',
      type: 'Pick the kind of value this property holds.',
      values: 'Set the allowed values and any limits. Only the options relevant to your type are shown.',
      members: 'These properties are added together as a set. Rename any as needed, then use the columns to set each one’s behavior.',
      options: 'Choose how this property behaves on records.',
    }[currentKey.value] || ''
  )
})
const stepIcon = computed(
  () =>
    ({
      source: IconGuide,
      find: IconSearch,
      details: IconDocument,
      type: IconTag,
      values: IconToolbarListBulleted,
      members: IconCollection,
      options: IconSettings,
    }[currentKey.value] || IconGuide)
)

const summaryType = computed(() =>
  isManual.value ? manual.type : (selectedCde.value && selectedCde.value.cde_data_type) || ''
)
const cdeValues = computed(() =>
  ((selectedCde.value && selectedCde.value.permissible_values) || []).map((pv) => pv.label || pv.code || '')
)
// A bundle is collected as a set — every member becomes a property (users can
// still drop one afterward in the Advanced JSON editor if truly needed).
const includedMembers = computed(() => memberRows.value)
const strengthHint = computed(
  () =>
    ({
      required: 'Default. Records must use these values — type and allowed values are enforced on save.',
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
      return { cde, name, required: false, isKey: false, isSensitive: false }
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
  switch (currentKey.value) {
    case 'source':
      return !!sourceMode.value
    case 'find':
      return isBundle.value ? memberRows.value.length > 0 : !!selectedCde.value
    case 'details':
      return !!basics.name
    case 'members':
      return includedMembers.value.length > 0
    default:
      return true // type, values, options
  }
})
const canCreate = computed(() => (isBundle.value ? includedMembers.value.length > 0 : !!basics.name))

const next = () => {
  if (canAdvance.value && !isLastStep.value) stepIndex.value += 1
}
const back = () => {
  if (stepIndex.value > 0) stepIndex.value -= 1
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
    Object.assign(schema, manualValueSchema())
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
    if (m.isKey) schema['x-pennsieve-key'] = true
    if (m.isSensitive) schema['x-pennsieve-sensitive'] = true
    return { propertyName: m.name, propertySchema: schema, required: m.required || m.isKey, oldPropertyName: null }
  })

const collides = (name, index) => {
  if (props.existingProperties.includes(name)) return true
  return memberRows.value.some((m, i) => i !== index && m.name === name)
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
  sourceMode.value = ''
  term.value = ''
  results.value = { bundles: [], cdes: [] }
  searchError.value = ''
  clearSelection()
  strength.value = 'required'
  basics.name = ''
  basics.displayName = ''
  basics.description = ''
  Object.assign(manual, {
    type: 'string',
    format: 'plain',
    isArray: false,
    allowNull: false,
    enumInput: '',
    minLength: '',
    maxLength: '',
    pattern: '',
    minimum: '',
    maximum: '',
    minItems: '',
    maxItems: '',
    uniqueItems: false,
  })
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
function isNum(v) {
  return v !== undefined && v !== null && v !== '' && !isNaN(v)
}
function parseCsv(input) {
  return String(input || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}
// Build the value part of a manual property's schema (type, array wrapping,
// allow-null, format, type-aware constraints, allowed values). Mirrors the
// classic PropertyDialog: for arrays the item-level constraints live in `items`.
function manualValueSchema() {
  const t = manual.type
  const en = parseCsv(manual.enumInput)
  const withConstraints = (obj) => {
    if (t === 'string') {
      if (manual.format && manual.format !== 'plain') obj.format = manual.format
      if (isNum(manual.minLength)) obj.minLength = parseInt(manual.minLength, 10)
      if (isNum(manual.maxLength)) obj.maxLength = parseInt(manual.maxLength, 10)
      if (manual.pattern) obj.pattern = manual.pattern
    }
    if (t === 'number' || t === 'integer') {
      if (isNum(manual.minimum)) obj.minimum = parseFloat(manual.minimum)
      if (isNum(manual.maximum)) obj.maximum = parseFloat(manual.maximum)
    }
    if (en.length) obj.enum = en
    return obj
  }
  const baseType = manual.allowNull ? [t, 'null'] : t
  if (manual.isArray) {
    const s = { type: 'array', items: withConstraints({ type: baseType }) }
    if (isNum(manual.minItems)) s.minItems = parseInt(manual.minItems, 10)
    if (isNum(manual.maxItems)) s.maxItems = parseInt(manual.maxItems, 10)
    if (manual.uniqueItems) s.uniqueItems = true
    return s
  }
  return withConstraints({ type: baseType })
}
</script>

<style scoped lang="scss">
@use "../../../../styles/theme" as theme;
.wiz-steps {
  margin-bottom: 20px;
}
.wiz-instruction {
  text-align: center;
  max-width: 520px;
  margin: 4px auto 24px;
}
.wiz-instruction-icon {
  display: inline-flex;
  color: theme.$purple_2;
}
.wiz-instruction-text {
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
.wiz-step {
  min-height: 240px;
}
.wiz-q {
  font-size: 15px;
  font-weight: 500;
  color: theme.$gray_6;
  margin-bottom: 12px;
}
.wiz-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.wiz-card {
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
.wiz-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.wiz-card-title {
  font-weight: 500;
  color: theme.$gray_6;
  display: flex;
  align-items: center;
  gap: 6px;
}
.wiz-card-desc {
  font-size: 13px;
  color: theme.$gray_4;
  margin-top: 4px;
  line-height: 1.4;
}
.wiz-rec {
  font-size: 12px;
  color: theme.$purple_2;
  background: theme.$purple_tint;
  padding: 2px 10px;
  border-radius: 3px;
}
.wiz-select {
  margin-top: 16px;
}
.wiz-status {
  color: theme.$gray_4;
  font-size: 13px;
  margin-top: 8px;
}
.wiz-error {
  color: theme.$status_red;
}
.wiz-results {
  margin-top: 8px;
  max-height: 260px;
  overflow-y: auto;
}
.wiz-group {
  font-size: 12px;
  font-weight: 500;
  color: theme.$gray_4;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 12px 0 4px;
}
.wiz-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
}
.wiz-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid theme.$gray_1;
  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: theme.$gray_1;
  }
}
.wiz-row-name {
  color: theme.$gray_6;
}
.wiz-row-meta {
  font-size: 12px;
  color: theme.$gray_4;
  white-space: nowrap;
}
.wiz-selected {
  border: 1px solid theme.$purple_0_7;
  border-radius: 3px;
  padding: 12px 14px;
  background: theme.$purple_tint;
}
.wiz-selected-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.wiz-selected-name {
  font-weight: 500;
  color: theme.$gray_6;
}
.wiz-selected-sub {
  font-size: 13px;
  color: theme.$gray_5;
  margin-top: 2px;
}
.wiz-strength {
  margin-top: 14px;
}
.wiz-label {
  font-size: 12px;
  color: theme.$gray_5;
  margin-bottom: 6px;
}
.wiz-hint {
  font-size: 12px;
  color: theme.$gray_5;
  margin-top: 6px;
  line-height: 1.4;
}
.wiz-cde-preview {
  background: theme.$purple_tint;
  border: 1px solid theme.$purple_0_7;
  border-radius: 3px;
  padding: 12px 14px;
}
.wiz-kv {
  font-size: 13px;
  color: theme.$gray_5;
  margin-bottom: 8px;
  b {
    color: theme.$gray_6;
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
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  padding: 2px 8px;
  color: theme.$gray_5;
  &.more {
    border-style: dashed;
    color: theme.$gray_4;
  }
}
.wiz-two {
  display: flex;
  gap: 12px;
  :deep(.el-form-item) {
    flex: 1;
  }
}
.wiz-manual-flags,
.wiz-options {
  margin-top: 8px;
}
.wiz-option {
  margin-bottom: 16px;
  &:last-child {
    margin-bottom: 0;
  }
}
.wiz-option-desc {
  font-size: 12px;
  color: theme.$gray_5;
  line-height: 1.45;
  margin: 4px 0 0 24px;
}
.wiz-legend {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  li {
    font-size: 12px;
    color: theme.$gray_5;
    line-height: 1.7;
    b {
      color: theme.$gray_6;
      font-weight: 600;
    }
  }
}
.wiz-members {
  max-height: 340px;
  overflow-y: auto;
}
.wiz-members-head,
.wiz-member {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px 48px 48px;
  align-items: center;
  gap: 8px;
}
.wiz-members-head {
  position: sticky;
  top: 0;
  background: theme.$white;
  padding: 4px 0 8px;
  border-bottom: 1px solid theme.$gray_2;
  font-size: 12px;
  font-weight: 500;
  color: theme.$gray_5;
}
.wiz-member {
  padding: 10px 0;
  border-bottom: 1px solid theme.$gray_1;
}
.col-flag {
  display: flex;
  justify-content: center;
  :deep(.el-checkbox) {
    margin-right: 0;
  }
}
.wiz-member-sub {
  font-size: 12px;
  color: theme.$gray_4;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wiz-member-cde {
  color: theme.$gray_4;
}
.wiz-collision {
  color: theme.$orange_2;
}
.wiz-summary {
  font-size: 14px;
  color: theme.$gray_6;
  margin-bottom: 16px;
}
</style>
