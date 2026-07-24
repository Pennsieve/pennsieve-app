<template>
  <el-dialog
    :model-value="modelValue"
    title="Browse ontology"
    width="580px"
    @update:model-value="$emit('update:modelValue', $event)"
    @open="onOpen"
  >
    <div class="otp">
      <div class="otp-controls">
        <el-select v-model="scope" style="width: 160px" @change="onScopeChange">
          <el-option v-for="o in options" :key="o.ontology" :label="o.ontology" :value="o.ontology" />
        </el-select>
        <el-input
          v-model="term"
          style="flex: 1"
          placeholder="Search this ontology, or browse the tree below"
          clearable
          @input="onSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>

      <div class="otp-body">
        <div v-if="loading" class="otp-status">Loading…</div>

        <!-- Search results -->
        <template v-else-if="term.trim()">
          <div v-if="searching" class="otp-status">Searching…</div>
          <div v-else-if="!results.length" class="otp-status">No matching terms.</div>
          <ul v-else class="otp-results">
            <li
              v-for="r in results"
              :key="r.curie"
              :class="{ active: isPicked(r.curie) }"
              @click="pick(r)"
            >
              <span class="otp-label">{{ r.label }}</span>
              <span class="otp-code">{{ r.curie }}</span>
            </li>
          </ul>
        </template>

        <!-- Lazy tree -->
        <el-tree
          v-else
          :key="scope"
          class="otp-tree"
          node-key="curie"
          :props="treeProps"
          :load="loadNode"
          lazy
          :expand-on-click-node="false"
          highlight-current
          empty-text="No terms"
          @node-click="pick"
        >
          <template #default="{ data }">
            <span class="otp-node" :class="{ active: isPicked(data.curie) }">
              <span class="otp-label">{{ data.label }}</span>
              <span class="otp-code">{{ data.curie }}</span>
            </span>
          </template>
        </el-tree>
      </div>
    </div>

    <template #footer>
      <div class="otp-footer">
        <div v-if="picked.length" class="otp-picked">
          <el-tag
            v-for="p in visiblePicked"
            :key="p.curie"
            closable
            size="small"
            disable-transitions
            @close="unpick(p.curie)"
          >{{ p.label }}</el-tag>
          <el-tag v-if="hiddenPicked" size="small" type="info" disable-transitions :title="hiddenLabels">
            +{{ hiddenPicked }} more
          </el-tag>
        </div>
        <p v-else class="otp-picked-hint">
          {{ isTermset ? 'Pick one or more terms, or use the entire termset.' : 'Pick one or more terms for the value set.' }}
        </p>
        <div class="otp-actions">
          <el-button @click="$emit('update:modelValue', false)">Cancel</el-button>
          <el-button v-if="isTermset" @click="useTermset">Use entire termset</el-button>
          <el-button v-if="picked.length === 1" @click="useSubtreeRoot">Use subtree of this term</el-button>
          <el-button type="primary" :disabled="!picked.length" @click="useSelected">
            Use {{ picked.length ? picked.length + ' ' : '' }}selected term{{ picked.length === 1 ? '' : 's' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Search } from '@element-plus/icons-vue'
import debounce from 'lodash.debounce'
import { useOntologyStore } from '@/stores/ontologyStore'

defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'select'])

const store = useOntologyStore()

// UCUM is a flat unit list — not a browsable tree.
const options = computed(() => (store.available || []).filter((o) => o.ontology !== 'UCUM'))
const scope = ref('')
// The chosen vocabulary's registry entry. A termset (kind:'termset') is a curated
// flat list, so the whole set can be used as a value set (no single root term).
const scopeEntry = computed(() => (store.available || []).find((o) => o.ontology === scope.value) || null)
const isTermset = computed(() => scopeEntry.value?.kind === 'termset')
const loading = ref(false)
const term = ref('')
const results = ref([])
const searching = ref(false)
// Multi-pick: clicking a term toggles it into `picked`. Picks persist across scope
// changes so a value set can be composed from several ontologies/termsets.
const picked = ref([])
const isPicked = (curie) => picked.value.some((p) => p.curie === curie)
// Cap the chips shown in the footer; the rest collapse into a "+N more" tag.
const MAX_CHIPS = 10
const visiblePicked = computed(() => picked.value.slice(0, MAX_CHIPS))
const hiddenPicked = computed(() => Math.max(0, picked.value.length - MAX_CHIPS))
const hiddenLabels = computed(() => picked.value.slice(MAX_CHIPS).map((p) => p.label).join(', '))

