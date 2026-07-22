<template>
  <bf-stage>
    <template #actions>
      <stage-actions>
        <template #left>
          <a class="back-to-resources-link" @click="goBackToResources">
            <IconArrowLeft :height="12" :width="12" />
            Resources
          </a>
        </template>
      </stage-actions>
    </template>

    <div class="ontology-browser">
      <div class="ob-head">
        <div class="ob-title-row">
          <h2>Ontology Browser</h2>
          <el-popover placement="bottom-start" :width="380" trigger="click" popper-class="ob-help-popper">
            <template #reference>
              <button type="button" class="ob-help-link">
                <el-icon><QuestionFilled /></el-icon> How it works
              </button>
            </template>
            <div class="ob-help">
              <p class="ob-help-lead">
                An <strong>ontology</strong> is a standard, shared vocabulary — biomedical terms with
                agreed meanings, stable IDs, and <code>is_a</code> relationships that place each term
                in a hierarchy (e.g. <em>type 2 diabetes</em> is a kind of <em>diabetes</em>).
              </p>
              <div class="ob-help-item">
                <div class="ob-help-h"><el-icon><PriceTag /></el-icon> Tag datasets</div>
                <p>Attach a term to a dataset so it's described in a standard way — making it easier
                  to find and compare datasets across the platform.</p>
              </div>
              <div class="ob-help-item">
                <div class="ob-help-h"><el-icon><Collection /></el-icon> Value sets in metadata</div>
                <p>Pick a term and use its subtree (all narrower terms) as the allowed values for a
                  property in a metadata model — so records are filled in with consistent, standardized
                  codes.</p>
              </div>
              <p class="ob-help-note">Pennsieve refreshes these vocabularies from their sources
                quarterly — each card shows the version it's on.</p>
            </div>
          </el-popover>
        </div>
        <p class="ob-sub">
          Standard biomedical vocabularies you can reuse across your workspace — <strong>tag
          datasets</strong> with standard terms and define <strong>value sets</strong> for metadata
          properties. Pick a vocabulary, then search or browse its hierarchy to find the right term.
        </p>
      </div>

      <!-- Vocabulary chooser -->
      <div v-if="booting" class="ob-status">Loading vocabularies…</div>
      <div v-else class="ob-onto-cards">
        <button
          v-for="o in browsableOntologies"
          :key="o.ontology"
          type="button"
          class="ob-onto-card"
          :class="{ 'is-active': o.ontology === selectedOntology }"
          @click="selectOntology(o.ontology)"
        >
          <span class="ob-onto-card-top">
            <span class="ob-onto-code">{{ o.ontology }}</span>
            <el-icon v-if="o.ontology === selectedOntology" class="ob-onto-check"><Check /></el-icon>
          </span>
          <span class="ob-onto-title">{{ ontologyMeta(o.ontology).title }}</span>
          <span class="ob-onto-desc">{{ ontologyMeta(o.ontology).desc }}</span>
          <span class="ob-onto-meta">
            <span class="ob-onto-count"><el-icon><List /></el-icon>{{ formatCount(o.count) }} terms</span>
            <span class="ob-onto-rel" :title="releaseTitle(o)"><el-icon><Calendar /></el-icon>{{ releaseDate(o) }}</span>
          </span>
        </button>
      </div>

      <div v-if="!booting && browsableOntologies.length" class="ob-request-row">
        <el-popover placement="top-start" :width="240" trigger="hover" popper-class="ob-help-popper">
          <template #reference>
            <span class="ob-request-icon" tabindex="0" role="button" aria-label="Request a different vocabulary">
              <el-icon><InfoFilled /></el-icon> Missing a vocabulary?
            </span>
          </template>
          <div class="ob-help ob-help-sm">
            Don't see the vocabulary you need?
            <a href="https://discover.pennsieve.io/support" target="_blank" rel="noopener noreferrer">
              Contact our team →
            </a>
          </div>
        </el-popover>
      </div>

      <div class="ob-controls">
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

        <div v-if="booting || ontologyLoading" class="ob-status">Loading ontology…</div>
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
          empty-text="No terms"
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

          <div v-if="sel.partOf.length" class="ob-field">
            <div class="ob-field-label">Part of</div>
            <div class="ob-chips">
              <button
                v-for="p in sel.partOf"
                :key="p.curie"
                class="ob-chip ob-chip-link"
                :title="p.curie"
                @click="openTerm({ curie: p.curie, label: p.label })"
              >{{ p.label }}</button>
            </div>
          </div>

          <div v-if="sel.xrefs.length" class="ob-field">
            <div class="ob-field-label">Cross-references</div>
            <div class="ob-chips">
              <span v-for="(x, i) in sel.xrefs" :key="i" class="ob-chip ob-chip-ref">{{ x }}</span>
            </div>
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
import { useRouter, useRoute } from 'vue-router'
import { Search, Check, PriceTag, Collection, QuestionFilled, InfoFilled, Calendar, List } from '@element-plus/icons-vue'
import debounce from 'lodash.debounce'
import { useOntologyStore } from '@/stores/ontologyStore'
import StageActions from '@/components/shared/StageActions/StageActions.vue'
import IconArrowLeft from '@/components/icons/IconArrowLeft.vue'

