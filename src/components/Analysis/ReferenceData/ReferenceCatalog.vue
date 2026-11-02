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

    <div class="reference-catalog">
      <div class="rc-head">
        <h2>Reference Data</h2>
        <p class="rc-sub">
          Genomes, indexes and templates that Pennsieve keeps for analysis apps. Each entry is
          fetched from its upstream source (GENCODE, TemplateFlow, ...) and checksummed, and every
          run records the exact version it used. Apps fill a reference input from here
          automatically; in run setup you can pick another entry or use your own files instead.
        </p>
      </div>

      <div v-if="!available" class="rc-status">Reference data isn't available on this site.</div>
      <template v-else>
        <div class="rc-controls">
          <el-input v-model="term" placeholder="Search reference data" clearable class="rc-search">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </div>

        <div v-if="error" class="rc-status rc-error">{{ error }}</div>

        <el-tabs v-else v-model="activeKind" class="rc-tabs">
          <el-tab-pane
            v-for="k in REFERENCE_KINDS"
            :key="k.kind"
            :name="k.kind"
            :label="`${k.label}${loading ? '' : ` (${(entries[k.kind] || []).length})`}`"
          >
            <div v-if="loading" class="rc-status">Loading…</div>
            <div v-else-if="!shown(k.kind).length" class="rc-status">
              {{ term ? 'No matching reference data.' : `No ${k.label.toLowerCase()} yet.` }}
            </div>
            <ul v-else class="rc-list">
              <li v-for="e in shown(k.kind)" :key="e.id" class="rc-row" @click="open(e)">
                <div class="rc-row-main">
                  <span class="rc-row-name">{{ referenceLabel(e) || e.name }}</span>
                  <span v-if="e.description" class="rc-row-def">{{ e.description }}</span>
                </div>
                <span class="rc-row-meta">{{ rowMeta(e) }}</span>
              </li>
            </ul>
          </el-tab-pane>
        </el-tabs>
      </template>

      <!-- Detail drawer -->
      <el-drawer v-model="detailVisible" :title="detail ? detail.label : ''" size="520px" direction="rtl">
        <div v-if="detail" class="rc-detail">
          <p v-if="detail.description" class="rc-def">{{ detail.description }}</p>

          <div v-if="detail.organism || detail.assembly || detail.annotation" class="rc-field">
            <div class="rc-field-label">Genome</div>
            <div v-if="detail.organism">{{ detail.organism }}</div>
            <div v-if="detail.assembly">{{ detail.assembly }}</div>
            <div v-if="detail.annotation">{{ detail.annotation }}</div>
          </div>

          <div v-if="detail.properties.length" class="rc-field">
            <div class="rc-field-label">Properties</div>
            <div class="rc-chips">
              <span v-for="p in detail.properties" :key="p.name" class="rc-chip">{{ p.name }}: {{ p.value }}</span>
            </div>
          </div>

          <div class="rc-field">
            <div class="rc-field-label">Kind</div>
            <div>
              {{ assetClassName(detailEntry.version?.spec?.assetClass) || detailEntry.kind }}
              <template v-if="detail.tool"> · for {{ detail.tool }}</template>
            </div>
          </div>

          <div class="rc-field">
            <div class="rc-field-label">Version</div>
            <div>
              {{ detail.version }}
              <template v-if="detail.sizeBytes"> · {{ formatSize(detail.sizeBytes) }}</template>
              <template v-if="detail.unpackedBytes && detail.unpackedBytes !== detail.sizeBytes">
                ({{ formatSize(detail.unpackedBytes) }} unpacked)
              </template>
            </div>
          </div>

          <div class="rc-field">
            <div class="rc-field-label">Used by</div>
            <div v-if="appsLoading" class="rc-muted">Loading apps…</div>
            <div v-else-if="!usedBy.length" class="rc-muted">No app in the App Store asks for this yet.</div>
            <ul v-else class="rc-uses">
              <li v-for="u in usedBy" :key="`${u.app.uuid}-${u.input}`">
                <router-link v-if="orgId && u.app.uuid" :to="appRoute(u.app)">{{ appTitle(u.app) }}</router-link>
                <span v-else>{{ appTitle(u.app) }}</span>
                <span class="rc-muted">
                  · input "{{ u.input }}"{{ u.pinned ? ', its default' : ', one of its choices' }}
                </span>
              </li>
            </ul>
          </div>

          <div v-if="detail.source.description || detail.source.files.length" class="rc-field">
            <div class="rc-field-label">Source</div>
            <div v-if="detail.source.description">{{ detail.source.description }}</div>
            <ul v-if="detail.source.files.length" class="rc-files">
              <li v-for="f in detail.source.files" :key="f.path">
                <a :href="f.url" target="_blank" rel="noopener noreferrer" class="rc-link">{{ f.path }}</a>
                <code v-if="f.sha256" class="rc-code" :title="`sha256 ${f.sha256}`">sha256 {{ f.sha256.slice(0, 12) }}…</code>
              </li>
            </ul>
          </div>

          <div v-if="detail.license" class="rc-field">
            <div class="rc-field-label">License</div>
            <div>{{ detail.license }}</div>
          </div>

          <div v-if="detail.citation" class="rc-field">
            <div class="rc-field-label">Cite</div>
            <div class="rc-citation">{{ detail.citation }}</div>
          </div>

          <div class="rc-field">
            <div class="rc-field-label rc-label-row">
              Use in an app
              <el-button text size="small" @click="copySnippet">Copy</el-button>
            </div>
            <p class="rc-muted rc-hint">
              Add this under <code>inputs</code> in your app.yml; the app then gets this reference
              unless a run picks another.
            </p>
            <pre class="rc-snippet">{{ snippet }}</pre>
          </div>

          <div class="rc-field">
            <div class="rc-field-label">ID</div>
            <code class="rc-code">{{ detail.id }}</code>
            <code v-if="detail.sha256" class="rc-code rc-block">archive sha256 {{ detail.sha256 }}</code>
          </div>
        </div>
      </el-drawer>
    </div>
  </bf-stage>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStore } from 'vuex'
import { Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import StageActions from '@/components/shared/StageActions/StageActions.vue'
import IconArrowLeft from '@/components/icons/IconArrowLeft.vue'
import { environmentsServiceUrl, findReferences } from '@/utils/environmentsService'
import { versionManifest } from '@/components/Analysis/WorkflowBuilder/appManifestInfo'
import { appTitle } from '@/components/Analysis/Applications/appCards'
import {
  REFERENCE_KINDS,
  assetClassName,
  referenceLabel,
  referenceDetails,
  appsUsing,
  referenceSnippet,
  formatSize,
} from '@/components/Analysis/RunMonitor/referenceSources'

const router = useRouter()
const route = useRoute()
const store = useStore()

// Reachable from MyWorkspace and org workspaces — back within the same context.
const orgId = computed(() => route.params.orgId || null)
const goBackToResources = () => {
  router.push(orgId.value ? { name: 'workspace-resources', params: { orgId: orgId.value } } : { name: 'resources' })
}
const appRoute = (app) => ({ name: 'application-detail', params: { orgId: orgId.value, uuid: app.uuid } })

const available = !!environmentsServiceUrl()
const term = ref('')
const activeKind = ref(REFERENCE_KINDS[0].kind)
const entries = ref({}) // kind -> catalog entries
const loading = ref(true)
const error = ref('')

// The catalog is small and curated: load every kind, filter here.
const matches = (e, t) =>
  [referenceLabel(e), e.name, e.description].some((s) => (s || '').toLowerCase().includes(t))
const shown = (kind) => {
  const t = term.value.trim().toLowerCase()
  const list = [...(entries.value[kind] || [])].sort((a, b) => referenceLabel(a).localeCompare(referenceLabel(b)))
  return t ? list.filter((e) => matches(e, t)) : list
}
const rowMeta = (e) =>
  [assetClassName(e.version?.spec?.assetClass), formatSize(e.version?.archive?.sizeBytes)].filter(Boolean).join(' · ')

// The App Store apps, for "Used by": the workspace's, or outside one the
// public ones and your own.
const appsLoading = ref(true)
const applications = computed(() => store.getters['analysisModule/applications'] || [])

const detailVisible = ref(false)
const detailEntry = ref(null)
const detail = computed(() => (detailEntry.value ? referenceDetails(detailEntry.value) : null))
const usedBy = computed(() => (detailEntry.value ? appsUsing(detailEntry.value, applications.value, (a) => versionManifest(a)) : []))
const snippet = computed(() => (detailEntry.value ? referenceSnippet(detailEntry.value) : ''))

const open = (e) => {
  detailEntry.value = e
  detailVisible.value = true
}

const copySnippet = async () => {
  try {
    await navigator.clipboard.writeText(snippet.value)
    ElMessage.success('Copied')
  } catch {
    ElMessage.error("Couldn't copy; select the text instead")
  }
}

onMounted(async () => {
  if (!available) return
  store
    .dispatch('analysisModule/fetchApplications')
    .catch((e) => console.error('Reference data: apps failed to load:', e))
    .finally(() => {
      appsLoading.value = false
    })
  try {
    const lists = await Promise.all(REFERENCE_KINDS.map((k) => findReferences({ kind: k.kind })))
    entries.value = Object.fromEntries(REFERENCE_KINDS.map((k, i) => [k.kind, lists[i]]))
  } catch (e) {
    error.value = "Reference data couldn't be loaded. Try again later."
    console.error('Reference data failed to load:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
@use '../../../styles/theme' as theme;

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

.reference-catalog {
  min-height: 500px;
  padding-top: 0;
}
.rc-head h2 {
  font-size: 20px;
  line-height: 24px;
  margin: 0;
}
.rc-sub {
  color: theme.$gray_5;
  max-width: 680px;
  margin: 8px 0 20px;
  line-height: 1.5;
}
.rc-controls {
  margin-bottom: 12px;
}
.rc-search {
  max-width: 420px;
}
.rc-status {
  color: theme.$gray_4;
  font-size: 14px;
  padding: 8px 0;
}
.rc-error {
  color: theme.$status_red;
}
.rc-list {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
}
.rc-row {
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
.rc-row-main {
  min-width: 0;
}
.rc-row-name {
  color: theme.$gray_6;
  font-weight: 500;
}
.rc-row-def {
  display: block;
  font-size: 13px;
  color: theme.$gray_4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 620px;
}
.rc-row-meta {
  font-size: 12px;
  color: theme.$gray_4;
  white-space: nowrap;
}
.rc-detail {
  padding: 0 4px;
}
.rc-def {
  color: theme.$gray_6;
  line-height: 1.5;
  margin: 0 0 16px;
}
.rc-field {
  margin-bottom: 16px;
}
.rc-field-label {
  font-size: 12px;
  font-weight: 500;
  color: theme.$gray_5;
  margin-bottom: 6px;
}
.rc-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.rc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.rc-chip {
  font-size: 12px;
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  padding: 2px 8px;
  color: theme.$gray_5;
}
.rc-muted {
  color: theme.$gray_4;
  font-size: 13px;
}
.rc-hint {
  margin: 0 0 6px;
  line-height: 1.4;
}
.rc-uses,
.rc-files {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  li {
    padding: 2px 0;
  }
}
.rc-files li {
  display: flex;
  gap: 8px;
  align-items: baseline;
  flex-wrap: wrap;
}
.rc-link,
.rc-uses a {
  color: theme.$purple_2;
  text-decoration: none;
  word-break: break-all;
  &:hover {
    text-decoration: underline;
  }
}
.rc-citation {
  font-size: 13px;
  line-height: 1.5;
  color: theme.$gray_5;
}
.rc-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: theme.$purple_2;
  word-break: break-all;
}
.rc-block {
  display: block;
  margin-top: 4px;
  color: theme.$gray_4;
}
.rc-snippet {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  padding: 10px 12px;
  margin: 0;
  overflow-x: auto;
  white-space: pre;
}
</style>
