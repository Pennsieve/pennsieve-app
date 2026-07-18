<template>
  <div class="pf" :class="{ 'pf-inline': inline }">
    <div v-if="inline" class="pf-head">
      <span class="pf-title">Add property</span>
      <el-button text size="small" @click="$emit('cancel')"><el-icon><Close /></el-icon></el-button>
    </div>

    <!-- SOURCE -->
    <div class="pf-section">
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

    <!-- CATALOG PATH -->
    <template v-if="sourceMode === 'catalog'">
      <!-- Search (nothing selected yet) -->
      <div v-if="!selectionKind" class="pf-section pf-divided">
        <el-input v-model="term" placeholder="Search common data elements" clearable @input="onSearchInput">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>

        <cde-facets :facet-values="facetValues" v-model="facets" @change="runSearch" />

        <div v-if="searching" class="wiz-status">Searching…</div>
        <div v-else-if="searchError" class="wiz-status wiz-error">{{ searchError }}</div>
        <div v-else class="wiz-results">
          <template v-if="results.bundles.length">
            <div class="wiz-group">Bundles</div>
            <ul class="wiz-list">
              <el-tooltip
                v-for="b in results.bundles"
                :key="'b:' + b.bundle_name"
                placement="top"
                effect="light"
                :show-after="350"
              >
                <template #content>
                  <div style="max-width: 340px">
                    <div style="font-size: 12px; opacity: 0.7">
                      bundle · {{ b.member_count }} element{{ b.member_count === 1 ? '' : 's' }}
                      <template v-if="b.domain"> · {{ b.domain }}</template>
                    </div>
                    <div v-if="bundleOrigin(b)" style="margin-top: 4px; font-size: 12px; opacity: 0.7">
                      Origin: {{ bundleOrigin(b) }}
                    </div>
                    <div style="margin-top: 6px; font-size: 12px">
                      <template v-if="!bundlePreviews[b.bundle_name] || bundlePreviews[b.bundle_name].loading">
                        Loading members…
                      </template>
                      <template v-else>{{ bundlePreview(b) }}</template>
                    </div>
                  </div>
                </template>
                <li class="wiz-row" @click="chooseBundle(b)" @mouseenter="loadBundlePreview(b.bundle_name)">
                  <span class="wiz-row-name">{{ b.bundle_name }}</span>
                  <span class="wiz-row-meta">bundle · {{ b.member_count }} element{{ b.member_count === 1 ? '' : 's' }}</span>
                </li>
              </el-tooltip>
            </ul>
          </template>
          <template v-if="results.cdes.length">
            <div class="wiz-group">Common data elements</div>
            <ul class="wiz-list">
              <el-tooltip
                v-for="c in results.cdes"
                :key="'c:' + c.persistent_id"
                placement="top"
                effect="light"
                :show-after="350"
                :disabled="!c.cde_definition && !cdeValuesPreview(c)"
              >
                <template #content>
                  <div style="max-width: 340px">
                    <div v-if="c.cde_definition && c.cde_definition !== cdeLabel(c)" style="margin-bottom: 6px; line-height: 1.45">
                      {{ c.cde_definition }}
                    </div>
                    <div style="font-size: 12px; opacity: 0.7">
                      {{ c.cde_data_type }}
                      <template v-if="c.permissible_values && c.permissible_values.length">
                        · {{ c.permissible_values.length }} allowed value{{ c.permissible_values.length === 1 ? '' : 's' }}
                      </template>
                    </div>
                    <div v-if="c.cde_source || c.steward_org || c.registration_status" style="margin-top: 4px; font-size: 12px; opacity: 0.7">
                      Origin: {{ c.cde_source || c.steward_org }}
                      <template v-if="c.steward_org && c.cde_source"> · {{ c.steward_org }}</template>
                      <template v-if="c.registration_status"> · {{ c.registration_status }}</template>
                    </div>
                    <div v-if="cdeValuesPreview(c)" style="margin-top: 6px; font-size: 12px">
                      {{ cdeValuesPreview(c) }}
                    </div>
                  </div>
                </template>
                <li class="wiz-row" @click="chooseCde(c)">
                  <span class="wiz-row-name">{{ cdeLabel(c) }}</span>
                  <span class="wiz-row-meta">
                    {{ c.cde_data_type }}
                    <template v-if="c._bundles && c._bundles.length"> · part of {{ c._bundles.join(', ') }}</template>
                  </span>
                </li>
              </el-tooltip>
            </ul>
          </template>
          <div
            v-if="(term.trim() || facets.disease.length || facets.domain.length || facets.tier.length) && !results.bundles.length && !results.cdes.length"
            class="wiz-status"
          >
            No matching common data elements
          </div>
        </div>
      </div>

      <!-- Selected element / bundle -->
      <template v-else>
        <div class="pf-section pf-divided">
          <div class="wiz-selected-head">
            <span class="wiz-selected-name">
              {{ selectionKind === 'bundle' ? selectedBundleName : cdeLabel(selectedCde) }}
              <span class="wiz-selected-meta">
                <template v-if="selectionKind === 'bundle'">· bundle · {{ memberRows.length }} elements</template>
                <template v-else>· {{ selectedCde && selectedCde.cde_data_type }}</template>
              </span>
            </span>
            <el-button text size="small" @click="clearSelection"><el-icon><Close /></el-icon> Change</el-button>
          </div>
        </div>

        <!-- Bundle strength: applies to all members (single-CDE strength sits
             next to its value list, below). -->
        <div v-if="selectionKind === 'bundle'" class="pf-section">
          <div class="wiz-label">Binding strength (applies to all members)</div>
          <el-radio-group v-model="strength" size="small">
            <el-radio-button value="required">Required</el-radio-button>
            <el-radio-button value="preferred">Preferred</el-radio-button>
            <el-radio-button value="example">Example</el-radio-button>
          </el-radio-group>
          <div class="wiz-hint">{{ strengthHint }}</div>
        </div>
        <!-- Single CDE -->
        <template v-if="selectionKind === 'cde'">
          <div class="pf-section pf-divided">
            <div class="pf-section-title">General</div>
            <el-form label-position="top">
              <el-form-item label="Display name">
                <el-input v-model="basics.displayName" @input="onDisplayNameInput" />
              </el-form-item>
              <el-form-item label="Property name">
                <el-input v-model="basics.name" />
              </el-form-item>
              <el-form-item label="Description">
                <el-input v-model="basics.description" type="textarea" :rows="3" />
              </el-form-item>
            </el-form>
            <p v-if="!cdeValues.length" class="wiz-hint" style="margin-top: 0">
              No controlled value list — linking sets the data type and records that this field follows the standard.
            </p>
          </div>

          <div v-if="cdeValues.length" class="pf-section pf-divided">
            <div class="pf-section-title">Data values</div>
            <div class="pf-field">
              <div class="wiz-label">Binding strength</div>
              <el-radio-group v-model="strength" size="small">
                <el-radio-button value="required">Required</el-radio-button>
                <el-radio-button value="preferred">Preferred</el-radio-button>
                <el-radio-button value="example">Example</el-radio-button>
              </el-radio-group>
              <div class="wiz-hint">{{ strengthHint }}</div>
            </div>
            <div class="pf-field">
              <div class="wiz-label">Allowed values ({{ cdeValues.length }})</div>
              <div class="wiz-values">
                <span v-for="(v, i) in cdeValues.slice(0, 8)" :key="i" class="wiz-chip">{{ v }}</span>
                <span v-if="cdeValues.length > 8" class="wiz-chip more">+{{ cdeValues.length - 8 }} more</span>
              </div>
            </div>
          </div>

          <div class="pf-section pf-divided">
            <div class="pf-section-title">Options</div>
            <div class="wiz-options">
              <div v-for="f in optionFlags" :key="f.key" class="wiz-option">
                <el-checkbox v-model="options[f.key]">{{ f.label }}</el-checkbox>
                <p class="wiz-option-desc">{{ f.desc }}</p>
              </div>
            </div>
          </div>
        </template>

        <!-- Bundle: members table (per-member behavior) -->
        <template v-else>
          <div class="pf-section">
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
                    <el-tooltip
                      placement="top"
                      effect="light"
                      :show-after="350"
                      :disabled="!m.cde.cde_definition && !cdeValuesPreview(m.cde)"
                    >
                      <template #content>
                        <div style="max-width: 340px">
                          <div v-if="m.cde.cde_definition" style="margin-bottom: 6px; line-height: 1.45">
                            {{ m.cde.cde_definition }}
                          </div>
                          <div style="font-size: 12px; opacity: 0.7">
                            {{ m.cde.cde_data_type }}
                            <template v-if="m.cde.permissible_values && m.cde.permissible_values.length">
                              · {{ m.cde.permissible_values.length }} allowed value{{ m.cde.permissible_values.length === 1 ? '' : 's' }}
                            </template>
                          </div>
                          <div v-if="cdeValuesPreview(m.cde)" style="margin-top: 6px; font-size: 12px">
                            {{ cdeValuesPreview(m.cde) }}
                          </div>
                        </div>
                      </template>
                      <span class="wiz-member-cde">{{ cdeLabel(m.cde) }} · {{ m.cde.cde_data_type }}</span>
                    </el-tooltip>
                    <span v-if="collides(m.name, i)" class="wiz-collision"> · name in use</span>
                  </div>
                </div>
                <div class="col-flag"><el-checkbox v-model="m.required" /></div>
                <div class="col-flag"><el-checkbox v-model="m.isKey" /></div>
                <div class="col-flag"><el-checkbox v-model="m.isSensitive" /></div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </template>

    <!-- MANUAL PATH -->
    <template v-else-if="sourceMode === 'manual'">
      <div class="pf-section">
        <div class="pf-section-title">General</div>
        <el-form label-position="top">
          <el-form-item label="Display name">
            <el-input v-model="basics.displayName" @input="onDisplayNameInput" />
          </el-form-item>
          <el-form-item label="Property name">
            <el-input v-model="basics.name" />
          </el-form-item>
          <el-form-item label="Description">
            <el-input v-model="basics.description" type="textarea" :rows="3" />
          </el-form-item>
        </el-form>
      </div>

      <div class="pf-section pf-divided">
        <div class="pf-section-title">Data type</div>
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

      <div class="pf-section pf-divided">
        <div class="pf-section-title">Data values</div>
        <el-form label-position="top">
          <el-form-item label="Allowed values">
            <!-- Type a list, or fill from an ontology term's subtree. -->
            <template v-if="!subtreeRoot">
              <el-input v-model="manual.enumInput" placeholder="Comma-separated, e.g. Low, Medium, High" />
              <div style="margin-top: 8px; width: 100%; display: flex; gap: 8px">
                <el-select v-model="ontoScope" style="width: 150px" @change="runOntoSearch">
                  <el-option v-for="o in ontoOptions" :key="o.ontology" :label="o.ontology" :value="o.ontology" />
                </el-select>
                <el-input
                  v-model="ontoTerm"
                  style="flex: 1"
                  :placeholder="`…or fill from a ${ontoScope || 'an ontology'} term's subtree — e.g. diabetes`"
                  @input="runOntoSearch"
                >
                  <template #prefix><el-icon><Search /></el-icon></template>
                </el-input>
                <el-button @click="pickerOpen = true">Browse…</el-button>
              </div>
              <div style="width: 100%">
                <ul v-if="ontoResults.length" class="onto-results">
                  <li v-for="c in ontoResults" :key="c.curie" @click="selectSubtreeRoot(c)">
                    <span>{{ c.label }}</span>
                    <span class="onto-results-meta">{{ ontoMeta(c) }}</span>
                  </li>
                </ul>
              </div>
            </template>

            <!-- A term is chosen: granularity + a readable preview of the members. -->
            <div v-else class="onto-subtree">
              <div class="onto-subtree-head">
                <span>From <strong>{{ subtreeRoot.label }}</strong> <span class="onto-subtree-code">{{ subtreeRoot.curie }}</span></span>
                <el-button text @click="clearSubtree">change</el-button>
              </div>
              <div class="onto-subtree-controls">
                <el-select v-model="subtreeDepth" style="width: 160px" @change="applySubtree">
                  <el-option label="All descendants" value="all" />
                  <el-option label="Direct children" value="1" />
                  <el-option label="2 levels" value="2" />
                  <el-option label="3 levels" value="3" />
                </el-select>
                <el-checkbox v-model="subtreeLeaves" @change="applySubtree">Most specific only</el-checkbox>
              </div>
              <div v-if="valueDomain" class="onto-subtree-count">
                {{ valueDomain.count.toLocaleString() }}
                value{{ valueDomain.count === 1 ? '' : 's' }} · {{ subtreeScopeLabel }}
              </div>
              <ul v-if="subtreePreview.length" class="onto-subtree-list">
                <li v-for="m in subtreePreview" :key="m.curie">
                  <span class="onto-subtree-item-label">{{ m.label }}</span>
                  <span class="onto-subtree-code">{{ m.curie }}</span>
                </li>
              </ul>
              <div v-if="valueDomain && valueDomain.count > subtreePreview.length" class="onto-subtree-more">
                …and {{ (valueDomain.count - subtreePreview.length).toLocaleString() }} more
              </div>
              <div v-if="subtreeNote" class="wiz-hint" style="margin-top: 6px">{{ subtreeNote }}</div>
            </div>
            <OntologyTreePicker v-model="pickerOpen" @select="selectSubtreeRoot" />
          </el-form-item>
          <template v-if="manual.type === 'string' && !hasControlledValues">
            <div class="wiz-two">
              <el-form-item label="Min length"><el-input v-model="manual.minLength" /></el-form-item>
              <el-form-item label="Max length"><el-input v-model="manual.maxLength" /></el-form-item>
            </div>
            <el-form-item label="Pattern (regex)"><el-input v-model="manual.pattern" /></el-form-item>
          </template>
          <p v-else-if="manual.type === 'string'" class="wiz-hint" style="margin-top: 0">
            Values come from the allowed list above, so length and pattern don't apply.
          </p>
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
      </div>

      <div class="pf-section pf-divided">
        <div class="pf-section-title">Options</div>
        <div class="wiz-options">
          <div v-for="f in optionFlags" :key="f.key" class="wiz-option">
            <el-checkbox v-model="options[f.key]">{{ f.label }}</el-checkbox>
            <p class="wiz-option-desc">{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </template>

    <!-- ACTIONS -->
    <div class="pf-footer">
      <el-button @click="$emit('cancel')">Cancel</el-button>
      <el-button type="primary" :disabled="!canAdd" @click="add">{{ addLabel }}</el-button>
    </div>
  </div>
</template>

<script setup>
// Single-screen property builder (progressive disclosure — no inner steps).
// Rendered inline in the create-model Properties step, and inside a dialog by
// AddPropertyWizard. Emits `save` with an array of property defs.
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Link, EditPen, Search, Close } from '@element-plus/icons-vue'
import debounce from 'lodash.debounce'
import { useCdeCatalogStore } from '@/stores/cdeCatalogStore'
import { useOntologyStore } from '@/stores/ontologyStore'
import CdeFacets from './CdeFacets.vue'
import OntologyTreePicker from './OntologyTreePicker.vue'

