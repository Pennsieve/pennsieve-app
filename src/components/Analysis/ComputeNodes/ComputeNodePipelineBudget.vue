<template>
  <div class="pipeline-budget-admin" v-loading="isLoading">
    <p class="cn-blurb">
      What workflow runs may spend on this node. Runs over a limit don't start;
      with no limits set, there are none.
    </p>

    <!-- Spend so far against the limits; hides itself when there are none. -->
    <PipelineBudgetMeter
      :budget="meterBudget"
      :spend-axes="meterSpendAxes"
      :concurrency-axes="meterConcurrencyAxes"
      :level="meterLevel"
      :per-run-usd="meterPerRunUsd"
      :loading="meterLoading"
      :error="meterError"
    />

    <ul class="cn-list">
      <li class="budget-row" :title="nodeRow?.notes || undefined">
        <span class="budget-who">Whole node</span>
        <span class="budget-limits" :class="{ unset: !nodeLimits }">{{ nodeLimits || 'No limit' }}</span>
        <span v-if="isOwner" class="budget-actions">
          <button type="button" class="cn-action" @click="openEditNode">{{ nodeRow ? 'Edit' : 'Set' }}</button>
          <button v-if="nodeRow" type="button" class="cn-icon-button" title="Remove" @click="confirmClear('node', 'the node-wide budget')">&times;</button>
        </span>
      </li>
      <li v-if="perUser" class="budget-row" :title="defaultRow?.notes || undefined">
        <span class="budget-who">Each user</span>
        <span class="budget-limits" :class="{ unset: !defaultLimits }">{{ defaultLimits || 'No limit' }}</span>
        <span v-if="isOwner" class="budget-actions">
          <button type="button" class="cn-action" @click="openEditDefault">{{ defaultRow ? 'Edit' : 'Set' }}</button>
          <button v-if="defaultRow" type="button" class="cn-icon-button" title="Remove" @click="confirmClear('default', 'the per-user default')">&times;</button>
        </span>
      </li>
      <template v-if="perUser">
        <li v-for="row in userRows" :key="row.userId" class="budget-row" :title="row.notes || undefined">
          <span class="budget-who">{{ getUserName(row.userId) }}</span>
          <span class="budget-limits" :class="{ unset: !limitSummary(row) }">{{ limitSummary(row) || 'No limit' }}</span>
          <span v-if="isOwner" class="budget-actions">
            <button type="button" class="cn-action" @click="openEditUser(row)">Edit</button>
            <button type="button" class="cn-icon-button" title="Remove" @click="confirmClear(row.userId, `the limit for ${getUserName(row.userId)}`)">&times;</button>
          </span>
        </li>
        <li v-if="isOwner" class="budget-add">
          <button type="button" class="cn-link-button" @click="openAddUser">+ A limit for one user</button>
        </li>
      </template>
    </ul>

    <p v-if="loadError" class="error-line">Couldn't load the pipeline budget: {{ loadError.message }}</p>

    <PipelineQuotaEditModal
      v-model:visible="modalOpen"
      :node-id="nodeId"
      :mode="modalMode"
      :row="modalRow"
      :subject-label="modalSubjectLabel"
      :available-users="availableUsersForPicker"
      @saved="onSaved"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useStore } from 'vuex'
import { ElMessage, ElMessageBox } from 'element-plus'
import PipelineBudgetMeter from './PipelineBudgetMeter.vue'
import PipelineQuotaEditModal from './PipelineQuotaEditModal.vue'
import { useNodePipelineQuotaStore } from '@/stores/nodePipelineQuotaStore'
import { usePipelineBudgetStore } from '@/stores/pipelineBudgetStore'
import { limitSummary } from './computeNodeHelpers'

const props = defineProps({
  nodeId: { type: String, required: true },
  isOwner: { type: Boolean, default: false },
  // A node with others on it (not a personal node): the per-user default and
  // overrides only make sense there.
  perUser: { type: Boolean, default: true },
})

const vuexStore = useStore()
const store = useNodePipelineQuotaStore()
const budgetStore = usePipelineBudgetStore()

const orgMembers = computed(() => vuexStore.state?.orgMembers || [])
const profile = computed(() => vuexStore.state?.profile)

const nodeRow = computed(() => store.getNodeRow(props.nodeId))
const defaultRow = computed(() => store.getDefaultRow(props.nodeId))
const userRows = computed(() => store.getUserRows(props.nodeId))
const isLoading = computed(() => store.isLoading(props.nodeId))
const isConfigured = computed(() => store.isConfigured(props.nodeId))
const loadError = computed(() => store.getError(props.nodeId))

