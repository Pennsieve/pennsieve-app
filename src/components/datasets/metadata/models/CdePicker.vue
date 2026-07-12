<template>
  <div class="cde-picker">
    <!-- Selected: show the linked CDE, strength, and a value/type preview -->
    <div v-if="selected" class="cde-selected">
      <div class="cde-selected-head">
        <div class="cde-selected-name">{{ selected.cde_name }}</div>
        <el-button text size="small" class="cde-detach" @click="detach">
          <el-icon><Close /></el-icon>
          <span>Detach</span>
        </el-button>
      </div>

      <p v-if="selected.cde_definition" class="cde-def">{{ selected.cde_definition }}</p>

      <div class="cde-field">
        <div class="cde-label">Binding strength</div>
        <el-radio-group v-model="strength" size="small" @change="emitBinding">
          <el-radio-button value="required">Required</el-radio-button>
          <el-radio-button value="preferred">Preferred</el-radio-button>
          <el-radio-button value="example">Example</el-radio-button>
        </el-radio-group>
        <div class="cde-hint">{{ strengthHint }}</div>
      </div>

      <div v-if="hasValues" class="cde-field">
        <div class="cde-label">
          Data type <span class="cde-strong">{{ selected.cde_data_type }}</span>
          <span class="cde-muted">· {{ pvCount }} allowed value{{ pvCount === 1 ? '' : 's' }}</span>
        </div>
        <div class="cde-values">
          <span v-for="(pv, i) in previewValues" :key="i" class="cde-chip">{{ pvLabel(pv) }}</span>
          <span v-if="pvCount > previewValues.length" class="cde-chip cde-chip-more">
            +{{ pvCount - previewValues.length }} more
          </span>
        </div>
      </div>

      <div v-if="xrefs.length" class="cde-xrefs">
        <span v-for="(x, i) in xrefs" :key="i" class="cde-chip cde-chip-ref">
          {{ x.system }}<template v-if="x.id">: {{ x.id }}</template>
        </span>
      </div>
    </div>

    <!-- Search: find a CDE to link -->
    <div v-else class="cde-search">
      <el-input
        v-model="term"
        placeholder="Search common data elements by name"
        clearable
        @input="onInput"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>

      <div v-if="searching || store.loading" class="cde-status">Searching…</div>
      <div v-else-if="store.error" class="cde-status cde-error">{{ store.error }}</div>
      <div v-else-if="searchError" class="cde-status cde-error">{{ searchError }}</div>
      <ul v-else-if="results.length" class="cde-results">
        <li
          v-for="r in results"
          :key="r.persistent_id || r.canonical_key"
          class="cde-result"
          @click="select(r)"
        >
          <div class="cde-result-name">{{ r.cde_name }}</div>
          <div class="cde-result-meta">
            <span>{{ r.cde_data_type }}</span>
            <span v-if="r.cde_source">· {{ r.cde_source }}</span>
          </div>
        </li>
      </ul>
      <div v-else-if="term.trim()" class="cde-status">No matching common data elements</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Search, Close } from '@element-plus/icons-vue'
import debounce from 'lodash.debounce'
import { useCdeCatalogStore } from '@/stores/cdeCatalogStore'

const props = defineProps({
  // The current binding intent: { persistent_id, strength } or null.
  modelValue: { type: Object, default: null },
})
// update:modelValue carries the binding intent { persistent_id, strength };
// select carries the full resolved CDE record (or null on detach) so a parent
// wizard can auto-fill name / type / description.
const emit = defineEmits(['update:modelValue', 'select'])

const store = useCdeCatalogStore()

const term = ref('')
const results = ref([])
const searching = ref(false)
const searchError = ref('')
const selected = ref(null) // full CDE record
const strength = ref('required')

const runSearch = async () => {
  const t = term.value.trim()
  if (!t) {
    results.value = []
    searching.value = false
    return
  }
  searching.value = true
  searchError.value = ''
  try {
    results.value = await store.search(t, 25)
  } catch (e) {
    results.value = []
    searchError.value = e?.message || String(e)
    console.error('CDE search failed:', e)
  } finally {
    searching.value = false
  }
}
const onInput = debounce(runSearch, 300)

