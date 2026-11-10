<template>
  <div class="workspace-overview">
    <!-- The workspace's description and owners, as every page's intro row
         (the workspace's name is in the header's breadcrumb) -->
    <div class="overview-intro">
      <ContentIntro :text="orgDescription || 'This workspace\'s activity: its datasets, members, storage and analysis at a glance.'" />
      <p v-if="owners.length" class="org-owners">
        <span class="org-owners-label">Owner{{ owners.length > 1 ? 's' : '' }}:</span>
        {{ owners.join(', ') }}
      </p>
    </div>

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
import { StaticDashboard } from 'pennsieve-dashboard'
import 'pennsieve-dashboard/style.css'
import ChatWidget from '@/components/Chat/ChatWidget.vue'
import ContentIntro from '@/components/shared/ContentIntro/ContentIntro.vue'
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

/* As the other pages' content: 20px under the header, 32px in. */
.overview-intro {
  padding: 20px 32px 0;
}

.org-owners {
  margin: -8px 0 0;
  font-size: 13px;
  color: theme.$gray_5;
}

.org-owners-label {
  font-weight: 600;
  margin-right: 4px;
  color: theme.$gray_6;
}

/* 32px in, as the intro over it and the other pages' content. */
.overview-dashboard {
  flex: 1;
  min-height: 0;
  padding: 16px 32px 24px;
}
</style>
