<template>
  <div class="llm-budget-admin" v-loading="isLoading">
    <p class="section-blurb">
      Caps what this node may spend on LLM calls. Enforced at the governor: once
      a cap is reached, every further invocation is rejected until the period
      rolls over.
      <span class="propagation-note">
        Node budget changes take effect within ~60 seconds (the governor caches
        the value). Unset per-user fields fall back to the platform safety cap.
      </span>
    </p>

    <!-- Node-wide pot: all callers combined, chat and workflow applications
         alike. Listed first because it outranks the per-user axes — if this is
         exhausted, raising one user's cap achieves nothing. It is also the only
         layer that catches non-chat callers. -->
    <div class="policy-card">
      <div class="policy-card-head">
        <div>
          <h3 class="policy-title">Node-wide budget</h3>
          <p class="policy-subtitle">
            Total across all callers on this node — chat <em>and</em> workflow
            applications.
          </p>
        </div>
        <button v-if="isOwner" class="processor-edit-button" @click="openEditNode">
          {{ nodeConfig ? 'Edit' : 'Set' }}
        </button>
      </div>
      <div class="caps-grid">
        <div class="cap-cell">
          <span class="cap-label">Budget cap</span>
          <span class="cap-value" :class="{ unset: !nodeConfig }">
            {{ nodeConfig ? formatUsd(nodeConfig.budgetUsd) : '—' }}
          </span>
        </div>
        <div class="cap-cell">
          <span class="cap-label">Period</span>
          <span class="cap-value" :class="{ unset: !nodeConfig }">
            {{ nodeConfig ? periodLabel(nodeConfig.budgetPeriod) : '—' }}
          </span>
        </div>
      </div>
      <!-- Unlike the pipeline axes, no budget here is not "unlimited" — the
           governor rejects everything until a cap exists. Worth saying plainly. -->
      <p v-if="!nodeConfig && !isLoading" class="empty-warning">
        No budget configured. The governor will reject all LLM calls on this
        node until a cap is set.
      </p>
    </div>

    <!-- Per-user default. Chat only: workflow applications are governed solely
         by the node budget above. -->
    <div class="policy-card">
      <div class="policy-card-head">
        <div>
          <h3 class="policy-title">Default per user</h3>
          <p class="policy-subtitle">
            Applies to each user individually, unless they have an override
            below. Gates chat only — workflow applications are governed solely
            by the node budget.
          </p>
        </div>
        <button v-if="isOwner" class="processor-edit-button" @click="openEditDefault">
          {{ defaultRow ? 'Edit' : 'Set' }}
        </button>
      </div>
      <div class="caps-grid">
        <div v-for="axis in USER_AXES" :key="axis.key" class="cap-cell">
          <span class="cap-label">{{ axis.label }}</span>
          <span class="cap-value" :class="{ unset: !isSet(defaultRow, axis.key) }">
            {{ formatAxis(defaultRow, axis.key) }}
          </span>
        </div>
      </div>
      <p v-if="defaultRow?.notes" class="notes-line">{{ defaultRow.notes }}</p>
    </div>

    <!-- Per-user overrides. The `#quotas` anchor is what the chat panel's
         "Manage quotas" link targets, so it has to stay on this block. -->
    <div id="quotas" class="overrides-block">
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
            <th v-for="axis in USER_AXES" :key="axis.key">{{ axis.label }}</th>
            <th>Notes</th>
            <th v-if="isOwner" class="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in userRows" :key="row.userId">
            <td>{{ getUserName(row.userId) }}</td>
            <td v-for="axis in USER_AXES" :key="axis.key" :class="{ unset: !isSet(row, axis.key) }">
              {{ formatAxis(row, axis.key) }}
            </td>
            <td class="notes-cell">{{ row.notes || '' }}</td>
            <td v-if="isOwner" class="actions-col">
              <button class="row-action" @click="openEditUser(row)">Edit</button>
              <button class="row-action danger" @click="confirmDelete(row)">Remove</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="loadError" class="error-line">Couldn't load LLM budget: {{ loadError.message }}</p>

    <QuotaEditModal
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
// One section for everything that caps LLM spend on a node, laid out the same
// way as ComputeNodePipelineBudget: node-wide pot, per-user default, per-user
// overrides. The two families are deliberately separate sections — they have
// different defaults (an LLM node with no budget rejects everything; a pipeline
// node with no budget is unlimited) — but they read the same.
//
// Two backing stores sit behind this one panel, because the platform stores the
// two tiers differently:
//
//   nodeLlmBudgetStore    the node-wide cap, SSM-backed via account-service's
//                         llm-config endpoint. Enforced by the governor on
//                         every Bedrock invocation, so it catches non-chat
//                         callers too.
//   chatQuotaAdminStore   per-user rows in the chat quota table. Gates chat
//                         turns only.
import { computed, onMounted, ref, watch } from 'vue'
import { useStore } from 'vuex'
import { ElMessage, ElMessageBox } from 'element-plus'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import QuotaEditModal from './QuotaEditModal.vue'
import { useChatQuotaAdminStore, DEFAULT_USER_SENTINEL } from '@/stores/chatQuotaAdminStore'
import { useNodeLlmBudgetStore } from '@/stores/nodeLlmBudgetStore'

