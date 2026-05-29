<template>
  <div class="quotas-content" v-loading="isLoading">
    <!-- Default-for-all-users card. Always rendered so the owner sees the
         current platform-wide cap that applies when no per-user override
         exists. -->
    <div class="default-card">
      <div class="default-card-head">
        <div>
          <h3 class="default-title">Default for all users</h3>
          <p class="default-subtitle">
            Applies to any user without their own override below. Unset
            fields fall back to the platform safety cap.
          </p>
        </div>
        <button v-if="isOwner" class="processor-edit-button" @click="openEditDefault">
          {{ defaultRow ? 'Edit' : 'Set' }}
        </button>
      </div>
      <div class="caps-grid">
        <div class="cap-cell">
          <span class="cap-label">Daily</span>
          <span class="cap-value">{{ formatUsd(defaultRow?.dailyCostUsd) }}</span>
        </div>
        <div class="cap-cell">
          <span class="cap-label">Monthly</span>
          <span class="cap-value">{{ formatUsd(defaultRow?.monthlyCostUsd) }}</span>
        </div>
        <div class="cap-cell">
          <span class="cap-label">Per workflow</span>
          <span class="cap-value">{{ formatUsd(defaultRow?.perWorkflowUsd) }}</span>
        </div>
      </div>
      <p v-if="defaultRow?.notes" class="notes-line">{{ defaultRow.notes }}</p>
    </div>

    <!-- Per-user overrides. Empty state when none, otherwise a compact
         table. We deliberately skip per-row spend in v1 (one batch endpoint
         would be needed to avoid N+1 fetches). -->
    <div class="overrides-block">
      <div class="overrides-head">
        <h3 class="overrides-title">User overrides</h3>
        <bf-button v-if="isOwner" class="small primary" @click="openAddUser">
          Add User
        </bf-button>
      </div>

      <div v-if="userRows.length === 0" class="overrides-empty">
        No user-specific overrides — all users follow the default above.
      </div>

      <table v-else class="overrides-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Daily</th>
            <th>Monthly</th>
            <th>Per workflow</th>
            <th>Notes</th>
            <th v-if="isOwner" class="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in userRows" :key="row.userId">
            <td>{{ getUserName(row.userId) }}</td>
            <td>{{ formatUsd(row.dailyCostUsd) }}</td>
            <td>{{ formatUsd(row.monthlyCostUsd) }}</td>
            <td>{{ formatUsd(row.perWorkflowUsd) }}</td>
            <td class="notes-cell">{{ row.notes || '' }}</td>
            <td v-if="isOwner" class="actions-col">
              <button class="row-action" @click="openEditUser(row)">Edit</button>
              <button class="row-action danger" @click="confirmDelete(row)">Remove</button>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-if="loadError" class="error-line">Couldn't load quotas: {{ loadError.message }}</p>
    </div>

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
import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useChatQuotaAdminStore, DEFAULT_USER_SENTINEL } from '@/stores/chatQuotaAdminStore'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import QuotaEditModal from './QuotaEditModal.vue'

const props = defineProps({
  nodeId: { type: String, required: true },
  isOwner: { type: Boolean, default: false },
})

const vuexStore = useStore()
const adminStore = useChatQuotaAdminStore()

const orgMembers = computed(() => vuexStore.state?.orgMembers || [])
const profile = computed(() => vuexStore.state?.profile)

const defaultRow = computed(() => adminStore.getDefaultRow(props.nodeId))
const userRows = computed(() => adminStore.getUserRows(props.nodeId))
const isLoading = computed(() => adminStore.isLoading(props.nodeId))
const loadError = computed(() => adminStore.getError(props.nodeId))

// Eligible users for the picker — exclude anyone who already has an
// override. We don't gate on "has access to the node" client-side; the
// API enforces that the owner can set a quota on anyone (even users
// without current access, in case access is later granted).
const availableUsersForPicker = computed(() => {
  const taken = new Set(userRows.value.map((r) => r.userId))
  return orgMembers.value.filter((m) => !taken.has(m.id))
})

// Modal state.
const modalOpen = ref(false)
const modalMode = ref('add-user') // 'add-user' | 'edit-user' | 'edit-default'
const modalRow = ref(null)
const modalSubjectLabel = ref('')

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

function openEditDefault() {
  modalMode.value = 'edit-default'
  modalRow.value = defaultRow.value
  modalSubjectLabel.value = 'All users (default)'
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
  ElMessage.success('Quota saved')
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

onMounted(() => {
  adminStore.fetchAll(props.nodeId)
})
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.quotas-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.default-card {
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  padding: 16px;
  background: theme.$gray_1;
}

.default-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.default-title {
  margin: 0 0 4px 0;
  font-size: 15px;
  font-weight: 600;
  color: theme.$purple_3;
}

.default-subtitle {
  margin: 0;
  font-size: 13px;
  color: theme.$gray_5;
}

.caps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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
