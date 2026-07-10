<template>
  <div class="workspace-overview">
    <header class="overview-header" :style="headingStyle">
      <div class="header-info">
        <h1 class="org-name">{{ orgName }}</h1>
        <p v-if="orgDescription" class="org-description">{{ orgDescription }}</p>
        <p v-if="owners.length" class="org-owners">
          <span class="org-owners-label">Owner{{ owners.length > 1 ? 's' : '' }}:</span>
          {{ owners.join(', ') }}
        </p>
      </div>
    </header>

    <StaticDashboard
      v-if="orgId"
      :key="orgId"
      class="overview-dashboard"
      :options="dashboardOptions"
    />
  </div>
</template>

<script setup>
import { computed, markRaw, onMounted } from 'vue'
import { useStore } from 'vuex'
import { pathOr } from 'ramda'
import { PennsieveDashboard as StaticDashboard } from 'pennsieve-dashboard'
import 'pennsieve-dashboard/style.css'
import ChatWidget from '@/components/Chat/ChatWidget.vue'
import LinksWidget from './widgets/LinksWidget.vue'
import MetricsWidget from './widgets/MetricsWidget.vue'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'

const props = defineProps({
  orgId: { type: String, default: '' },
})

const store = useStore()

const activeOrganization = computed(() => store.getters.activeOrganization)
const datasets = computed(() => store.state.datasets || [])
const orgMembers = computed(() => store.state.orgMembers || [])
const teams = computed(() => store.state.teams || [])
const datasetTotalCount = computed(() => store.state.datasetModule?.datasetTotalCount || 0)

const orgName = computed(() => pathOr('Workspace', ['organization', 'name'], activeOrganization.value))
const orgDescription = computed(() => pathOr('', ['organization', 'description'], activeOrganization.value))

// Dataset count comes from the paginated endpoint's `totalCount`, not
// `datasets.length` (which is just the loaded page size).
const datasetCount = computed(() => datasetTotalCount.value || datasets.value.length)
const memberCount = computed(() => orgMembers.value.length)
const teamCount = computed(() => teams.value.length)

const owners = computed(() => {
  const list = orgMembers.value.filter((m) => m?.isOwner)
  return list.map((m) => {
    const first = m?.firstName ?? ''
    const last = m?.lastName ?? ''
    const full = `${first} ${last}`.trim()
    return full || m?.email || 'Unknown'
  })
})

// Workspace brand color (same source as the dataset overview heading).
// `activeOrganization.organization.colorTheme` is an object shaped like
// `{ secondary: primary }`; we pick the primary value and tint it.
const workspacePrimaryColor = computed(() => {
  const ct = activeOrganization.value?.organization?.colorTheme
  if (ct && typeof ct === 'object' && !Array.isArray(ct)) {
    const entries = Object.entries(ct)
    if (entries.length > 0) return entries[0][1]
  }
  return null
})

// Shade Blend Convert — mixes a color toward white (positive p) or black
// (negative p). Matches the pSBC helper used by `mixins/custom-theme`,
// so workspace and dataset overview headings tint identically. Returns
// `null` when input is invalid.
function pSBC(p, c0) {
  const i = parseInt, m = Math.round
  if (typeof p !== 'number' || p < -1 || p > 1 || typeof c0 !== 'string' || (c0[0] !== 'r' && c0[0] !== '#')) return null
  const parse = (d) => {
    const n = d.length
    if (n > 9) {
      const parts = d.split(',')
      if (parts.length < 3 || parts.length > 4) return null
      return {
        r: i(parts[0][3] === 'a' ? parts[0].slice(5) : parts[0].slice(4)),
        g: i(parts[1]),
        b: i(parts[2]),
        a: parts[3] ? parseFloat(parts[3]) : -1,
      }
    }
    if (n === 8 || n === 6 || n < 4) return null
    let h = d
    if (n < 6) h = '#' + d[1] + d[1] + d[2] + d[2] + d[3] + d[3] + (n > 4 ? d[4] + d[4] : '')
    const v = i(h.slice(1), 16)
    if (h.length === 9 || h.length === 5) return { r: v >> 24 & 255, g: v >> 16 & 255, b: v >> 8 & 255, a: m((v & 255) / 0.255) / 1000 }
    return { r: v >> 16, g: v >> 8 & 255, b: v & 255, a: -1 }
  }
  const f = parse(c0)
  if (!f) return null
  const P = p < 0 ? p * -1 : p
  const Pinv = 1 - P
  const target = p < 0 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }
  const r = m((Pinv * f.r ** 2 + P * target.r ** 2) ** 0.5)
  const g = m((Pinv * f.g ** 2 + P * target.g ** 2) ** 0.5)
  const b = m((Pinv * f.b ** 2 + P * target.b ** 2) ** 0.5)
  return '#' + (16777216 + r * 65536 + g * 256 + b).toString(16).slice(1)
}

const headingStyle = computed(() => {
  const primary = workspacePrimaryColor.value
  if (!primary) return {}
  const tint = pSBC(0.85, primary)
  return tint ? { background: tint } : {}
})

// When the user lands directly on /:orgId/overview (e.g., bookmark or
// via the "Overview" nav item), the Vuex store hasn't been populated
// by the datasets / people / teams pages yet, so metrics read as 0.
// Fetch each list if empty.
const ensureDatasetsLoaded = async () => {
  if (datasets.value.length > 0 && datasetTotalCount.value > 0) return
  try {
    const token = await useGetToken()
    if (!token) return
    const url = `${siteConfig.apiUrl}/datasets/paginated?api_key=${token}&limit=25&offset=0&orderBy=IntId&orderDirection=Desc&type=research&includeBannerUrl=false`
    const res = await fetch(url)
    if (!res.ok) return
    const data = await res.json()
    if (datasets.value.length === 0) {
      await store.dispatch('setDatasets', data?.datasets || [])
    }
    if (typeof data?.totalCount === 'number') {
      await store.dispatch('datasetModule/updateDatasetTotalCount', data.totalCount)
    }
  } catch (e) {
    console.error('WorkspaceOverview: failed to load datasets', e)
  }
}

