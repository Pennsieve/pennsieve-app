<template>
  <div class="pipeline-budget-admin" v-loading="isLoading">
    <p class="section-blurb">
      Caps what analysis pipelines may spend on this node. Enforced at run
      creation: a submission that would breach a cap is rejected before any
      compute starts.
      <span class="propagation-note">
        Unlike LLM quotas, pipeline axes are <strong>unlimited</strong> unless
        set here — pipeline compute runs in this node's own AWS account.
      </span>
    </p>

    <!-- Live consumption against the caller's own resolved limits. Rendered
         above the policy cards so an owner checking "is anything actually
         hitting these?" sees the answer first. Hides itself entirely on an
         unconfigured node. -->
    <PipelineBudgetMeter
      :budget="meterBudget"
      :spend-axes="meterSpendAxes"
      :concurrency-axes="meterConcurrencyAxes"
      :level="meterLevel"
      :per-run-usd="meterPerRunUsd"
      :loading="meterLoading"
      :error="meterError"
    />

    <!-- Node-wide pot: all users combined. Listed first because it outranks
         the per-user axes — if this is exhausted, raising one user's cap
         achieves nothing. -->
    <div class="policy-card">
      <div class="policy-card-head">
        <div>
          <h3 class="policy-title">Node-wide budget</h3>
          <p class="policy-subtitle">
            Total across all users of this node. No per-run ceiling here — a
            per-run cap is a property of a single run, so set it below.
          </p>
        </div>
        <button v-if="isOwner" class="processor-edit-button" @click="openEditNode">
          {{ nodeRow ? 'Edit' : 'Set' }}
        </button>
      </div>
      <div class="caps-grid">
        <div v-for="axis in nodeAxes" :key="axis.key" class="cap-cell">
          <span class="cap-label">{{ axis.label }}</span>
          <span class="cap-value" :class="{ unset: !isSet(nodeRow, axis.key) }">
            {{ formatAxis(nodeRow, axis) }}
          </span>
        </div>
      </div>
      <p v-if="nodeRow?.notes" class="notes-line">{{ nodeRow.notes }}</p>
      <div v-if="isOwner && nodeRow" class="card-actions">
        <button class="row-action danger" @click="confirmClear('node', 'the node-wide budget')">
          Remove
        </button>
      </div>
    </div>

    <!-- Per-user default. -->
    <div class="policy-card">
      <div class="policy-card-head">
        <div>
          <h3 class="policy-title">Default per user</h3>
          <p class="policy-subtitle">
            Applies to each user individually, unless they have an override
            below.
          </p>
        </div>
        <button v-if="isOwner" class="processor-edit-button" @click="openEditDefault">
          {{ defaultRow ? 'Edit' : 'Set' }}
        </button>
      </div>
      <div class="caps-grid">
        <div v-for="axis in userAxes" :key="axis.key" class="cap-cell">
          <span class="cap-label">{{ axis.label }}</span>
          <span class="cap-value" :class="{ unset: !isSet(defaultRow, axis.key) }">
            {{ formatAxis(defaultRow, axis) }}
          </span>
        </div>
      </div>
      <p v-if="defaultRow?.notes" class="notes-line">{{ defaultRow.notes }}</p>
      <div v-if="isOwner && defaultRow" class="card-actions">
        <button class="row-action danger" @click="confirmClear('default', 'the per-user default')">
          Remove
        </button>
      </div>
    </div>

    <!-- Per-user overrides. -->
    <div class="overrides-block">
      <div class="overrides-head">
        <h3 class="overrides-title">User overrides</h3>
        <bf-button v-if="isOwner" class="small primary" @click="openAddUser">Add User</bf-button>
      </div>

      <div v-if="userRows.length === 0" class="overrides-empty">
        No user-specific overrides — all users follow the default above.
      </div>

      <table v-else class="overrides-table">
        <thead>
          <tr>
            <th>User</th>
            <th v-for="axis in userAxes" :key="axis.key">{{ axis.label }}</th>
            <th>Notes</th>
            <th v-if="isOwner" class="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in userRows" :key="row.userId">
            <td>{{ getUserName(row.userId) }}</td>
            <td v-for="axis in userAxes" :key="axis.key" :class="{ unset: !isSet(row, axis.key) }">
              {{ formatAxis(row, axis) }}
            </td>
            <td class="notes-cell">{{ row.notes || '' }}</td>
            <td v-if="isOwner" class="actions-col">
              <button class="row-action" @click="openEditUser(row)">Edit</button>
              <button
                class="row-action danger"
                @click="confirmClear(row.userId, `the override for ${getUserName(row.userId)}`)"
              >
                Remove
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="loadError" class="error-line">Couldn't load pipeline budget: {{ loadError.message }}</p>

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
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import PipelineBudgetMeter from './PipelineBudgetMeter.vue'
import PipelineQuotaEditModal from './PipelineQuotaEditModal.vue'
import {
  useNodePipelineQuotaStore,
  axesForScope,
  SCOPE_NODE,
} from '@/stores/nodePipelineQuotaStore'
import { usePipelineBudgetStore } from '@/stores/pipelineBudgetStore'