const treeProps = { label: 'label', children: 'children', isLeaf: (d) => !d.has_children }
// Terms in a slice share the ontology's version (the tree rows don't carry it).
const scopeVersion = () => (store.available || []).find((o) => o.ontology === scope.value)?.ontology_version || ''

const loadOntology = async () => {
  loading.value = true
  try {
    if (scope.value) await store.ensureOntology(scope.value)
  } catch {
    /* leave the tree empty on failure */
  } finally {
    loading.value = false
  }
}

const onOpen = async () => {
  picked.value = []
  term.value = ''
  results.value = []
  loading.value = true
  try {
    await store.ensureRegistry()
    if (!scope.value && options.value.length) {
      scope.value = (options.value.find((o) => o.ontology === 'MONDO') || options.value[0]).ontology
    }
  } catch {
    /* registry unavailable */
  }
  await loadOntology()
}

const onScopeChange = async () => {
  // Keep picks when switching ontology so a set can span vocabularies.
  term.value = ''
  results.value = []
  await loadOntology()
}

const loadNode = async (node, resolve) => {
  try {
    resolve(node.level === 0 ? await store.roots(scope.value) : await store.children(node.data.curie))
  } catch {
    resolve([])
  }
}

const onSearch = debounce(async () => {
  const q = term.value.trim()
  if (!q) {
    results.value = []
    return
  }
  searching.value = true
  try {
    results.value = await store.search(q, { limit: 25, ontologies: [scope.value] })
  } catch {
    results.value = []
  } finally {
    searching.value = false
  }
}, 250)

// Toggle a term in/out of the picked set.
const pick = (node) => {
  if (!node || !node.curie) return
  const i = picked.value.findIndex((p) => p.curie === node.curie)
  if (i >= 0) picked.value.splice(i, 1)
  else picked.value.push({ curie: node.curie, label: node.label, ontology: scope.value, ontology_version: scopeVersion() })
}
const unpick = (curie) => {
  picked.value = picked.value.filter((p) => p.curie !== curie)
}

// Use the picked terms as the value set (exactly those terms, materialized).
const useSelected = () => {
  if (!picked.value.length) return
  emit('select', { terms: picked.value.map((p) => ({ ...p })) })
  emit('update:modelValue', false)
}

// One term picked: offer its is_a subtree instead of just the single term.
const useSubtreeRoot = () => {
  if (picked.value.length !== 1) return
  emit('select', { ...picked.value[0] })
  emit('update:modelValue', false)
}

// Use the entire termset as the value set (all members), not a single term's subtree.
const useTermset = () => {
  const e = scopeEntry.value
  if (!e) return
  emit('select', {
    termset: true,
    ontology: e.ontology,
    slug: e.slug,
    label: e.display_name || e.ontology,
    count: e.count,
    ontology_version: e.ontology_version || '',
  })
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
@use '../../../../styles/theme' as theme;

.otp-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.otp-body {
  min-height: 260px;
  max-height: 340px;
  overflow: auto;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  padding: 8px;
}
.otp-status {
  color: theme.$gray_4;
  font-size: 14px;
  padding: 8px;
}
.otp-results {
  list-style: none;
  margin: 0;
  padding: 0;
  li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 10px;
    border-radius: 3px;
    cursor: pointer;
    &:hover {
      background: theme.$gray_1;
    }
    &.active {
      background: theme.$purple_tint;
    }
  }
}
.otp-node {
  display: inline-flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding-right: 8px;
  &.active .otp-label {
    color: theme.$purple_2;
    font-weight: 500;
  }
}
.otp-label {
  color: theme.$gray_6;
}
.otp-code {
  flex-shrink: 0;
  font-size: 11px;
  color: theme.$gray_4;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.otp-footer {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}
.otp-picked {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.otp-picked-hint {
  margin: 0;
  font-size: 13px;
  color: theme.$gray_4;
}
.otp-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
