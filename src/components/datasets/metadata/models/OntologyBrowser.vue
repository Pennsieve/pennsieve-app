<template>
  <bf-stage>
    <div class="ontology-browser">
      <div class="ob-head">
        <h2>Ontology Browser</h2>
        <p class="ob-sub">
          Explore the standard biomedical ontologies published to the catalog (MONDO diseases, HPO
          phenotypes, UBERON anatomy, NCIt, and more). Browse the <code>is_a</code> hierarchy as a
          tree, or search for a term — the detail panel shows where a concept sits in the ontology.
        </p>
      </div>

      <div class="ob-controls">
        <el-select
          v-model="selectedOntology"
          class="ob-onto"
          placeholder="Ontology"
          @change="onOntologyChange"
        >
          <el-option
            v-for="s in store.sources"
            :key="s.ontology"
            :label="ontologyOptionLabel(s)"
            :value="s.ontology"
          />
        </el-select>

        <div class="ob-search-wrap">
          <el-input
            v-model="term"
            placeholder="Search terms in this ontology"
            clearable
            class="ob-search"
            @input="onSearch"
            @focus="resultsOpen = true"
            @blur="onSearchBlur"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <div v-if="showResults" class="ob-results">
            <div v-if="searching" class="ob-status">Searching…</div>
            <div v-else-if="!results.length" class="ob-status">No matching terms.</div>
            <ul v-else class="ob-result-list">
              <li
                v-for="r in results"
                :key="r.curie"
                class="ob-result"
                @mousedown.prevent="selectResult(r)"
              >
                <span class="ob-result-label">{{ r.label }}</span>
                <span class="ob-result-curie">{{ r.curie }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div v-if="store.error" class="ob-status ob-error">{{ store.error }}</div>

      <template v-else>
        <!-- Breadcrumb: ontology root → ancestors → focus -->
        <nav class="ob-crumbs" aria-label="Ontology lineage">
          <button class="ob-crumb ob-crumb-link" @click="clearFocus">{{ selectedOntology || 'Ontology' }}</button>
          <template v-for="(a, i) in focusLineage" :key="a.curie">
            <span class="ob-crumb-sep">›</span>
            <button class="ob-crumb ob-crumb-link" :title="a.curie" @click="focusTerm(a)">{{ a.label }}</button>
          </template>
          <template v-if="focus">
            <span class="ob-crumb-sep">›</span>
            <span class="ob-crumb ob-crumb-current" :title="focus.curie">{{ focus.label }}</span>
          </template>
        </nav>

        <div v-if="treeLoading" class="ob-status">Loading ontology…</div>
        <el-tree
          v-else
          :key="treeKey"
          ref="treeRef"
          class="ob-tree"
          node-key="curie"
          :props="treeProps"
          :load="loadNode"
          lazy
          :default-expanded-keys="defaultExpandedKeys"
          :expand-on-click-node="false"
          highlight-current
          @node-click="onNodeClick"
        >
          <template #default="{ data }">
            <span class="ob-node" :class="{ 'ob-node-active': sel.curie === data.curie }">
              <span class="ob-node-label">{{ data.label }}</span>
              <span class="ob-node-curie">{{ data.curie }}</span>
            </span>
          </template>
        </el-tree>
      </template>

      <!-- Detail drawer -->
      <el-drawer v-model="detailVisible" :title="sel.label || 'Term'" size="480px" direction="rtl">
        <div class="ob-detail">
          <p v-if="sel.definition" class="ob-def">{{ sel.definition }}</p>
          <p v-else-if="sel.loading" class="ob-def ob-muted">Loading…</p>

          <div class="ob-field">
            <div class="ob-field-label">Identifier</div>
            <code class="ob-code">{{ sel.curie }}</code>
          </div>

          <div class="ob-field">
            <div class="ob-field-label">Ontology</div>
            <div>
              {{ sel.ontology || selectedOntology }}
              <template v-if="sel.ontology_version"> · {{ sel.ontology_version }}</template>
            </div>
          </div>

          <div v-if="synonymList.length" class="ob-field">
            <div class="ob-field-label">Synonyms</div>
            <div class="ob-chips">
              <span v-for="(s, i) in synonymList" :key="i" class="ob-chip">{{ s }}</span>
            </div>
          </div>

          <div v-if="focusableSel" class="ob-field">
            <button class="ob-focus-btn" @click="focusSelected">Focus this term in the tree</button>
          </div>

          <div class="ob-field">
            <div class="ob-field-label">
              Broader terms<template v-if="!sel.loading"> ({{ sel.lineage.length }})</template>
            </div>
            <div v-if="sel.loading" class="ob-status">Loading…</div>
            <div v-else-if="sel.lineage.length" class="ob-chips">
              <button
                v-for="a in sel.lineage"
                :key="a.curie"
                class="ob-chip ob-chip-link"
                :title="a.curie"
                @click="focusTerm(a)"
              >{{ a.label }}</button>
            </div>
            <div v-else class="ob-muted">Top-level term.</div>
          </div>

          <div class="ob-field">
            <div class="ob-field-label">
              Narrower terms<template v-if="!sel.loading"> ({{ sel.children.length }}<template v-if="sel.childrenTruncated">+</template>)</template>
            </div>
            <div v-if="sel.loading" class="ob-status">Loading…</div>
            <div v-else-if="sel.children.length" class="ob-chips">
              <button
                v-for="k in sel.children"
                :key="k.curie"
                class="ob-chip ob-chip-link"
                :title="k.curie"
                @click="focusTerm(k)"
              >{{ k.label }}</button>
            </div>
            <div v-else class="ob-muted">No narrower terms (leaf).</div>
          </div>

          <a
            v-if="sel.iri"
            :href="sel.iri"
            target="_blank"
            rel="noopener noreferrer"
            class="ob-ext-link"
          >
            View source ontology entry →
          </a>
        </div>
      </el-drawer>
    </div>
  </bf-stage>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import debounce from 'lodash.debounce'
import { useOntologyStore } from '@/stores/ontologyStore'

const store = useOntologyStore()

const CHILD_DISPLAY_CAP = 60 // chips in the drawer "narrower terms" list

const selectedOntology = ref('')
const treeLoading = ref(true)

// Tree is rooted at `focus` (its direct children are the top level); when focus is
// null the top level is the ontology's roots. Remounting on treeKey re-runs the
// lazy root load — the simplest reliable way to re-seed a lazy el-tree.
const focus = ref(null) // { curie, label } | null
const focusLineage = ref([]) // breadcrumb ancestors of focus, root-first
const treeRef = ref(null)

const term = ref('')
const results = ref([])
const searching = ref(false)
const resultsOpen = ref(false)
const showResults = computed(() => resultsOpen.value && term.value.trim() !== '')

const detailVisible = ref(false)
const sel = reactive({
  curie: '', label: '', ontology: '', ontology_version: '', definition: '', synonyms: '', iri: '',
  lineage: [], children: [], childrenTruncated: false, loading: false,
})

const treeProps = {
  label: 'label',
  children: 'children',
  isLeaf: (data) => !data.has_children,
}
const treeKey = computed(() => `${selectedOntology.value}::${focus.value ? focus.value.curie : 'roots'}`)
const defaultExpandedKeys = computed(() => []) // top level is loaded directly; nothing to pre-expand

const ontologyOptionLabel = (s) =>
  s.ontology_version ? `${s.ontology} · ${s.ontology_version}` : s.ontology
const focusableSel = computed(() => sel.curie && (!focus.value || focus.value.curie !== sel.curie))
const synonymList = computed(() =>
  String(sel.synonyms || '')
    .split(/[|;]/)
    .map((s) => s.trim())
    .filter(Boolean)
)

// el-tree lazy loader. Level 0 = the tree's top level (focus's children, or the
// ontology roots); deeper levels = a node's direct children.
const loadNode = async (node, resolve) => {
  try {
    if (node.level === 0) {
      const rows = focus.value
        ? await store.children(focus.value.curie)
        : await store.roots(selectedOntology.value)
      resolve(rows)
      return
    }
    resolve(await store.children(node.data.curie))
  } catch (e) {
    console.error('Ontology tree load failed:', e)
    resolve([])
  }
}

const onNodeClick = (data) => openTerm(data)

// Populate the detail drawer: the node gives curie/label instantly, then hydrate
// the full record + lineage + children.
const openTerm = async (node) => {
  const curie = node.curie
  sel.curie = curie
  sel.label = node.label
  sel.ontology = node.ontology || ''
  sel.ontology_version = ''
  sel.definition = ''
  sel.synonyms = ''
  sel.iri = ''
  sel.lineage = []
  sel.children = []
  sel.childrenTruncated = false
  sel.loading = true
  detailVisible.value = true
  try {
    const [full, lineage, kids] = await Promise.all([
      store.getByCurie(curie),
      store.lineage(curie),
      store.children(curie, { limit: CHILD_DISPLAY_CAP + 1 }),
    ])
    if (sel.curie !== curie) return // a newer selection won the race
    if (full) {
      sel.ontology = full.ontology || sel.ontology
      sel.ontology_version = full.ontology_version || ''
      sel.definition = full.definition || ''
      sel.synonyms = full.synonyms || ''
      sel.iri = full.iri || ''
    }
    sel.lineage = lineage
    sel.childrenTruncated = kids.length > CHILD_DISPLAY_CAP
    sel.children = sel.childrenTruncated ? kids.slice(0, CHILD_DISPLAY_CAP) : kids
  } catch (e) {
    console.error('Ontology term detail load failed:', e)
  } finally {
    if (sel.curie === curie) sel.loading = false
  }
}

// Re-root the tree at a term and refresh the breadcrumb.
const focusTerm = async (node) => {
  focus.value = { curie: node.curie, label: node.label }
  term.value = ''
  results.value = []
  resultsOpen.value = false
  try {
    focusLineage.value = await store.lineage(node.curie)
  } catch {
    focusLineage.value = []
  }
}
const focusSelected = () => focusTerm({ curie: sel.curie, label: sel.label })
const clearFocus = () => {
  focus.value = null
  focusLineage.value = []
}

const runSearch = async () => {
  const t = term.value.trim()
  if (!t) {
    results.value = []
    return
  }
  searching.value = true
  try {
    results.value = await store.search(t, {
      limit: 25,
      ontologies: selectedOntology.value ? [selectedOntology.value] : null,
    })
  } catch (e) {
    console.error('Ontology search failed:', e)
    results.value = []
  } finally {
    searching.value = false
  }
}
const onSearch = debounce(runSearch, 300)
const onSearchBlur = () => setTimeout(() => { resultsOpen.value = false }, 150)

const selectResult = async (r) => {
  await focusTerm(r) // re-root the tree at the found term
  openTerm(r) // and open its detail
}

const onOntologyChange = () => {
  clearFocus()
  term.value = ''
  results.value = []
}

onMounted(async () => {
  try {
    await store.ensureLoaded()
    if (store.sources.length) selectedOntology.value = store.sources[0].ontology
  } catch (e) {
    console.error('Ontology browser load failed:', e)
  } finally {
    treeLoading.value = false
  }
})
</script>

<style scoped lang="scss">
@use '../../../../styles/theme' as theme;

.ontology-browser {
  min-height: 500px;
}
.ob-head h2 {
  font-size: 20px;
  line-height: 24px;
  margin: 0;
}
.ob-sub {
  color: theme.$gray_5;
  max-width: 680px;
  margin: 8px 0 20px;
  line-height: 1.5;
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }
}
.ob-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}
.ob-onto {
  width: 200px;
}
.ob-search-wrap {
  position: relative;
  flex: 1;
  min-width: 260px;
  max-width: 420px;
}
.ob-search {
  width: 100%;
}
.ob-results {
  position: absolute;
  z-index: 10;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  max-height: 360px;
  overflow-y: auto;
}
.ob-result-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.ob-result {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
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
.ob-result-label {
  color: theme.$gray_6;
}
.ob-result-curie {
  font-size: 12px;
  color: theme.$gray_4;
  white-space: nowrap;
}
.ob-status {
  color: theme.$gray_4;
  font-size: 14px;
  padding: 8px 0;
}
.ob-error {
  color: theme.$status_red;
}
.ob-muted {
  color: theme.$gray_4;
}
.ob-crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
  font-size: 13px;
}
.ob-crumb {
  padding: 2px 4px;
}
.ob-crumb-link {
  color: theme.$purple_2;
  cursor: pointer;
  background: none;
  border: none;
  &:hover {
    text-decoration: underline;
  }
}
.ob-crumb-current {
  color: theme.$gray_6;
  font-weight: 500;
}
.ob-crumb-sep {
  color: theme.$gray_3;
}
.ob-tree {
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  padding: 8px;
  min-height: 240px;
}
.ob-node {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.ob-node-active .ob-node-label {
  color: theme.$purple_2;
}
.ob-node-label {
  color: theme.$gray_6;
}
.ob-node-curie {
  font-size: 11px;
  color: theme.$gray_4;
}
.ob-detail {
  padding: 0 4px;
}
.ob-def {
  color: theme.$gray_6;
  line-height: 1.5;
  margin: 0 0 16px;
}
.ob-field {
  margin-bottom: 16px;
}
.ob-field-label {
  font-size: 12px;
  font-weight: 500;
  color: theme.$gray_5;
  margin-bottom: 6px;
}
.ob-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ob-chip {
  font-size: 12px;
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  padding: 2px 8px;
  color: theme.$gray_5;
}
.ob-chip-link {
  cursor: pointer;
  color: theme.$purple_2;
  border-color: theme.$purple_0_7;
  &:hover {
    background: theme.$purple_tint;
  }
}
.ob-focus-btn {
  font-size: 13px;
  color: theme.$purple_2;
  background: none;
  border: 1px solid theme.$purple_0_7;
  border-radius: 3px;
  padding: 6px 12px;
  cursor: pointer;
  &:hover {
    background: theme.$purple_tint;
  }
}
.ob-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: theme.$purple_2;
}
.ob-ext-link {
  display: inline-block;
  margin-top: 8px;
  font-size: 13px;
  color: theme.$purple_2;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
}
</style>