const props = defineProps({
  existingProperties: { type: Array, default: () => [] },
  inline: { type: Boolean, default: false },
})
const emit = defineEmits(['save', 'cancel'])

const store = useCdeCatalogStore()
const ontology = useOntologyStore()

// Prototype: fill a custom property's allowed values from an open-ontology
// subtree (all is_a descendants of a term) — the ontology → value-set bridge.
const ontoTerm = ref('')
const ontoResults = ref([])
const subtreeNote = ref('')
const subtreeRoot = ref(null) // { curie, label, ontology, ontology_version }
const subtreeDepth = ref('all') // 'all' | '1' | '2' | '3'
const subtreeLeaves = ref(false)
const valueDomain = ref(null) // the materialized ontology-subtree value domain (or null)
const SUBTREE_INLINE_CAP = 512
const PREVIEW_CAP = 200 // rows rendered in the selection preview (large sets show a sample + count)
const subtreePreview = ref([]) // [{ curie, label }] — a readable preview of the resolved members

const subtreeScopeLabel = computed(() => {
  const vd = valueDomain.value
  if (!vd) return ''
  const depth = vd.max_depth == null ? 'all descendants' : `depth ≤ ${vd.max_depth}`
  return depth + (vd.leaves_only ? ', most-specific only' : '')
})

