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
        <el-input v-model="term" placeholder="Search common data elements" clearable class="cg-search" @input="onSearch">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <div v-if="facetValues.diseases.length || facetValues.domains.length" class="cg-facets">
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
      <div v-else-if="loading" class="cg-status">Loading catalog…</div>
      <template v-else>
        <section v-if="results.bundles.length" class="cg-section">
          <h3 class="cg-section-title">Bundles</h3>
          <div class="cg-grid">
            <button v-for="b in results.bundles" :key="b.bundle_name" class="cg-bundle" @click="openBundle(b)">
              <div class="cg-bundle-name">{{ b.bundle_name }}</div>
              <div class="cg-bundle-meta">
                {{ b.member_count }} element{{ b.member_count === 1 ? '' : 's' }}
                <template v-if="b.domain"> · {{ b.domain }}</template>
              </div>
            </button>
          </div>
        </section>

        <section class="cg-section">
          <h3 class="cg-section-title">Common data elements</h3>
          <div v-if="!results.cdes.length" class="cg-status">No matching common data elements.</div>
          <ul v-else class="cg-list">
            <li v-for="c in results.cdes" :key="c.persistent_id || c.canonical_key" class="cg-row" @click="openCde(c)">
              <div class="cg-row-main">
                <span class="cg-row-name">{{ c.cde_name }}</span>
                <span v-if="c.cde_definition" class="cg-row-def">{{ c.cde_definition }}</span>
              </div>
              <span class="cg-row-meta">
                {{ c.cde_data_type }}
                <template v-if="c.permissible_values && c.permissible_values.length">
                  · {{ c.permissible_values.length }} values
                </template>
              </span>
            </li>
          </ul>
        </section>
      </template>

      <!-- Detail drawer -->
      <el-drawer v-model="detailVisible" :title="detailTitle" size="480px" direction="rtl">
        <!-- CDE detail -->
        <div v-if="detail.kind === 'cde' && detail.cde" class="cg-detail">
          <p v-if="detail.cde.cde_definition" class="cg-def">{{ detail.cde.cde_definition }}</p>

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

          <div class="cg-field">
            <div class="cg-field-label">Origin</div>
            <div>
              {{ detail.cde.cde_source || detail.cde.steward_org || '—' }}
              <template v-if="detail.cde.registration_status"> · {{ detail.cde.registration_status }}</template>
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

        <!-- Bundle detail -->
        <div v-else-if="detail.kind === 'bundle'" class="cg-detail">
          <div v-if="detail.loading" class="cg-status">Loading members…</div>
          <ul v-else class="cg-member-list">
            <li v-for="(m, i) in detail.members" :key="i" class="cg-member">
              <span class="cg-member-name">{{ m.cde_name }}</span>
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
const results = ref({ bundles: [], cdes: [] })
const loading = ref(true)

const detailVisible = ref(false)
const detail = reactive({ kind: '', cde: null, members: [], loading: false })
const detailTitle = computed(() =>
  detail.kind === 'cde' ? (detail.cde && detail.cde.cde_name) || 'Element' : detail.bundleName || 'Bundle'
)

const cdeValues = (c) =>
  ((c && c.permissible_values) || []).map((pv) => pv.label || pv.code || '').filter(Boolean)
const xrefs = (c) => (Array.isArray(c && c.xrefs) ? c.xrefs : [])

const runSearch = async () => {
  loading.value = true
  try {
    results.value = await store.searchCatalog(term.value, {
      disease: disease.value,
      domain: domain.value,
      tier: tier.value,
      limit: 100,
    })
  } catch (e) {
    results.value = { bundles: [], cdes: [] }
    console.error('CDE gallery search failed:', e)
  } finally {
    loading.value = false
  }
}
const onSearch = debounce(runSearch, 300)

const openCde = (c) => {
  detail.kind = 'cde'
  detail.cde = c
  detailVisible.value = true
}
const openBundle = async (b) => {
  detail.kind = 'bundle'
  detail.bundleName = b.bundle_name
  detail.members = []
  detail.loading = true
  detailVisible.value = true
  try {
    detail.members = await store.getBundleMembers(b.bundle_name)
  } catch (e) {
    detail.members = []
  } finally {
    detail.loading = false
  }
}

onMounted(async () => {
  try {
    facetValues.value = await store.getFacetValues()
  } catch {
    facetValues.value = { diseases: [], domains: [], tiers: [] }
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
  margin-bottom: 24px;
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
.cg-section {
  margin-bottom: 28px;
}
.cg-section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: theme.$purple_2;
  margin: 0 0 12px;
}
.cg-status {
  color: theme.$gray_4;
  font-size: 14px;
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
