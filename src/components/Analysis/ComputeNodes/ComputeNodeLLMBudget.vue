<template>
  <div class="llm-budget-admin" v-loading="isLoading">
    <p class="cn-blurb">
      What AI models may cost on this node, for chat and apps. Changes apply
      within a minute.
    </p>
    <!-- No budget here isn't unlimited: AI calls are refused until one is set. -->
    <p v-if="!nodeConfig && !isLoading" class="budget-warning">
      No budget set, so AI calls on this node are refused.
    </p>

    <ul class="cn-list">
      <li class="budget-row">
        <span class="budget-who">Whole node</span>
        <span class="budget-limits" :class="{ unset: !nodeConfig }">
          {{ nodeConfig ? `${formatUsd(nodeConfig.budgetUsd)} ${periodPhrase(nodeConfig.budgetPeriod)}` : 'Not set' }}
        </span>
        <span v-if="isOwner" class="budget-actions">
          <button type="button" class="cn-action" @click="openEditNode">{{ nodeConfig ? 'Edit' : 'Set' }}</button>
        </span>
      </li>
      <!-- Per user: chat only; apps count against the node's budget alone. -->
      <li v-if="perUser" class="budget-row" :title="defaultRow?.notes || 'Limits chat only; apps count against the whole node.'">
        <span class="budget-who">Each user's chat</span>
        <span class="budget-limits" :class="{ unset: !limitSummary(defaultRow) }">{{ limitSummary(defaultRow) || 'Platform default' }}</span>
        <span v-if="isOwner" class="budget-actions">
          <button type="button" class="cn-action" @click="openEditDefault">{{ defaultRow ? 'Edit' : 'Set' }}</button>
        </span>
      </li>
      <!-- #quotas is what the chat panel's "Manage quotas" link opens. -->
      <template v-if="perUser">
        <li v-for="(row, i) in userRows" :id="i === 0 ? 'quotas' : undefined" :key="row.userId" class="budget-row" :title="row.notes || undefined">
          <span class="budget-who">{{ getUserName(row.userId) }}</span>
          <span class="budget-limits" :class="{ unset: !limitSummary(row) }">{{ limitSummary(row) || 'Platform default' }}</span>
          <span v-if="isOwner" class="budget-actions">
            <button type="button" class="cn-action" @click="openEditUser(row)">Edit</button>
            <button type="button" class="cn-icon-button" title="Remove" @click="confirmDelete(row)">&times;</button>
          </span>
        </li>
        <li v-if="isOwner" :id="userRows.length ? undefined : 'quotas'" class="budget-add">
          <button type="button" class="cn-link-button" @click="openAddUser">+ A limit for one user</button>
        </li>
      </template>
    </ul>

    <p v-if="loadError" class="error-line">Couldn't load the AI budget: {{ loadError.message }}</p>

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
import QuotaEditModal from './QuotaEditModal.vue'
import { useChatQuotaAdminStore, DEFAULT_USER_SENTINEL } from '@/stores/chatQuotaAdminStore'
import { useNodeLlmBudgetStore } from '@/stores/nodeLlmBudgetStore'
import { limitSummary } from './computeNodeHelpers'

const props = defineProps({
  nodeId: { type: String, required: true },
  isOwner: { type: Boolean, default: false },
  // A node with others on it (not a personal node): the per-user default and
  // overrides only make sense there.
  perUser: { type: Boolean, default: true },
})


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


function formatUsd(v) {
  if (v === null || v === undefined) return '—'
  return `$${Number(v).toFixed(2)}`
}

// "a day", "a month": after the amount.
const periodPhrase = (p) => (p === 'monthly' ? 'a month' : 'a day')

function load() {
  if (!props.nodeId) return
  adminStore.fetchAll(props.nodeId)
  nodeBudgetStore.fetch(props.nodeId)
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