// A property's values are a controlled set when an ontology subtree is chosen or
// an allowed-values list is typed in. Then length/pattern don't apply — the value
// is validated by membership, and a stray constraint would reject valid codes.
const hasControlledValues = computed(
  () => !!valueDomain.value || !!(manual.enumInput && manual.enumInput.trim())
)

// Scope the term search to one ontology: searching every ontology at once scans
// ~600k+ terms (NCiT + ChEBI + …) and is slow; a single ontology loads only that
// slice and scans only its columns.
const ontoScope = ref('')
const ontoOptions = computed(() => (ontology.available || []).filter((o) => o.ontology !== 'UCUM'))
const pickerOpen = ref(false) // the browse-the-tree dialog

onMounted(async () => {
  try {
    await ontology.ensureRegistry()
    if (!ontoScope.value && ontoOptions.value.length) {
      const pref = ontoOptions.value.find((o) => o.ontology === 'MONDO') || ontoOptions.value[0]
      ontoScope.value = pref.ontology
    }
  } catch {
    /* registry unavailable — search falls back to all loaded ontologies */
  }
})

const runOntoSearch = debounce(async () => {
  const q = ontoTerm.value.trim()
  if (!q) { ontoResults.value = []; return }
  try {
    const ontologies = ontoScope.value ? [ontoScope.value] : null
    ontoResults.value = (await ontology.search(q, { limit: 8, ontologies })).filter((r) => r.ontology !== 'UCUM')
  } catch (e) {
    ontoResults.value = []
  }
}, 200)
const ontoMeta = (c) => (c.curie.startsWith(c.ontology + ':') ? c.curie : `${c.ontology} · ${c.curie}`)