const store = useOntologyStore()

const router = useRouter()
const route = useRoute()

// Reachable from MyWorkspace and org workspaces — back within the same context.
const goBackToResources = () => {
  const orgId = route.params.orgId
  router.push(orgId ? { name: 'workspace-resources', params: { orgId } } : { name: 'resources' })
}

const CHILD_DISPLAY_CAP = 60 // chips in the drawer "narrower terms" list

const selectedOntology = ref('')
const booting = ref(true) // fetching the registry
const ontologyLoading = ref(false) // loading the selected ontology's slice

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
  lineage: [], children: [], childrenTruncated: false, xrefs: [], partOf: [], loading: false,
})

const splitPipe = (s) =>
  String(s || '')
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean)

const treeProps = {
  label: 'label',
  children: 'children',
  isLeaf: (data) => !data.has_children,
}
const treeKey = computed(() => `${selectedOntology.value}::${focus.value ? focus.value.curie : 'roots'}`)
const defaultExpandedKeys = computed(() => []) // top level is loaded directly; nothing to pre-expand

// Plain-language descriptions so users don't need to know the acronyms.
const ONTOLOGY_META = {
  MONDO: { title: 'Diseases & disorders', desc: 'Harmonized disease definitions merged from many disease resources.' },
  EPSO: { title: 'Epilepsy & seizures', desc: 'Epilepsy-specific terms — seizure types, syndromes, and ILAE classification.' },
  HPO: { title: 'Phenotypes & signs', desc: 'Human phenotypic abnormalities — symptoms and clinical findings.' },
  UBERON: { title: 'Anatomy', desc: 'Anatomical structures across species — organs, tissues, body parts.' },
  CL: { title: 'Cell types', desc: 'Types of cells across organisms — neurons, glia, immune cells, and more.' },
  NCBITaxon: { title: 'Organisms & species', desc: 'Taxonomy of species and higher groups — tag the organism a dataset studies.' },
  CHEBI: { title: 'Chemicals & drugs', desc: 'Chemical entities of biological interest — compounds, drugs, metabolites.' },
  NCIT: { title: 'Cancer & biomedical', desc: 'NCI Thesaurus — broad cancer and biomedical reference concepts.' },
  UCUM: { title: 'Units of measure', desc: 'Standard units for measurements.' },
}
const ontologyMeta = (name) => ONTOLOGY_META[name] || { title: name, desc: '' }
const formatCount = (n) => Number(n || 0).toLocaleString()

// The upstream release date is embedded in most ontology_version strings
// (e.g. "releases/2026-07-06"); fall back to our sync date when it isn't
// (e.g. ChEBI's "chebi/253"). The tooltip carries the exact version + sync.
const syncedDate = (o) => String(o.built_at || '').slice(0, 10)
const releaseDate = (o) => {
  const m = String(o.ontology_version || '').match(/\d{4}-\d{2}-\d{2}/)
  return m ? m[0] : syncedDate(o)
}
const releaseTitle = (o) => {
  const parts = []
  if (o.ontology_version) parts.push(`Version ${o.ontology_version}`)
  if (syncedDate(o)) parts.push(`synced ${syncedDate(o)}`)
  return parts.join(' · ')
}

// Preferred card order (and default landing = first). Anything not listed sorts
// after, alphabetically. UCUM is a flat unit list — not a browsable tree.
const ONTOLOGY_ORDER = ['MONDO', 'EPSO', 'HPO', 'UBERON', 'CL', 'NCBITaxon', 'CHEBI', 'NCIT']
const browsableOntologies = computed(() => {
  const rank = (o) => {
    const i = ONTOLOGY_ORDER.indexOf(o.ontology)
    return i === -1 ? ONTOLOGY_ORDER.length : i
  }
  return store.available
    .filter((o) => o.ontology !== 'UCUM')
    .slice()
    .sort((a, b) => rank(a) - rank(b) || a.ontology.localeCompare(b.ontology))
})
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
  sel.xrefs = []
  sel.partOf = []
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
      if (full.label) sel.label = full.label // corrects the title when navigated by curie
      sel.ontology = full.ontology || sel.ontology
      sel.ontology_version = full.ontology_version || ''
      sel.definition = full.definition || ''
      sel.synonyms = full.synonyms || ''
      sel.iri = full.iri || ''
      sel.xrefs = splitPipe(full.xrefs)
      // Resolve part_of target labels (curies -> readable names) in one query.
      const partCuries = splitPipe(full.part_of)
      if (partCuries.length) {
        const labels = await store.labelsFor(partCuries)
        if (sel.curie !== curie) return
        sel.partOf = partCuries.map((c) => ({ curie: c, label: labels.get(c) || c }))
      }
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

