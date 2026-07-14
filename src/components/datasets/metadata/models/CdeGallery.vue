<template>
  <bf-stage>
    <div class="cde-gallery">
      <div class="cg-head">
        <h2>CDE Gallery</h2>
        <p class="cg-sub">
          Browse the common data element catalog — standardized, reusable fields you can attach to
          model properties to keep data comparable across datasets.
        </p>
      </div>

      <div class="cg-controls">
        <el-input v-model="term" placeholder="Search the catalog" clearable class="cg-search" @input="onSearch">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <div v-if="activeTab === 'cdes' && (facetValues.diseases.length || facetValues.domains.length)" class="cg-facets">
          <div v-if="facetValues.diseases.length" class="cg-facet">
            <span class="cg-facet-label">Disease</span>
            <el-radio-group v-model="disease" size="small" @change="runSearch">
              <el-radio-button value="">All</el-radio-button>
              <el-radio-button v-for="d in facetValues.diseases" :key="d" :value="d">{{ d }}</el-radio-button>
            </el-radio-group>
          </div>
          <el-select
            v-if="facetValues.domains.length"
            v-model="domain"
            size="small"
            clearable
            placeholder="All domains"
            class="cg-facet-select"
            @change="runSearch"
          >
            <el-option v-for="d in facetValues.domains" :key="d" :label="d" :value="d" />
          </el-select>
          <el-select
            v-if="facetValues.tiers.length"
            v-model="tier"
            size="small"
            clearable
            placeholder="Any tier"
            class="cg-facet-select cg-facet-tier"
            @change="runSearch"
          >
            <el-option v-for="t in facetValues.tiers" :key="t" :label="t" :value="t" />
          </el-select>
        </div>
      </div>

      <div v-if="store.error" class="cg-status cg-error">{{ store.error }}</div>

      <el-tabs v-else v-model="activeTab" class="cg-tabs">
        <!-- Common data elements -->
        <el-tab-pane name="cdes" :label="`Common data elements${cdeTotal ? ` (${cdeTotal})` : ''}`">
          <div v-if="loading" class="cg-status">Loading…</div>
          <template v-else>
            <div v-if="!cdes.length" class="cg-status">No matching common data elements.</div>
            <ul v-else class="cg-list">
              <li v-for="c in cdes" :key="c.persistent_id || c.canonical_key" class="cg-row" @click="openCde(c)">
                <div class="cg-row-main">
                  <span class="cg-row-name">{{ cdeLabel(c) }}</span>
                  <span v-if="c.cde_definition && c.cde_definition !== cdeLabel(c)" class="cg-row-def">{{ c.cde_definition }}</span>
                </div>
                <span class="cg-row-meta">
                  {{ c.cde_data_type }}
                  <template v-if="c.permissible_values && c.permissible_values.length">
                    · {{ c.permissible_values.length }} values
                  </template>
                </span>
              </li>
            </ul>
            <el-pagination
              v-if="cdeTotal > PAGE_SIZE"
              class="cg-pager"
              layout="prev, pager, next"
              :total="cdeTotal"
              :page-size="PAGE_SIZE"
              :current-page="cdePage"
              @current-change="onCdePage"
            />
          </template>
        </el-tab-pane>

        <!-- Bundles -->
        <el-tab-pane name="bundles" :label="`Bundles${allBundles.length ? ` (${allBundles.length})` : ''}`">
          <div v-if="loading" class="cg-status">Loading…</div>
          <template v-else>
            <div v-if="!allBundles.length" class="cg-status">No matching bundles.</div>
            <div v-else class="cg-grid">
              <button v-for="b in pagedBundles" :key="b.bundle_name" class="cg-bundle" @click="openBundle(b)">
                <div class="cg-bundle-name">{{ b.bundle_name }}</div>
                <div class="cg-bundle-meta">
                  {{ b.member_count }} element{{ b.member_count === 1 ? '' : 's' }}
                  <template v-if="b.domain"> · {{ b.domain }}</template>
                </div>
              </button>
            </div>
            <el-pagination
              v-if="allBundles.length > BUNDLE_PAGE_SIZE"
              class="cg-pager"
              layout="prev, pager, next"
              :total="allBundles.length"
              :page-size="BUNDLE_PAGE_SIZE"
              :current-page="bundlePage"
              @current-change="onBundlePage"
            />
          </template>
        </el-tab-pane>
      </el-tabs>

      <!-- Detail drawer -->
      <el-drawer v-model="detailVisible" :title="detailTitle" size="480px" direction="rtl">
        <div v-if="detail.kind === 'cde' && detail.cde" class="cg-detail">
          <p v-if="detail.cde.cde_definition && detail.cde.cde_definition !== detailTitle" class="cg-def">{{ detail.cde.cde_definition }}</p>

          <div v-if="detail.cde.cde_name && detail.cde.cde_name !== detailTitle" class="cg-field">
            <div class="cg-field-label">Name</div>
            <div>{{ detail.cde.cde_name }}</div>
          </div>

          <div class="cg-field">
            <div class="cg-field-label">Data type</div>
            <div>{{ detail.cde.cde_data_type }}</div>
          </div>

          <div v-if="cdeValues(detail.cde).length" class="cg-field">
            <div class="cg-field-label">Allowed values ({{ cdeValues(detail.cde).length }})</div>
            <div class="cg-chips">
              <span v-for="(v, i) in cdeValues(detail.cde)" :key="i" class="cg-chip">{{ v }}</span>
            </div>
          </div>
          <div v-else-if="detail.cde.cde_data_type === 'Value List'" class="cg-field">
            <div class="cg-field-label">Allowed values</div>
            <div style="opacity: 0.6">Not published for this element (values may be license-restricted at the source).</div>
          </div>

          <div class="cg-field">
            <div class="cg-field-label">Origin</div>
            <div>
              {{ detail.cde.cde_source || detail.cde.steward_org || '—' }}
              <template v-if="detail.cde.registration_status"> · {{ detail.cde.registration_status }}</template>
            </div>
          </div>

          <div v-if="detail.cde.copyright_status" class="cg-field">
            <div class="cg-field-label">Copyright</div>
            <div>{{ detail.cde.copyright_status }}</div>
          </div>

          <div v-if="detail.bundles.length" class="cg-field">
            <div class="cg-field-label">Part of bundle{{ detail.bundles.length === 1 ? '' : 's' }}</div>
            <div class="cg-chips">
              <button
                v-for="(bn, i) in detail.bundles"
                :key="i"
                class="cg-chip cg-chip-link"
                @click="showBundle(bn)"
              >{{ bn }}</button>
            </div>
          </div>

          <div v-if="xrefs(detail.cde).length" class="cg-field">
            <div class="cg-field-label">Cross-references</div>
            <div class="cg-chips">
              <span v-for="(x, i) in xrefs(detail.cde)" :key="i" class="cg-chip cg-chip-ref">
                {{ x.system }}<template v-if="x.id">: {{ x.id }}</template>
              </span>
            </div>
          </div>

          <div v-if="detail.cde.persistent_id" class="cg-field">
            <div class="cg-field-label">Persistent ID</div>
            <code class="cg-code">{{ detail.cde.persistent_id }}</code>
          </div>
        </div>

        <div v-else-if="detail.kind === 'bundle'" class="cg-detail">
          <div v-if="detail.loading" class="cg-status">Loading members…</div>
          <ul v-else class="cg-member-list">
            <li v-for="(m, i) in detail.members" :key="i" class="cg-member">
              <span class="cg-member-name">{{ cdeLabel(m) }}</span>
              <span class="cg-member-meta">{{ m.cde_data_type }}</span>
            </li>
          </ul>
        </div>
      </el-drawer>
    </div>
  </bf-stage>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import debounce from 'lodash.debounce'