const selectSubtreeRoot = (term) => {
  subtreeRoot.value = {
    curie: term.curie,
    label: term.label,
    ontology: term.ontology,
    ontology_version: term.ontology_version,
  }
  ontoResults.value = []
  ontoTerm.value = ''
  applySubtree()
}
const clearSubtree = () => {
  subtreeRoot.value = null
  valueDomain.value = null
  subtreePreview.value = []
  subtreeNote.value = ''
  ontoTerm.value = ''
  ontoResults.value = []
}

// Resolve the value set from the chosen root + granularity (depth / leaves-only)
// and hold it as a materialized value_domain. Under the inline cap it carries the
// {code,label} members (materialized to an enum + labels at build); over the cap
// it's a subtree REFERENCE (root + version + granularity) enforced by a membership
// check — never an inline dump. Value-set members are the ontology CODES (curies).
const applySubtree = async () => {
  const root = subtreeRoot.value
  if (!root) return
  subtreeNote.value = 'Loading…'
  try {
    const maxDepth = subtreeDepth.value === 'all' ? null : Number(subtreeDepth.value)
    const descs = await ontology.descendants(root.curie, { maxDepth, leavesOnly: subtreeLeaves.value, limit: 10000 })
    const memberTerms = subtreeLeaves.value ? descs : [{ curie: root.curie, label: root.label }, ...descs]

    const overCap = memberTerms.length > SUBTREE_INLINE_CAP
    valueDomain.value = {
      kind: 'subtree',
      ontology: root.ontology,
      root_curie: root.curie,
      root_label: root.label,
      ontology_version: root.ontology_version,
      max_depth: maxDepth,
      leaves_only: subtreeLeaves.value,
      count: memberTerms.length,
      over_cap: overCap,
      members: overCap ? null : memberTerms.map((m) => ({ code: m.curie, label: m.label })),
    }
    // Readable preview (labels, not codes). enumInput stays empty — the schema is
    // built from valueDomain, so we never dump raw curies into the visible box.
    subtreePreview.value = memberTerms.slice(0, PREVIEW_CAP).map((m) => ({ curie: m.curie, label: m.label }))
    manual.enumInput = ''
    subtreeNote.value = overCap
      ? `Over the ${SUBTREE_INLINE_CAP}-value inline cap — stored as a subtree reference (root + version + granularity) ` +
        `and enforced by a membership check rather than an inline list. Narrow the root or lower the depth to inline it.`
      : ''
  } catch (e) {
    valueDomain.value = null
    subtreePreview.value = []
    subtreeNote.value = 'Could not load subtree: ' + (e?.message || e)
  }
}