const props = defineProps({
  nodeId: { type: String, required: true },
  isOwner: { type: Boolean, default: false },
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
const loadError = computed(() => store.getError(props.nodeId))

const nodeAxes = axesForScope(SCOPE_NODE)
const userAxes = axesForScope('')

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

const isSet = (row, key) => row?.[key] !== null && row?.[key] !== undefined

// An em-dash means "not set here" — the axis falls through. A literal 0 is a
// real cap, so it must never render as unset.
function formatAxis(row, axis) {
  const v = row?.[axis.key]
  if (v === null || v === undefined) return '—'
  if (axis.unit === 'usd') return `$${Number(v).toFixed(2)}`
  return String(v)
}

function load() {
  if (!props.nodeId) return
  store.fetchAll(props.nodeId)
  budgetStore.fetch(props.nodeId)
}

onMounted(load)
watch(() => props.nodeId, load)
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.pipeline-budget-admin {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-blurb {
  margin: 0;
  font-size: 13px;
  color: theme.$gray_5;
  line-height: 1.5;

  strong { color: theme.$gray_6; }
}

.propagation-note {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: theme.$gray_4;
}

.policy-card {
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  padding: 16px;
  background: theme.$gray_1;
}

.policy-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.policy-title {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 600;
  color: theme.$purple_3;
}

.policy-subtitle {
  margin: 0;
  font-size: 13px;
  color: theme.$gray_5;
}

.caps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.cap-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cap-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: theme.$gray_5;
}

.cap-value {
  font-size: 16px;
  font-weight: 600;
  color: theme.$purple_3;

  &.unset {
    color: theme.$gray_4;
    font-weight: 400;
  }
}

.notes-line {
  margin: 12px 0 0 0;
  font-size: 12px;
  color: theme.$gray_5;
  font-style: italic;
}

.card-actions {
  margin-top: 12px;
}

.overrides-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.overrides-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.overrides-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}

.overrides-empty {
  font-size: 13px;
  color: theme.$gray_5;
  padding: 12px;
  background: theme.$gray_1;
  border-radius: 6px;
  border: 1px dashed theme.$gray_2;
}

.overrides-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.overrides-table th,
.overrides-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid theme.$gray_2;
}

.overrides-table th {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: theme.$gray_5;
  font-weight: 500;
}

.overrides-table td.unset {
  color: theme.$gray_4;
}

.actions-col {
  width: 1%;
  white-space: nowrap;
}

.notes-cell {
  color: theme.$gray_5;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-action {
  background: transparent;
  border: none;
  color: theme.$purple_2;
  font-size: 13px;
  padding: 2px 6px;
  cursor: pointer;

  &:hover { color: theme.$purple_3; }
}

.row-action.danger {
  color: theme.$red_2;

  &:hover { color: theme.$red_1; }
}

.error-line {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: theme.$red_2;
}

.processor-edit-button {
  background: theme.$purple_1;
  color: theme.$white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover { background: theme.$purple_2; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}
</style>
