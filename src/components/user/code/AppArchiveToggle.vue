<script setup>
/*
  Shared archive/restore toggle for an App Store application.

  Renders an Active/Archived switch and owns the lifecycle change:
  PATCH /applications/store/{uuid} with { status }. Archiving also turns off
  App Store publishing for the source repository (restoring does not turn it
  back on). The switch only flips after the backend confirms the change.
  Emits `change` with the new status so the parent can update its local copy.
*/
import { computed, ref } from 'vue'
import { useStore } from 'vuex'
import { ElMessage, ElMessageBox } from 'element-plus'

const props = defineProps({
  uuid: {
    type: String,
    required: true,
  },
  ownerId: {
    type: [String, Number],
    default: null,
  },
  // Application's source repo URL — used to turn off publishing on archive.
  sourceUrl: {
    type: String,
    default: '',
  },
  // Current lifecycle status: 'active' | 'archived'.
  status: {
    type: String,
    default: 'active',
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

const normalizeRepoUrl = (url) =>
  (url || '').replace(/\.git$/, '').replace(/\/+$/, '').toLowerCase()

// Turn off App Store publishing for the source repository. The /repositories
// update is a full write, so we preserve the current publish_to_discover flag
// and only clear publish_to_appstore.
const disableAppStorePublishing = async () => {
  if (!props.sourceUrl) return

  if (!store.state.codeReposModule.myReposLoaded) {
    await store.dispatch('codeReposModule/fetchAllMyRepos')
  }

  const target = normalizeRepoUrl(props.sourceUrl)
  const repos = store.state.codeReposModule.myRepos || []
  const repo = repos.find((r) =>
    [r.html_url, r.url].some((u) => u && normalizeRepoUrl(u) === target)
  )

  if (!repo) {
    throw new Error(`Could not find a repository matching ${props.sourceUrl}`)
  }
  if (!repo.publishing_to_appstore) return // already off — nothing to do

  await store.dispatch('codeReposModule/updateRepoPublishingSettings', {
    repoUrl: repo.url,
    publish_to_discover: Boolean(repo.publishing_to_discover),
    publish_to_appstore: false,
  })
}

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

    // Archiving must also turn off App Store publishing. Restoring does not
    // re-enable it.
    if (nextStatus === 'archived') {
      try {
        await disableAppStorePublishing()
      } catch (pubErr) {
        console.error('Failed to disable App Store publishing:', pubErr)
        ElMessage.warning(
          'Application archived, but App Store publishing could not be turned off automatically. Please disable it in the repository’s publishing settings.'
        )
        emit('change', nextStatus)
        return true // archive succeeded; keep the toggle archived
      }
    }

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
</script>

<template>
  <el-tooltip
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
.archive-toggle-wrap {
  display: inline-flex;
  align-items: center;
}
</style>