// Materialize the chosen ontology value domain onto a property schema: the concept
// anchor always; under the cap an enum (codes) + display labels; over the cap the
// subtree reference (membership-enforced at record write, VALSET-style).
const applyValueDomain = (schema, vd) => {
  schema['x-pennsieve-concept'] = {
    curie: vd.root_curie,
    label: vd.root_label,
    ontology: vd.ontology,
    ontology_version: vd.ontology_version,
  }
  if (vd.over_cap) {
    delete schema.enum
    const ref = {
      tier: 'subtree',
      ontology: vd.ontology,
      root: vd.root_curie,
      ontology_version: vd.ontology_version,
      count: vd.count,
    }
    if (vd.max_depth != null) ref.max_depth = vd.max_depth
    if (vd.leaves_only) ref.leaves_only = true
    schema['x-pennsieve-concept-valueset'] = ref
  } else {
    schema.type = schema.type || 'string'
    schema.enum = vd.members.map((m) => m.code)
    schema['x-pennsieve-concept-values'] = vd.members
  }
}

const sourceMode = ref('') // '' | 'catalog' | 'manual'

// Catalog search
const term = ref('')
const results = ref({ bundles: [], cdes: [] })
const searching = ref(false)
const searchError = ref('')

// Facets (disease / domain / tier, from CDE classifications) — multi-select.
const facetValues = ref({ diseases: [], domains: [], tiers: [] })
const facets = ref({ disease: [], domain: [], tier: [] })

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