// Load only the selected ontology's slice (+edges) — not every ontology.
const loadSelected = async () => {
  if (!selectedOntology.value) return
  ontologyLoading.value = true
  try {
    await store.ensureOntology(selectedOntology.value)
  } catch (e) {
    console.error('Ontology load failed:', e)
  } finally {
    ontologyLoading.value = false
  }
}

const onOntologyChange = async () => {
  clearFocus()
  term.value = ''
  results.value = []
  await loadSelected()
}

const selectOntology = async (name) => {
  if (name === selectedOntology.value) return
  selectedOntology.value = name
  await onOntologyChange()
}

onMounted(async () => {
  try {
    await store.ensureRegistry()
    const first = browsableOntologies.value[0] || store.available[0]
    if (first) {
      selectedOntology.value = first.ontology
      await loadSelected()
    }
  } catch (e) {
    console.error('Ontology browser load failed:', e)
  } finally {
    booting.value = false
  }
})
</script>

<style scoped lang="scss">
@use '../../../../styles/theme' as theme;

.back-to-resources-link {
  display: inline-flex;
  align-items: center;
  align-self: center;
  gap: 4px;
  color: theme.$purple_3;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.ontology-browser {
  min-height: 500px;
  /* The stage-actions bar (back link) above already provides the top inset. */
  padding-top: 0;
}
.ob-title-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.ob-head h2 {
  font-size: 20px;
  line-height: 24px;
  margin: 0;
}
.ob-help-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 13px;
  color: theme.$purple_2;
  &:hover {
    text-decoration: underline;
  }
  .el-icon {
    font-size: 15px;
  }
}
.ob-sub {
  color: theme.$gray_5;
  max-width: 680px;
  margin: 8px 0 12px;
  line-height: 1.5;
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }
}
/* Vocabulary chooser — a row of selectable cards */
.ob-onto-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
  max-width: 940px;
}
.ob-onto-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  padding: 14px 16px;
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease;
  &:hover {
    border-color: theme.$purple_0_7;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
    transform: translateY(-1px);
  }
  &.is-active {
    border-color: theme.$purple_2;
    background: theme.$purple_tint;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.07);
  }
}
.ob-onto-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 18px;
}
.ob-onto-code {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: theme.$purple_2;
}
.ob-onto-check {
  color: theme.$purple_2;
  font-size: 16px;
}
.ob-onto-title {
  font-size: 15px;
  font-weight: 500;
  color: theme.$gray_6;
}
.ob-onto-desc {
  font-size: 12px;
  color: theme.$gray_5;
  line-height: 1.4;
  min-height: 4.2em; /* reserve 3 lines so the meta row aligns across cards */
}
.ob-onto-meta {
  display: flex;
  align-items: center;
  justify-content: space-between; /* count on the left, release date on the right */
  gap: 12px;
  margin-top: auto; /* pin the count + date to the bottom of the card */
  padding-top: 4px;
}
.ob-onto-count,
.ob-onto-rel {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: theme.$gray_4;
  .el-icon {
    font-size: 12px;
  }
}
.ob-request-row {
  margin: 0 0 24px;
}
.ob-request-icon {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: theme.$gray_4;
  cursor: default;
  .el-icon {
    font-size: 14px;
  }
  &:hover {
    color: theme.$purple_2;
  }
}
.ob-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
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

<!-- Popover content is teleported to <body>, so it can't be styled by the scoped
     block above; namespace it via popper-class instead. -->
<style lang="scss">
@use '../../../../styles/theme' as theme;

.ob-help-popper.el-popover {
  .ob-help-lead {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.5;
    color: theme.$gray_6;
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
    }
  }
  .ob-help-item {
    margin-top: 12px;
    p {
      margin: 4px 0 0;
      font-size: 12px;
      line-height: 1.5;
      color: theme.$gray_5;
    }
  }
  .ob-help-h {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    color: theme.$gray_6;
    .el-icon {
      color: theme.$purple_2;
      font-size: 15px;
    }
  }
  .ob-help-note {
    margin: 14px 0 0;
    padding-top: 12px;
    border-top: 1px solid theme.$gray_2;
    font-size: 12px;
    line-height: 1.5;
    color: theme.$gray_5;
  }
  .ob-help-sm {
    font-size: 13px;
    line-height: 1.5;
    color: theme.$gray_6;
    a {
      color: theme.$purple_2;
      text-decoration: none;
      &:hover {
        text-decoration: underline;
      }
    }
  }
}
</style>