const props = defineProps({
  nodeId: { type: String, required: true },
  isOwner: { type: Boolean, default: false },
})

const USER_AXES = [
  { key: 'dailyCostUsd', label: 'Daily' },
  { key: 'monthlyCostUsd', label: 'Monthly' },
  { key: 'perWorkflowUsd', label: 'Per workflow' },
]

const vuexStore = useStore()
const adminStore = useChatQuotaAdminStore()
const nodeBudgetStore = useNodeLlmBudgetStore()

const orgMembers = computed(() => vuexStore.state?.orgMembers || [])
const profile = computed(() => vuexStore.state?.profile)

const nodeConfig = computed(() => nodeBudgetStore.getConfig(props.nodeId))
const defaultRow = computed(() => adminStore.getDefaultRow(props.nodeId))
const userRows = computed(() => adminStore.getUserRows(props.nodeId))

const isLoading = computed(
  () => adminStore.isLoading(props.nodeId) || nodeBudgetStore.isLoading(props.nodeId),
)
const loadError = computed(
  () => adminStore.getError(props.nodeId) || nodeBudgetStore.getError(props.nodeId),
)

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
  modalRow.value = nodeConfig.value
  modalSubjectLabel.value = 'This compute node (all callers combined)'
  modalOpen.value = true
}

function openEditDefault() {
  modalMode.value = 'edit-default'
  modalRow.value = defaultRow.value
  modalSubjectLabel.value = 'All users (default)'
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

async function confirmDelete(row) {
  try {
    await ElMessageBox.confirm(
      `Remove the quota override for ${getUserName(row.userId)}? They will fall back to the default.`,
      'Remove override',
      { type: 'warning', confirmButtonText: 'Remove', cancelButtonText: 'Cancel' },
    )
  } catch {
    return
  }
  try {
    await adminStore.deleteRow(props.nodeId, row.userId)
    ElMessage.success('Override removed')
  } catch (e) {
    ElMessage.error(`Failed to remove: ${e?.message || e}`)
  }
}

function onSaved() {
  ElMessage.success('LLM budget saved')
}

function getUserName(userId) {
  if (!userId) return 'Unknown'
  if (userId === DEFAULT_USER_SENTINEL) return 'All users (default)'
  if (profile.value && (profile.value.id === userId || profile.value.intId === userId)) {
    return `${profile.value.firstName} ${profile.value.lastName}`.trim() || 'You'
  }
  const m = orgMembers.value.find((x) => x.id === userId || x.intId === userId)
  if (m) return `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email || userId
  return String(userId).includes(':') ? String(userId).split(':').pop() : String(userId)
}

const isSet = (row, key) => row?.[key] !== null && row?.[key] !== undefined

function formatUsd(v) {
  if (v === null || v === undefined) return '—'
  return `$${Number(v).toFixed(2)}`
}

const formatAxis = (row, key) => formatUsd(row?.[key])

function periodLabel(p) {
  if (p === 'daily') return 'Daily'
  if (p === 'monthly') return 'Monthly'
  return p || '—'
}

function load() {
  if (!props.nodeId) return
  adminStore.fetchAll(props.nodeId)
  nodeBudgetStore.fetch(props.nodeId)
}

onMounted(load)
watch(() => props.nodeId, load)
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.llm-budget-admin {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-blurb {
  margin: 0;
  font-size: 13px;
  color: theme.$gray_5;
  line-height: 1.5;

  em { font-style: italic; }
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

  em { font-style: italic; }
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

.empty-warning {
  margin: 12px 0 0 0;
  font-size: 12px;
  color: theme.$orange_1;
  line-height: 1.5;
}

.notes-line {
  margin: 12px 0 0 0;
  font-size: 12px;
  color: theme.$gray_5;
  font-style: italic;
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