const cdeValues = computed(() =>
  ((selectedCde.value && selectedCde.value.permissible_values) || []).map((pv) => pv.label || pv.code || '')
)
// Strength only matters when the CDE carries a value list to enforce.
const selectedHasValues = computed(() => cdeValues.value.length > 0)
const strengthHint = computed(
  () =>
    ({
      required: 'Records must use these values (enforced on save).',
      preferred: 'Recommended values, shown as guidance — not enforced.',
      example: 'Linked for reference only.',
    }[strength.value] || '')
)
// Short comma-joined preview of a CDE's allowed values, for the hover tooltip.
const cdeValuesPreview = (c) => {
  const pvs = ((c && c.permissible_values) || []).map((pv) => pv.label || pv.code || '').filter(Boolean)
  if (!pvs.length) return ''
  const head = pvs.slice(0, 6).join(', ')
  return pvs.length > 6 ? `${head} +${pvs.length - 6} more` : head
}

// Display label for a CDE: the readable question text when present, else the
// (sometimes cryptic) canonical name. Used for list rows / headers only — the
// derived property name still uses cde_name (a full question is a poor name).
const cdeLabel = (c) => (c && (c.preferred_question_text || c.cde_name)) || ''

// Bundle member names, lazy-loaded + cached on hover (not in the search result).
const bundlePreviews = reactive({})
const uniq = (arr) => [...new Set(arr.filter(Boolean))]
const loadBundlePreview = async (name) => {
  if (bundlePreviews[name]) return
  bundlePreviews[name] = { loading: true, names: [], sources: [], stewards: [] }
  try {
    const members = await store.getBundleMembers(name)
    bundlePreviews[name] = {
      loading: false,
      names: members.map((m) => cdeLabel(m)).filter(Boolean),
      sources: uniq(members.map((m) => m.cde_source)),
      stewards: uniq(members.map((m) => m.steward_org)),
    }
  } catch (e) {
    bundlePreviews[name] = { loading: false, names: [], sources: [], stewards: [] }
  }
}
const bundlePreview = (b) => {
  const p = bundlePreviews[b.bundle_name]
  if (!p || !p.names.length) return 'No members'
  const head = p.names.slice(0, 8).join(', ')
  return p.names.length > 8 ? `${head} +${p.names.length - 8} more` : head
}
// Origin derived from the bundle's member CDEs (usually a single shared source).
const bundleOrigin = (b) => {
  const p = bundlePreviews[b.bundle_name]
  if (!p || p.loading) return ''
  const parts = []
  if (p.sources.length) parts.push(p.sources.length === 1 ? p.sources[0] : `${p.sources.length} sources`)
  if (p.stewards.length === 1) parts.push(p.stewards[0])
  return parts.join(' · ')
}

