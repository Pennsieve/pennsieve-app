<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    :title="title"
    width="520px"
    :close-on-click-modal="false"
    @close="onClose"
  >
    <div class="quota-edit-body">
      <p class="quota-edit-blurb">
        Leave any field blank to fall back to the next tier
        ({{ mode === 'edit-default' ? 'platform safety cap' : 'node default' }}).
      </p>

      <div v-if="mode === 'add-user'" class="form-row">
        <label class="form-label">User</label>
        <el-select
          v-model="form.userId"
          filterable
          placeholder="Pick a user with access to this node"
          style="width: 100%"
        >
          <el-option
            v-for="u in availableUsers"
            :key="u.id"
            :label="userLabel(u)"
            :value="u.id"
          />
        </el-select>
      </div>

      <div v-else class="form-row">
        <label class="form-label">User</label>
        <div class="form-static">{{ subjectLabel }}</div>
      </div>

      <div class="form-row">
        <label class="form-label">Daily cap (USD)</label>
        <el-input-number
          v-model="form.dailyCostUsd"
          :min="0"
          :precision="2"
          :step="1"
          placeholder="No limit"
          style="width: 100%"
          :controls="false"
        />
      </div>

      <div class="form-row">
        <label class="form-label">Monthly cap (USD)</label>
        <el-input-number
          v-model="form.monthlyCostUsd"
          :min="0"
          :precision="2"
          :step="10"
          placeholder="No limit"
          style="width: 100%"
          :controls="false"
        />
      </div>

      <div class="form-row">
        <label class="form-label">Per-workflow cap (USD)</label>
        <el-input-number
          v-model="form.perWorkflowUsd"
          :min="0"
          :precision="2"
          :step="0.5"
          placeholder="No limit"
          style="width: 100%"
          :controls="false"
        />
      </div>

      <div class="form-row">
        <label class="form-label">Notes</label>
        <el-input
          v-model="form.notes"
          type="textarea"
          :rows="2"
          placeholder="Optional — why this user has a custom cap"
        />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="onClose" :disabled="saving">Cancel</el-button>
        <el-button
          type="primary"
          :disabled="!canSave"
          :loading="saving"
          @click="onSave"
        >
          Save
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElButton, ElDialog, ElInput, ElInputNumber, ElOption, ElSelect, ElMessage } from 'element-plus'
import { useChatQuotaAdminStore, DEFAULT_USER_SENTINEL } from '@/stores/chatQuotaAdminStore'

const props = defineProps({
  visible: { type: Boolean, default: false },
  nodeId: { type: String, required: true },
  // 'add-user' | 'edit-user' | 'edit-default'
  mode: { type: String, required: true },
  // Existing row to edit (null when mode === 'add-user').
  row: { type: Object, default: null },
  // Display name resolver for the subject row, used in 'edit-user' header.
  subjectLabel: { type: String, default: '' },
  // Org members eligible to receive an override (used by 'add-user' picker).
  availableUsers: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:visible', 'saved'])
const adminStore = useChatQuotaAdminStore()

const saving = ref(false)

// el-input-number returns null when the field is cleared. We treat null as
// "no cap on this axis" — i.e., omit / clear the field on the API call.
const form = ref({
  userId: '',
  dailyCostUsd: null,
  monthlyCostUsd: null,
  perWorkflowUsd: null,
  notes: '',
})

const title = computed(() => {
  if (props.mode === 'add-user') return 'Add user override'
  if (props.mode === 'edit-default') return 'Edit default for all users'
  return 'Edit user override'
})

const canSave = computed(() => {
  if (props.mode === 'add-user' && !form.value.userId) return false
  return true
})

function userLabel(u) {
  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim()
  return name || u.email || u.id
}

// Reset form whenever the modal becomes visible or the row prop changes.
watch(
  () => [props.visible, props.row, props.mode],
  () => {
    if (!props.visible) return
    if (props.mode === 'edit-default') {
      form.value = {
        userId: DEFAULT_USER_SENTINEL,
        dailyCostUsd: props.row?.dailyCostUsd ?? null,
        monthlyCostUsd: props.row?.monthlyCostUsd ?? null,
        perWorkflowUsd: props.row?.perWorkflowUsd ?? null,
        notes: props.row?.notes ?? '',
      }
    } else if (props.mode === 'edit-user') {
      form.value = {
        userId: props.row?.userId || '',
        dailyCostUsd: props.row?.dailyCostUsd ?? null,
        monthlyCostUsd: props.row?.monthlyCostUsd ?? null,
        perWorkflowUsd: props.row?.perWorkflowUsd ?? null,
        notes: props.row?.notes ?? '',
      }
    } else {
      form.value = {
        userId: '',
        dailyCostUsd: null,
        monthlyCostUsd: null,
        perWorkflowUsd: null,
        notes: '',
      }
    }
  },
  { immediate: true },
)

function onClose() {
  if (saving.value) return
  emit('update:visible', false)
}

async function onSave() {
  if (!canSave.value) return
  saving.value = true
  try {
    const payload = {
      dailyCostUsd: form.value.dailyCostUsd,
      monthlyCostUsd: form.value.monthlyCostUsd,
      perWorkflowUsd: form.value.perWorkflowUsd,
      notes: form.value.notes || '',
    }
    await adminStore.putRow(props.nodeId, form.value.userId, payload)
    emit('saved')
    emit('update:visible', false)
  } catch (e) {
    ElMessage.error(`Failed to save quota: ${e?.message || e}`)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.quota-edit-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.quota-edit-blurb {
  margin: 0 0 4px 0;
  font-size: 13px;
  color: theme.$gray_5;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: theme.$gray_6;
}

.form-static {
  font-size: 14px;
  color: theme.$purple_3;
  padding: 6px 0;
}

.dialog-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
</style>