import { useCdeCatalogStore } from '@/stores/cdeCatalogStore'

const store = useCdeCatalogStore()

const term = ref('')
const disease = ref('')
const domain = ref('')
const tier = ref('')
const facetValues = ref({ diseases: [], domains: [], tiers: [] })

const activeTab = ref('cdes')

// CDEs — paginated in SQL.
const PAGE_SIZE = 25
const cdes = ref([])
const cdeTotal = ref(0)
const cdePage = ref(1)

// Bundles — small, curation-bounded set: fetch all (term-filtered), page client-side.
const BUNDLE_PAGE_SIZE = 24
const allBundles = ref([])
const bundlePage = ref(1)
const pagedBundles = computed(() =>
  allBundles.value.slice((bundlePage.value - 1) * BUNDLE_PAGE_SIZE, bundlePage.value * BUNDLE_PAGE_SIZE)
)

const loading = ref(true)

const membership = ref(new Map()) // persistent_id -> [bundle_name, ...]
const detailVisible = ref(false)
const detail = reactive({ kind: '', cde: null, bundles: [], members: [], loading: false, bundleName: '' })

// Display label: the readable question text when present, else the (sometimes
// cryptic) canonical name. NLM's cde_name can be a short code (e.g. PhenX
// "# Ds miss school nRate PhenX"); preferred_question_text is the human phrasing.
const cdeLabel = (c) => (c && (c.preferred_question_text || c.cde_name)) || 'Element'

const detailTitle = computed(() =>
  detail.kind === 'cde' ? cdeLabel(detail.cde) : detail.bundleName || 'Bundle'
)

const cdeValues = (c) =>
  ((c && c.permissible_values) || []).map((pv) => pv.label || pv.code || '').filter(Boolean)
const xrefs = (c) => (Array.isArray(c && c.xrefs) ? c.xrefs : [])

