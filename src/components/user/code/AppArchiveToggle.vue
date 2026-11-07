<script setup>
/*
  Shared archive/restore toggle for an App Store application.

  Renders an Active/Archived switch and owns the lifecycle change:
  PATCH /applications/store/{uuid} with { status }. The switch only flips
  after the backend confirms the change. Emits `change` with the new status
  so the parent can update its local copy.
*/
import { computed, ref } from 'vue'
import { useStore } from 'vuex'
import { ElMessage, ElMessageBox } from 'element-plus'
import BfButton from '@/components/shared/bf-button/BfButton.vue'

const props = defineProps({
  uuid: {
    type: String,
    required: true,
  },
  ownerId: {
    type: [String, Number],
    default: null,
  },
  // Current lifecycle status: 'active' | 'archived'.
  status: {
    type: String,
    default: 'active',
  },
  // 'switch' (an Active/Archived switch) or 'button' (an Archive / Restore
  // button with what it does, for a page's danger zone).
  variant: {
    type: String,
    default: 'switch',
  },
})

const emit = defineEmits(['change'])

const store = useStore()
const profile = computed(() => store.state.profile)

const isArchiving = ref(false)

const isCurrentUser = (id) =>
  !!id && (id === profile.value?.id || id === profile.value?.intId)

const isAppOwner = computed(() => isCurrentUser(props.ownerId))
const isArchived = computed(() => props.status === 'archived')

const ownerTooltip = computed(() =>
  isAppOwner.value ? '' : 'Only Application Owners Can Archive Applications'
)

// el-switch :before-change handler. Resolve true to let the toggle flip,
// reject (or resolve false) to keep it where it was.
const handleArchiveToggle = async () => {
  if (!props.uuid || !isAppOwner.value) return false
  const nextStatus = isArchived.value ? 'active' : 'archived'

  if (nextStatus === 'archived') {
    // Rejects on cancel, which stops the toggle.
    await ElMessageBox.confirm(
      'Archive this application? It will be removed from active workspaces and workflows that reference it will no longer be able to run it. The underlying record is preserved and you can restore it later.',
      'Archive Application',
      { confirmButtonText: 'Archive', cancelButtonText: 'Cancel', type: 'warning' }
    )
  }

  isArchiving.value = true
  try {
    await store.dispatch('analysisModule/setApplicationStatus', {
      uuid: props.uuid,
      status: nextStatus,
    })
    // Refresh the shared applications list so other views reflect the change.
    store
      .dispatch('analysisModule/fetchApplications', { force: true })
      .catch(() => {})

    emit('change', nextStatus)
    ElMessage.success(
      nextStatus === 'archived' ? 'Application archived' : 'Application restored'
    )
    return true
  } catch (error) {
    console.error(error)
    ElMessage.error('Failed to update application status. Please try again.')
    throw error // keep the toggle in its previous position
  } finally {
    isArchiving.value = false
  }
}

// The button form: the same change; a cancelled confirmation or a failure
// leaves things as they were (the handler already said why).
const onButton = () => handleArchiveToggle().catch(() => {})
</script>

<template>
  <div v-if="variant === 'button'" class="archive-danger">
    <p v-if="!isArchived">
      Archive this app: it leaves active workspaces, and workflows that use it can no longer run it. Its record is kept, and
      you can restore it later.
    </p>
    <p v-else>This app is archived. Restore it to make it available in workspaces and workflows again.</p>
    <bf-button
      :class="isArchived ? 'secondary' : 'red'"
      :processing="isArchiving"
      :disabled="isArchiving"
      @click="onButton"
    >{{ isArchived ? 'Restore app' : 'Archive app' }}</bf-button>
  </div>
  <el-tooltip
    v-else
    :content="ownerTooltip"
    placement="top"
    :disabled="isAppOwner"
  >
    <span class="archive-toggle-wrap">
      <el-switch
        :model-value="!isArchived"
        :loading="isArchiving"
        :disabled="!isAppOwner"
        :before-change="handleArchiveToggle"
        active-text="Active"
        inactive-text="Archived"
      />
    </span>
  </el-tooltip>
</template>

<style scoped lang="scss">
@use '../../../styles/theme';

.archive-danger {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid theme.$red_1;
  border-radius: 6px;
  background: theme.$red_tint;

  p {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: theme.$gray_6;
  }
}
.archive-toggle-wrap {
  display: inline-flex;
  align-items: center;
}
</style>