const select = (cde) => {
  selected.value = cde
  if (!strength.value) strength.value = 'required'
  emitBinding()
  emit('select', cde)
}

const detach = () => {
  selected.value = null
  term.value = ''
  results.value = []
  emit('update:modelValue', null)
  emit('select', null)
}

const emitBinding = () => {
  if (!selected.value || !selected.value.persistent_id) return
  emit('update:modelValue', {
    persistent_id: selected.value.persistent_id,
    strength: strength.value,
  })
}

const hasValues = computed(
  () => Array.isArray(selected.value?.permissible_values) && selected.value.permissible_values.length > 0
)
const pvCount = computed(() => selected.value?.permissible_values?.length || 0)
const previewValues = computed(() => (selected.value?.permissible_values || []).slice(0, 8))
const pvLabel = (pv) => pv?.label || pv?.code || ''
const xrefs = computed(() => (Array.isArray(selected.value?.xrefs) ? selected.value.xrefs : []))

const strengthHint = computed(
  () =>
    ({
      required: 'Default. Records must use these values — the data type and allowed values are set by this CDE and enforced when records are saved.',
      preferred: 'Recommended values are shown as guidance. Not enforced.',
      example: 'Linked for reference only.',
    }[strength.value] || '')
)

// Hydrate from an existing binding when editing a property.
const hydrate = async () => {
  const binding = props.modelValue
  if (!binding || !binding.persistent_id) return
  strength.value = binding.strength || 'required'
  let record = null
  try {
    record = await store.getByPersistentId(binding.persistent_id)
  } catch {
    record = null
  }
  // Keep the binding even if the catalog can't resolve it right now.
  selected.value = record || {
    persistent_id: binding.persistent_id,
    cde_name: binding.persistent_id,
    cde_definition: '',
    permissible_values: [],
  }
}

onMounted(hydrate)

// If the parent clears the binding (e.g. dialog reused for another property), reset.
watch(
  () => props.modelValue,
  (v) => {
    if (!v && selected.value) {
      selected.value = null
      term.value = ''
      results.value = []
    }
  }
)
</script>

<style scoped lang="scss">
@use '../../../../styles/theme' as theme;

.cde-picker {
  font-size: 13px;
}

.cde-search {
  .cde-status {
    margin-top: 8px;
    color: theme.$gray_4;
    font-size: 13px;
  }
  .cde-error {
    color: theme.$status_red;
  }
}

.cde-results {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
}
.cde-result {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid theme.$gray_1;
  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: theme.$gray_1;
  }
  .cde-result-name {
    color: theme.$gray_6;
    font-weight: 500;
  }
  .cde-result-meta {
    color: theme.$gray_4;
    font-size: 12px;
    margin-top: 2px;
  }
}

.cde-selected {
  border: 1px solid theme.$purple_0_7;
  border-radius: 3px;
  padding: 12px 16px;
  background: theme.$purple_tint;
}
.cde-selected-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.cde-selected-name {
  color: theme.$gray_6;
  font-weight: 500;
}
.cde-detach {
  color: theme.$gray_4;
  span {
    margin-left: 4px;
  }
}
.cde-def {
  color: theme.$gray_5;
  margin: 6px 0 12px;
  line-height: 1.5;
}
.cde-field {
  margin-top: 12px;
}
.cde-label {
  color: theme.$gray_4;
  font-size: 12px;
  margin-bottom: 6px;
}
.cde-strong {
  color: theme.$gray_6;
  margin-left: 4px;
}
.cde-muted {
  color: theme.$gray_4;
}
.cde-hint {
  color: theme.$gray_5;
  font-size: 12px;
  margin-top: 6px;
  line-height: 1.4;
}
.cde-values,
.cde-xrefs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.cde-xrefs {
  margin-top: 12px;
}
.cde-chip {
  font-size: 12px;
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  padding: 2px 8px;
  color: theme.$gray_5;
}
.cde-chip-more {
  color: theme.$gray_4;
  background: transparent;
  border-style: dashed;
}
.cde-chip-ref {
  color: theme.$gray_4;
}
</style>