const canAdd = computed(() => {
  if (sourceMode.value === 'manual') return !!basics.name
  if (sourceMode.value === 'catalog') {
    if (selectionKind.value === 'bundle') return memberRows.value.length > 0
    if (selectionKind.value === 'cde') return !!basics.name
  }
  return false
})
const addLabel = computed(() => {
  if (isBundle.value) {
    const n = memberRows.value.length
    return `Add ${n} propert${n === 1 ? 'y' : 'ies'}`
  }
  return 'Add property'
})

const setSource = (mode) => {
  sourceMode.value = mode
  if (mode === 'catalog' && !selectionKind.value) {
    loadFacets()
    runSearch()
  }
}

const loadFacets = async () => {
  try {
    facetValues.value = await store.getFacetValues()
  } catch (e) {
    facetValues.value = { diseases: [], domains: [], tiers: [] } // facets are optional
  }
}

const runSearch = async () => {
  searching.value = true
  searchError.value = ''
  try {
    results.value = await store.searchCatalog(term.value, {
      disease: facets.value.disease,
      domain: facets.value.domain,
      tier: facets.value.tier,
    })
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

const add = () => {
  const defs = isBundle.value ? buildBundleDefs() : [buildSingleDef()]
  if (!defs.length) return
  emit('save', defs)
}

const buildSingleDef = () => {
  const schema = { title: basics.displayName || basics.name }
  if (basics.description) schema.description = basics.description
  if (isManual.value) {
    Object.assign(schema, manualValueSchema())
    if (valueDomain.value) applyValueDomain(schema, valueDomain.value)
  } else if (selectedCde.value) {
    Object.assign(schema, dataTypeSchema(selectedCde.value.cde_data_type))
    schema['x-pennsieve-cde'] = { persistent_id: selectedCde.value.persistent_id, strength: strength.value }
    applyCdeValues(schema, selectedCde.value, strength.value)
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
  memberRows.value.map((m) => {
    const schema = { title: m.cde.cde_name }
    if (m.cde.cde_definition) schema.description = m.cde.cde_definition
    Object.assign(schema, dataTypeSchema(m.cde.cde_data_type))
    schema['x-pennsieve-cde'] = { persistent_id: m.cde.persistent_id, strength: strength.value }
    applyCdeValues(schema, m.cde, strength.value)
    if (m.isKey) schema['x-pennsieve-key'] = true
    if (m.isSensitive) schema['x-pennsieve-sensitive'] = true
    return { propertyName: m.name, propertySchema: schema, required: m.required || m.isKey, oldPropertyName: null }
  })

const collides = (name, index) => {
  if (props.existingProperties.includes(name)) return true
  return memberRows.value.some((m, i) => i !== index && m.name === name)
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
// Mirror the server's CDE materialization so the built schema (and the Advanced
// JSON preview) shows the controlled values. required → enum + values; preferred
// → advisory values only; example → nothing. The server re-materializes these
// authoritatively on save, so this is a faithful preview (and a fallback when
// the server resolver is off). Guardrail: skip very large value sets.
const MAX_ENUM = 512
function applyCdeValues(schema, cde, strength) {
  const pvs = (cde && cde.permissible_values) || []
  if (!pvs.length || pvs.length > MAX_ENUM) return
  const details = pvs.map((pv) => {
    const d = {}
    if (pv.code) d.code = pv.code
    if (pv.label) d.label = pv.label
    if (pv.definition) d.definition = pv.definition
    if (pv.code_system) d.code_system = pv.code_system
    if (pv.concept_curie) d.concept_curie = pv.concept_curie
    return d
  })
  if (strength === 'required') {
    schema.enum = pvs.map((pv) => pv.code || pv.label).filter(Boolean)
    schema['x-pennsieve-cde-values'] = details
  } else if (strength === 'preferred') {
    schema['x-pennsieve-cde-values'] = details
  }
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
function manualValueSchema() {
  const t = manual.type
  const en = parseCsv(manual.enumInput)
  const withConstraints = (obj) => {
    if (t === 'string') {
      if (manual.format && manual.format !== 'plain') obj.format = manual.format
      // Skip length/pattern when the value is drawn from a controlled set — they'd
      // be redundant and could reject valid codes (and may be stale from before the
      // value set was chosen).
      if (!hasControlledValues.value) {
        if (isNum(manual.minLength)) obj.minLength = parseInt(manual.minLength, 10)
        if (isNum(manual.maxLength)) obj.maxLength = parseInt(manual.maxLength, 10)
        if (manual.pattern) obj.pattern = manual.pattern
      }
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
@use '../../../../styles/theme' as theme;

.pf-inline {
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  padding: 16px;
  margin-top: 12px;
}
.pf-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.pf-title {
  font-weight: 600;
  color: theme.$gray_6;
}
.pf-section {
  margin-bottom: 20px;
}
.pf-field {
  margin-bottom: 16px;
  &:last-child {
    margin-bottom: 0;
  }
}
.pf-field-value {
  font-size: 14px;
  color: theme.$gray_6;
}
.pf-section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: theme.$purple_2;
  margin-bottom: 12px;
}
// Extra breathing room between section groups (no divider line).
.pf-divided {
  padding-top: 8px;
}
.pf-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
  padding-top: 16px;
  border-top: 1px solid theme.$gray_2;
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
.wiz-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
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
  font-size: 14px;
  color: theme.$gray_4;
  margin-top: 4px;
  line-height: 1.4;
}
.wiz-rec {
  font-size: 13px;
  color: theme.$purple_2;
  background: theme.$purple_tint;
  padding: 2px 10px;
  border-radius: 3px;
}
.wiz-status {
  color: theme.$gray_4;
  font-size: 14px;
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
  font-size: 13px;
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
  font-size: 13px;
  color: theme.$gray_4;
  white-space: nowrap;
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
.wiz-selected-meta {
  font-weight: 400;
  color: theme.$gray_4;
}
.wiz-label {
  font-size: 13px;
  color: theme.$gray_5;
  margin-bottom: 6px;
}
.wiz-hint {
  font-size: 13px;
  color: theme.$gray_5;
  line-height: 1.4;
  margin-top: 8px;
}
.wiz-values {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.wiz-chip {
  font-size: 13px;
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

/* Ontology term search results */
.onto-results {
  list-style: none;
  width: 100%;
  margin: 8px 0 0;
  padding: 0;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  max-height: 200px;
  overflow: auto;
  li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    &:hover {
      background: theme.$gray_1;
    }
  }
}
.onto-results-meta {
  flex-shrink: 0;
  font-size: 12px;
  color: theme.$gray_4;
}

/* Selected-subtree preview */
.onto-subtree {
  width: 100%;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  padding: 12px;
}
.onto-subtree-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  color: theme.$gray_6;
}
.onto-subtree-code {
  font-size: 11px;
  color: theme.$gray_4;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.onto-subtree-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}
.onto-subtree-count {
  margin-top: 8px;
  font-size: 12px;
  color: theme.$gray_5;
}
.onto-subtree-list {
  list-style: none;
  margin: 6px 0 0;
  padding: 6px 0 0;
  border-top: 1px solid theme.$gray_1;
  max-height: 180px;
  overflow: auto;
  li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 3px 0;
  }
}
.onto-subtree-item-label {
  color: theme.$gray_6;
  font-size: 13px;
}
.onto-subtree-more {
  margin-top: 6px;
  font-size: 12px;
  color: theme.$gray_4;
}
.wiz-manual-flags {
  display: flex;
  gap: 20px;
  margin-bottom: 18px;
}
.wiz-options {
  margin-top: 4px;
}
.wiz-option {
  margin-bottom: 16px;
  &:last-child {
    margin-bottom: 0;
  }
}
.wiz-option-desc {
  font-size: 13px;
  color: theme.$gray_5;
  line-height: 1.45;
  margin: 4px 0 0 24px;
}
.wiz-legend {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  li {
    font-size: 13px;
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
  font-size: 13px;
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
  font-size: 13px;
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
</style>