const loadCdes = async () => {
  const res = await store.searchCdesPaged(term.value, {
    disease: disease.value,
    domain: domain.value,
    tier: tier.value,
    page: cdePage.value - 1,
    pageSize: PAGE_SIZE,
  })
  cdes.value = res.cdes
  cdeTotal.value = res.total
}
const loadBundles = async () => {
  const t = term.value.trim().toLowerCase()
  const all = await store.listBundles()
  allBundles.value = t ? all.filter((b) => b.bundle_name.toLowerCase().includes(t)) : all
  bundlePage.value = 1
}
const runSearch = async () => {
  cdePage.value = 1
  loading.value = true
  try {
    await Promise.all([loadCdes(), loadBundles()])
  } catch (e) {
    cdes.value = []
    cdeTotal.value = 0
    allBundles.value = []
    console.error('CDE gallery search failed:', e)
  } finally {
    loading.value = false
  }
}
const onSearch = debounce(runSearch, 300)
const onCdePage = async (p) => {
  cdePage.value = p
  try {
    await loadCdes()
  } catch (e) {
    console.error('CDE gallery page load failed:', e)
  }
}
const onBundlePage = (p) => {
  bundlePage.value = p
}

const openCde = (c) => {
  detail.kind = 'cde'
  detail.cde = c
  detail.bundles = membership.value.get(c.persistent_id) || []
  detailVisible.value = true
}
const showBundle = async (name) => {
  detail.kind = 'bundle'
  detail.bundleName = name
  detail.members = []
  detail.loading = true
  detailVisible.value = true
  try {
    detail.members = await store.getBundleMembers(name)
  } catch (e) {
    detail.members = []
  } finally {
    detail.loading = false
  }
}
const openBundle = (b) => showBundle(b.bundle_name)

onMounted(async () => {
  try {
    facetValues.value = await store.getFacetValues()
  } catch {
    facetValues.value = { diseases: [], domains: [], tiers: [] }
  }
  try {
    membership.value = await store.getBundleMembership()
  } catch {
    /* bundle cross-links are optional */
  }
  await runSearch()
})
</script>

<style scoped lang="scss">
@use '../../../../styles/theme' as theme;

.cde-gallery {
  min-height: 500px;
}
.cg-head h2 {
  font-size: 20px;
  line-height: 24px;
  margin: 0;
}
.cg-sub {
  color: theme.$gray_5;
  max-width: 680px;
  margin: 8px 0 20px;
  line-height: 1.5;
}
.cg-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}
.cg-search {
  max-width: 420px;
}
.cg-facets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 20px;
}
.cg-facet {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cg-facet-label {
  font-size: 13px;
  color: theme.$gray_5;
}
.cg-facet-select {
  width: 220px;
}
.cg-facet-tier {
  width: 160px;
}
.cg-status {
  color: theme.$gray_4;
  font-size: 14px;
  padding: 8px 0;
}
.cg-error {
  color: theme.$status_red;
}
.cg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.cg-bundle {
  text-align: left;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  padding: 12px 14px;
  cursor: pointer;
  background: theme.$white;
  &:hover {
    border-color: theme.$purple_2;
  }
}
.cg-bundle-name {
  font-weight: 500;
  color: theme.$gray_6;
}
.cg-bundle-meta {
  font-size: 12px;
  color: theme.$gray_4;
  margin-top: 4px;
}
.cg-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
}
.cg-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid theme.$gray_1;
  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: theme.$gray_1;
  }
}
.cg-row-main {
  min-width: 0;
}
.cg-row-name {
  color: theme.$gray_6;
  font-weight: 500;
}
.cg-row-def {
  display: block;
  font-size: 13px;
  color: theme.$gray_4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 620px;
}
.cg-row-meta {
  font-size: 12px;
  color: theme.$gray_4;
  white-space: nowrap;
}
.cg-pager {
  margin-top: 16px;
  justify-content: center;
}
.cg-detail {
  padding: 0 4px;
}
.cg-def {
  color: theme.$gray_6;
  line-height: 1.5;
  margin: 0 0 16px;
}
.cg-field {
  margin-bottom: 16px;
}
.cg-field-label {
  font-size: 12px;
  font-weight: 500;
  color: theme.$gray_5;
  margin-bottom: 6px;
}
.cg-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.cg-chip {
  font-size: 12px;
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  padding: 2px 8px;
  color: theme.$gray_5;
}
.cg-chip-ref {
  color: theme.$gray_4;
}
.cg-chip-link {
  cursor: pointer;
  color: theme.$purple_2;
  border-color: theme.$purple_0_7;
  &:hover {
    background: theme.$purple_tint;
  }
}
.cg-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: theme.$purple_2;
}
.cg-member-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.cg-member {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid theme.$gray_1;
}
.cg-member-name {
  color: theme.$gray_6;
}
.cg-member-meta {
  font-size: 12px;
  color: theme.$gray_4;
}
</style>
