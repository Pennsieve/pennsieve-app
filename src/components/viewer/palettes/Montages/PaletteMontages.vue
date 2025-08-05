<script setup>
import bfButton from "@/components/shared/bf-button/BfButton.vue";
import { useStore } from "vuex";
import { computed, ref } from "vue";
import MontageAccordion from "@/components/viewer/palettes/Montages/MontageAccordion.vue";
import IconXCircle from "@/components/icons/IconXCircle.vue";
import TsCreateMontageDialog from "@/components/viewers/TSViewer/TsCreateMontageDialog.vue";
import ConfirmationDialog from "@/components/shared/ConfirmationDialog/ConfirmationDialog.vue";
import toQueryParams from "@/utils/toQueryParams";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import { useViewerStore } from '@/stores/tsviewer'

// Store setup
const viewerStore = useViewerStore()
const store = useStore() // Keep for non-viewer related state like config and activeOrganization

// Props and emits
const emit = defineEmits(["open-new-montage"])

const props = defineProps({
  windowHeight: {
    type: Number,
    default: 0,
  },
})

// Reactive data
const createMontageDialogVisible = ref(false)
const confirmationDialogVisible = ref(false)
const deleteMontageItem = ref({})

// Computed properties - all using viewerStore now
const workspaceMontages = computed(() => {
  return viewerStore.workspaceMontages
})

const selectedMontageName = computed(() => viewerStore.viewerMontageScheme)

const expandedMontages = computed(() => {
  const defaultMontage = {
    name: "NOT_MONTAGED",
    displayName: "As Recorded",
    channelPairs: []
  }

  const wsMontages = viewerStore.workspaceMontages
  if (wsMontages.length > 1) {
    return [defaultMontage, ...wsMontages]
  } else {
    return [defaultMontage]
  }
})

// Methods
function onMontageSelected(montageName) {
  console.log('select: ' + montageName)
  viewerStore.setViewerMontageScheme(montageName)
}

function createMontage() {
  viewerStore.setViewerMontageScheme("NOT_MONTAGED")
  createMontageDialogVisible.value = true
}

function closeCreateMontageDialog() {
  createMontageDialogVisible.value = false
}

function deleteMontage(item) {
  deleteMontageItem.value = item
  confirmationDialogVisible.value = true
}

async function doDeleteMontage(evt) {
  confirmationDialogVisible.value = false

  const endpoint = `${store.state.config.api2Url}/timeseries/montages`
  const queryParams = toQueryParams({
    organization_id: store.state.activeOrganization.organization.id,
    montage_name: evt.resource.name,
  })

  const url = `${endpoint}?${queryParams}`

  try {
    const token = await useGetToken()
    await useSendXhr(url, {
      method: "DELETE",
      header: {
        Authorization: `Bearer ${token}`,
      },
    })

    console.log('SUCCESS DELETE MONTAGE')
    confirmationDialogVisible.value = false

    // Fetch updated montages using viewerStore
    await viewerStore.fetchWorkspaceMontages()
  } catch (error) {
    console.error('Error deleting montage:', error)
    // Could add error handling/notification here
  }
}
</script>

<template>
  <div class="palette-montages">
    <div class="montages-heading">
      <div class="controls">
        <bf-button @click="createMontage">
          Create New Montage
        </bf-button>
      </div>
    </div>

    <div id="montageWrap">
      <montage-accordion
        v-for="montage in expandedMontages"
        :ref="`accordion-${montage.name}`"
        :key="montage.name"
        :title="montage.displayName"
        :selected="montage.name === selectedMontageName"
        :window-height="windowHeight"
        :nr-layers="workspaceMontages.length"
        @selectItem="onMontageSelected(montage.name)"
        icon="blackfynn:chevron-down-small"
      >
        <template #operations>
          <div v-if="montage.name === selectedMontageName" class="icon-wrapper">
            <IconXCircle stroke="#808fad" fill="#808fad" class="active-indicator"/>
          </div>
        </template>
        <template #items>
          <div v-if="montage.name !== 'NOT_MONTAGED'">
            <div class="delete-container">
              <button @click="deleteMontage(montage)">
                delete montage
              </button>
            </div>

            <div v-for="pair in montage.channelPairs" class="pair-info">
              <div>
                {{ pair.name }}
              </div>
              <div>
                {{ pair.channels[0] }} - {{ pair.channels[1] }}
              </div>
            </div>
          </div>

        </template>
      </montage-accordion>
    </div>

    <ts-create-montage-dialog :visible="createMontageDialogVisible" @close="closeCreateMontageDialog"/>

    <confirmation-dialog
      :dialog-visible="confirmationDialogVisible"
      action="Delete"
      action-message="Are you sure you want to delete the montage?"
      :resource="deleteMontageItem"
      warning-message="This will delete the montage and cannot be undone."
      confirm-action-label="Delete"
      cancel-action-label="Cancel"
      @close="confirmationDialogVisible = false"
      @confirmed="doDeleteMontage"
    />
  </div>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme';

.pair-info {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 8px 16px;
  background: white;
  border-bottom: 1px solid theme.$gray_0;
}

.palette-montages {
  background: #fff;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.montages-heading {
  align-items: center;
  background: theme.$purple_0_7;
  border-bottom: solid 1px theme.$gray_2;
  display: flex;
  padding: 8px;
}

.icon-wrapper {
  display: flex;
  .active-indicator {
    padding: 0 8px;
  }
}

.delete-container{
  background: white;
  border-bottom: 1px solid theme.$gray_0;
  display: flex;
  justify-content: end;
  height: 25px;
}
</style>