const ensureMembersLoaded = async () => {
  if (orgMembers.value.length > 0) return
  try {
    const token = await useGetToken()
    if (!token) return
    const orgIntId = activeOrganization.value?.organization?.intId
    if (!orgIntId) return
    const url = `${siteConfig.apiUrl}/organizations/${orgIntId}/members?api_key=${token}`
    const res = await fetch(url)
    if (!res.ok) return
    const members = await res.json()
    await store.dispatch('updateOrgMembers', members || [])
  } catch (e) {
    console.error('WorkspaceOverview: failed to load members', e)
  }
}

const ensureTeamsLoaded = async () => {
  if (teams.value.length > 0) return
  try {
    const token = await useGetToken()
    if (!token) return
    const orgIntId = activeOrganization.value?.organization?.intId
    if (!orgIntId) return
    const url = `${siteConfig.apiUrl}/organizations/${orgIntId}/teams?api_key=${token}`
    const res = await fetch(url)
    if (!res.ok) return
    const list = await res.json()
    await store.dispatch('updateTeams', list || [])
  } catch (e) {
    console.error('WorkspaceOverview: failed to load teams', e)
  }
}

onMounted(() => {
  ensureDatasetsLoaded()
  ensureMembersLoaded()
  ensureTeamsLoaded()
})

const STARTER_PROMPTS = [
  'Summarize this workspace',
  'What datasets do I have?',
  "Who's in this workspace?",
  'Find datasets about EEG recordings',
]

const jumpToLinks = computed(() => [
  { label: 'View all datasets', to: { name: 'datasets-list', params: { orgId: props.orgId } } },
  { label: 'Manage people', to: { name: 'people-list', params: { orgId: props.orgId } } },
  { label: 'Analysis', to: { name: 'analysis', params: { orgId: props.orgId } } },
])

const availableWidgets = [
  { name: 'MetricsWidget', component: markRaw(MetricsWidget) },
  { name: 'LinksWidget', component: markRaw(LinksWidget) },
  { name: 'ChatWidget', component: markRaw(ChatWidget) },
]

const METRICS = [
  // Read directly from Vuex so the metric reacts immediately to store
  // changes (the dashboard lib's globalData sync batches/collapses rapid
  // sequential updates and can show a stale value).
  { label: 'Datasets', storePath: 'datasetModule.datasetTotalCount' },
  { label: 'Members', storePath: 'orgMembers', length: true },
  { label: 'Teams', storePath: 'teams', length: true },
]

const defaultLayout = computed(() => [
  {
    id: 'metrics-glance',
    x: 0, y: 0, w: 3,
    sizeToContent: true,
    componentKey: 'MetricsWidget',
    componentName: 'At a glance',
    component: markRaw(MetricsWidget),
    Props: { metrics: METRICS, widgetName: 'At a glance' },
  },
  {
    id: 'links-jumpto',
    x: 0, y: 1, w: 3,
    sizeToContent: true,
    componentKey: 'LinksWidget',
    componentName: 'Jump to',
    component: markRaw(LinksWidget),
    Props: { links: jumpToLinks.value, widgetName: 'Jump to' },
  },
  {
    id: 'chat-workspace',
    x: 3, y: 0, w: 9,
    fillHeight: true,
    componentKey: 'ChatWidget',
    componentName: 'Ask Pennsieve',
    component: markRaw(ChatWidget),
    Props: {
      mode: 'workspace',
      orgId: props.orgId,
      // No contextLabel — the page heading already shows the workspace
      // name, so the chat sub-bar shows only the compute node and the
      // "New chat" affordance.
      contextLabel: '',
      starterPrompts: STARTER_PROMPTS,
      emptyTitle: 'Ask about your workspace — or mention a specific dataset to dig deeper.',
      widgetName: 'Ask Pennsieve',
    },
  },
])

const dashboardOptions = computed(() => ({
  hideEditGrid: true,
  hideHeader: true,
  globalData: {
    datasetCount: datasets.value.length.toString(),
    memberCount: orgMembers.value.length.toString(),
    teamCount: teams.value.length.toString(),
  },
  availableWidgets,
  defaultLayout: defaultLayout.value,
}))
</script>

<style scoped lang="scss">
@use '../../styles/theme';

.workspace-overview {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: #fefefe;
  overflow: auto;

  // Brand-tinted accent for the dashboard (edit-mode toolbar icon,
  // chip hovers, etc.).
  --dash-text-dark: #1c1c1c;
  --dash-text-medium: #555555;
  --dash-secondary: #{theme.$purple_3};
}

.overview-header {
  padding: 32px;
  background: theme.$purple_tint;
}

.header-info { min-width: 0; }

.org-name {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: theme.$gray_6;
}

.org-description {
  margin: 8px 0 0;
  font-size: 14px;
  color: #555;
  max-width: 720px;
}

.org-owners {
  margin: 12px 0 0;
  font-size: 13px;
  color: #555;
}

.org-owners-label {
  font-weight: 600;
  margin-right: 4px;
  color: theme.$gray_6;
}

.overview-dashboard {
  flex: 1;
  min-height: 0;
  padding: 24px;
}
</style>