const nodeLimits = computed(() => limitSummary(nodeRow.value))
const defaultLimits = computed(() => limitSummary(defaultRow.value))

// Meter wiring — the same props ChatQuotaHeader-style presentational components
// expect. Reads workflow-service rather than account-service: account-service
// resolves the limits above but has no access to the usage table, so only
// workflow-service can report what has actually been spent against them.
const meterBudget = computed(() => budgetStore.getBudget(props.nodeId))
const meterSpendAxes = computed(() => budgetStore.spendAxes(props.nodeId))
const meterConcurrencyAxes = computed(() => budgetStore.concurrencyAxes(props.nodeId))
const meterLevel = computed(() => budgetStore.warningLevel(props.nodeId))
const meterPerRunUsd = computed(() => budgetStore.perRunUsd(props.nodeId))
const meterLoading = computed(() => budgetStore.isLoading(props.nodeId))
const meterError = computed(() => budgetStore.getError(props.nodeId))

const availableUsersForPicker = computed(() => {
  const taken = new Set(userRows.value.map((r) => r.userId))
  return orgMembers.value.filter((m) => !taken.has(m.id))
})

const modalOpen = ref(false)
const modalMode = ref('edit-node')
const modalRow = ref(null)
const modalSubjectLabel = ref('')

function openEditNode() {
  modalMode.value = 'edit-node'
  modalRow.value = nodeRow.value
  modalSubjectLabel.value = 'This compute node (all users combined)'
  modalOpen.value = true
}

function openEditDefault() {
  modalMode.value = 'edit-default'
  modalRow.value = defaultRow.value
  modalSubjectLabel.value = 'Every user without an override'
  modalOpen.value = true
}

function openAddUser() {
  modalMode.value = 'add-user'
  modalRow.value = null
  modalSubjectLabel.value = ''
  modalOpen.value = true
}

function openEditUser(row) {
  modalMode.value = 'edit-user'
  modalRow.value = row
  modalSubjectLabel.value = getUserName(row.userId)
  modalOpen.value = true
}

async function confirmClear(scope, label) {
  try {
    await ElMessageBox.confirm(
      `Remove ${label}? Every axis it sets falls back to the next tier, and to unlimited if no tier sets it.`,
      'Remove budget',
      { type: 'warning', confirmButtonText: 'Remove', cancelButtonText: 'Cancel' },
    )
  } catch {
    return
  }
  try {
    await store.deleteRow(props.nodeId, scope)
    ElMessage.success('Budget removed')
    budgetStore.fetch(props.nodeId)
  } catch (e) {
    ElMessage.error(`Failed to remove: ${e?.message || e}`)
  }
}

function onSaved() {
  ElMessage.success('Pipeline budget saved')
  // The meter reads resolved limits from workflow-service, so a policy change
  // here only shows up after a refetch.
  budgetStore.fetch(props.nodeId)
}

function getUserName(userId) {
  if (!userId) return 'Unknown'
  if (profile.value && (profile.value.id === userId || profile.value.intId === userId)) {
    return `${profile.value.firstName} ${profile.value.lastName}`.trim() || 'You'
  }
  const m = orgMembers.value.find((x) => x.id === userId || x.intId === userId)
  if (m) return `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email || userId
  return String(userId).includes(':') ? String(userId).split(':').pop() : String(userId)
}


// An em-dash means "not set here" — the axis falls through. A literal 0 is a
// real cap, so it must never render as unset.

function load() {
  if (!props.nodeId) return
  store.fetchAll(props.nodeId)
  budgetStore.fetch(props.nodeId)
}

onMounted(load)
watch(() => props.nodeId, load)
</script>

<style scoped lang="scss">
@use '../../../styles/theme';
@use './computeNodePage';

// One short line, then a list: a row per limit (the node's, each user's,
// a user's own), its limits in one line and its actions at the right.
.budget-row {
  .budget-who {
    font-weight: 500;
    color: theme.$gray_6;
  }
  .budget-limits {
    margin-left: auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: theme.$gray_6;

    &.unset {
      color: theme.$gray_4;
    }
  }
  .budget-actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 8px;
  }
}
.budget-add {
  justify-content: flex-start !important;
}
.budget-warning {
  margin: 0 0 12px;
  font-size: 13px;
  color: theme.$red_2;
}
.error-line {
  margin: 8px 0 0;
  font-size: 13px;
  color: theme.$red_2;
}
</style>
