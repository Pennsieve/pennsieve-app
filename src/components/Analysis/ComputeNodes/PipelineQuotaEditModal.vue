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
      <p class="quota-edit-blurb">{{ blurb }}</p>

      <div v-if="mode === 'add-user'" class="form-row">
        <label class="form-label">User</label>
        <el-select
          v-model="form.userId"
          filterable
          placeholder="Pick a user with access to this node"
          style="width: 100%"
        >
          <el-option v-for="u in availableUsers" :key="u.id" :label="userLabel(u)" :value="u.id" />
        </el-select>
      </div>

      <div v-else class="form-row">
        <label class="form-label">Applies to</label>
        <div class="form-static">{{ subjectLabel }}</div>
      </div>

      <div v-for="axis in axes" :key="axis.key" class="form-row">
        <label class="form-label">
          {{ axis.label }}{{ axis.unit === 'usd' ? ' cap (USD)' : '' }}
        </label>
        <el-input-number
          v-model="form[axis.key]"
          :min="0"
          :precision="axis.unit === 'usd' ? 2 : 0"
          :step="axis.step"
          placeholder="No limit"
          style="width: 100%"
          :controls="false"
        />
      </div>

      <!--
        Zero is a legitimate value with a very different meaning from blank, and
        the difference is invisible in a number field. Spelling it out here is
        cheaper than an owner accidentally switching a node off.
      -->
      <p v-if="hasZero" class="zero-warning">
        A cap of <strong>0</strong> blocks every run on that axis. Clear the field
        instead to leave the axis unlimited.
      </p>

      <div class="form-row">
        <label class="form-label">Notes</label>
        <el-input
          v-model="form.notes"
          type="textarea"
          :rows="2"
          placeholder="Optional — why this cap exists"
        />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="onClose" :disabled="saving">Cancel</el-button>
        <el-button type="primary" :disabled="!canSave" :loading="saving" @click="onSave">
          Save
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElButton, ElDialog, ElInput, ElInputNumber, ElOption, ElSelect, ElMessage } from 'element-plus'
import {
  useNodePipelineQuotaStore,
  axesForScope,
  SCOPE_DEFAULT,
  SCOPE_NODE,
} from '@/stores/nodePipelineQuotaStore'

const props = defineProps({
  visible: { type: Boolean, default: false },
  nodeId: { type: String, required: true },
  // 'edit-node' | 'edit-default' | 'add-user' | 'edit-user'
  mode: { type: String, required: true },
  row: { type: Object, default: null },
  subjectLabel: { type: String, default: '' },
  availableUsers: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:visible', 'saved'])
const store = useNodePipelineQuotaStore()

const saving = ref(false)
const form = ref({ userId: '', notes: '' })

const scope = computed(() => {
  if (props.mode === 'edit-node') return SCOPE_NODE
  if (props.mode === 'edit-default') return SCOPE_DEFAULT
  return form.value.userId
})

// Which axes this scope accepts. The node scope has no per-run ceiling — see
// the note in nodePipelineQuotaStore.
const axes = computed(() => axesForScope(props.mode === 'edit-node' ? SCOPE_NODE : ''))

const title = computed(
  () =>
    ({
      'edit-node': 'Edit node-wide pipeline budget',
      'edit-default': 'Edit default per-user pipeline budget',
      'add-user': 'Add user override',
      'edit-user': 'Edit user override',
    }[props.mode] || 'Edit pipeline budget'),
)

const blurb = computed(() => {
  if (props.mode === 'edit-node') {
    return 'Caps spend across all users of this node combined. Leave a field blank to leave that axis unlimited.'
  }
  if (props.mode === 'edit-default') {
    return 'Applies to each user individually, unless they have an override below. Leave a field blank to leave that axis unlimited.'
  }
  return 'Applies to this user only, and takes precedence over the default. Leave a field blank to fall back to the default.'
})

const hasZero = computed(() => axes.value.some((a) => form.value[a.key] === 0))

const canSave = computed(() => {
  if (props.mode === 'add-user' && !form.value.userId) return false
  return true
})

function userLabel(u) {
  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim()
  return name || u.email || u.id
}

watch(
  () => [props.visible, props.row, props.mode],
  () => {
    if (!props.visible) return
    const next = { userId: props.mode === 'add-user' ? '' : props.row?.userId || '', notes: props.row?.notes ?? '' }
    // Seed every axis, not just the ones this scope uses, so switching modes
    // can't carry a stale value across.
    for (const axis of axesForScope('')) {
      next[axis.key] = props.mode === 'add-user' ? null : props.row?.[axis.key] ?? null
    }
    form.value = next
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
    await store.putRow(props.nodeId, scope.value, form.value)
    emit('saved')
    emit('update:visible', false)
  } catch (e) {
    ElMessage.error(`Failed to save budget: ${e?.message || e}`)
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

.zero-warning {
  margin: 0;
  font-size: 12px;
  color: theme.$orange_1;
  line-height: 1.5;
}

.dialog-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
</style>
