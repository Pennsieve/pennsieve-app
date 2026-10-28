<template>
  <div class="dataset-proposals">
    <div class="page-header">
      <p class="page-description">
        Manage your dataset proposal submissions. Track the status of your submissions, edit drafts, 
        and submit new proposals to available repositories.
      </p>
      
      <div class="header-actions">
        <bf-button 
          class="primary"
          @click="startNewProposal"
        >
          New Proposal
        </bf-button>
      </div>
    </div>

    <div class="proposals-content">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner">
          <div class="spinner"></div>
        </div>
        <p>Loading your proposals...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="loadError" class="error-state">
        <p class="error-message">{{ loadError }}</p>
        <bf-button @click="fetchProposals" class="secondary">
          Try Again
        </bf-button>
      </div>

      <!-- Proposals List -->
      <div v-else-if="hasProposals" class="proposals-section">
        <div class="list-header">
          <h2>Your Proposals ({{ datasetProposals.length }})</h2>
        </div>
        
        <div class="proposals-list">
          <request-list-item
            v-for="proposal in datasetProposals"
            :key="proposal.nodeId"
            :dataset-request="proposal"
            @edit="editProposal"
            @remove="removeProposal"
            @submit="submitProposal"
            @withdraw="withdrawProposal"
            @open-dataset="openDataset"
            @copy-to-draft="copyProposalToDraft"
          />
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <div class="empty-content">
          <div class="empty-icon">
            <IconDocument :width="64" :height="64" color="currentColor" />
          </div>
          <h2>No Dataset Proposals Yet</h2>
          <p>
            You haven't created any dataset proposals yet. Submit your datasets to open repositories 
            for review and publication.
          </p>
          <bf-button 
            class="primary"
            @click="startNewProposal"
          >
            Create Your First Proposal
          </bf-button>
        </div>
      </div>
    </div>

    <!-- Proposal Survey Modal -->
    <proposal-survey
      :dialog-visible="showProposalDialog"
      :repository="selectedRepository"
      :proposal="activeProposal"
      :copied-from="copySourceProposal"
      :read-only="Boolean(activeProposal) && activeProposal.proposalStatus !== 'DRAFT'"
      :processing="isSavingProposal"
      allow-copy-to-draft
      @copy-to-draft="copyProposalToDraft"
      @create-proposal="handleSaveProposal"
      @submit-proposal="handleSubmitProposal"
      @recreate-proposal="handleSaveProposal"
      @recreate-and-submit-proposal="handleSubmitProposal"
      @close="closeProposalDialog"
    />


    <!-- Confirmation Dialog -->
    <confirm-dialog
      v-model:visible="isConfirmDialogVisible"
      :heading="confirmDialog.heading"
      :message="confirmDialog.message"
      :variant="confirmDialog.variant"
      :icon="confirmDialog.icon"
      :confirm-label="confirmDialog.confirmLabel"
      :processing="isConfirmProcessing"
      @confirm="handleConfirmedAction"
    />
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, watch, nextTick } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useProposalStore } from '@/stores/proposalStore'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import RequestListItem from './RequestListItem.vue'
import ProposalSurvey from './ProposalSurvey.vue'
import IconTrashLine from '@/components/icons/IconTrashLine.vue'
import IconUndoLine from '@/components/icons/IconUndoLine.vue'
import IconSendLine from '@/components/icons/IconSendLine.vue'
import ConfirmDialog from '@/components/shared/ConfirmDialog/ConfirmDialog.vue'
import IconDocument from '@/components/icons/IconDocument.vue'
import { useProposalSave } from '@/composables/useProposalSave'
import { getProposalErrorMessage, isStaleProposalError } from '@/utils/proposalErrorMessages'

const store = useStore()
const proposalStore = useProposalStore()
const router = useRouter()
const { isSavingProposal, saveProposal } = useProposalSave()

// Reactive data
const isLoading = ref(false)
const loadError = ref('')
const showProposalDialog = ref(false)
const selectedRepository = ref({})
const activeProposal = ref({})
const copySourceProposal = ref(null)
const isConfirmDialogVisible = ref(false)
const isConfirmProcessing = ref(false)
// shallowRef: the icon is a component and must not be made deeply reactive
const confirmDialog = shallowRef({
  action: '',
  proposal: null,
  heading: '',
  message: '',
  variant: 'default',
  icon: undefined,
  confirmLabel: '',
})

// Computed properties
const datasetProposals = computed(() => {
  return [...proposalStore.datasetProposals].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  )
})
const hasProposals = computed(() => proposalStore.hasProposals)
const repositories = computed(() => proposalStore.repositories)
const profile = computed(() => store.state.profile)

// Methods
const fetchProposals = async () => {
  isLoading.value = true
  loadError.value = ''

  await proposalStore.fetchProposals()
  if (proposalStore.proposalsError) {
    loadError.value = 'Failed to load proposals. Please try again.'
  }
  isLoading.value = false
}

const fetchRepositories = async () => {
  try {
    await proposalStore.fetchRepositories()
  } catch (err) {
    console.error('Error fetching repositories:', err)
  }
}

const startNewProposal = () => {
  // Open ProposalSurvey dialog for new proposal
  activeProposal.value = null // Clear any existing proposal
  selectedRepository.value = repositories.value[0] || {} // Default to first available repository
  showProposalDialog.value = true
}

const handleSaveProposal = async (proposalData) => {
  if (await saveProposal(proposalData)) {
    closeProposalDialog()
  }
}

const handleSubmitProposal = async (proposalData) => {
  if (await saveProposal(proposalData, { submit: true })) {
    closeProposalDialog()
  }
}

const closeProposalDialog = () => {
  showProposalDialog.value = false
  selectedRepository.value = {}
  activeProposal.value = {}
  copySourceProposal.value = null
}

const editProposal = (proposal) => {
  activeProposal.value = proposal

  selectedRepository.value = repositories.value.find(repo =>
    repo.organizationNodeId === proposal.organizationNodeId
  ) || {}
  showProposalDialog.value = true
}

const removeProposal = (proposal) => {
  confirmDialog.value = {
    action: 'remove',
    proposal,
    heading: `Remove proposal "${proposal.name}"?`,
    message: 'This will permanently delete the dataset proposal and cannot be undone.',
    variant: 'danger',
    icon: IconTrashLine,
    confirmLabel: 'Remove',
  }
  isConfirmDialogVisible.value = true
}

const submitProposal = (proposal) => {
  const repository = repositories.value.find(repo => 
    repo.organizationNodeId === proposal.organizationNodeId
  )
  const repositoryName = repository?.displayName || 'Unknown Repository'
  
  confirmDialog.value = {
    action: 'submit',
    proposal,
    heading: `Submit proposal "${proposal.name}"?`,
    message: `This will submit your proposal to ${repositoryName} for review. You will not be able to edit it after submission.`,
    variant: 'default',
    icon: IconSendLine,
    confirmLabel: 'Submit',
  }
  isConfirmDialogVisible.value = true
}

const withdrawProposal = (proposal) => {
  const repository = repositories.value.find(repo => 
    repo.organizationNodeId === proposal.organizationNodeId
  )
  const repositoryName = repository?.displayName || 'Unknown Repository'
  
  confirmDialog.value = {
    action: 'withdraw',
    proposal,
    heading: `Withdraw proposal "${proposal.name}"?`,
    message: `This will withdraw your proposal from ${repositoryName}. A withdrawn proposal can't be resubmitted, but you can copy it into a new draft.`,
    variant: 'danger',
    icon: IconUndoLine,
    confirmLabel: 'Withdraw',
  }
  isConfirmDialogVisible.value = true
}

const copyProposalToDraft = async (sourceProposal) => {
  if (showProposalDialog.value) {
    closeProposalDialog()
    await nextTick()
  }

  copySourceProposal.value = sourceProposal
  activeProposal.value = null
  selectedRepository.value = repositories.value.find(repo =>
    repo.organizationNodeId === sourceProposal.organizationNodeId
  ) || {}
  showProposalDialog.value = true
}

const openDataset = (proposal) => {
  // Navigate to the dataset
  router.push(`/${proposal.organizationNodeId}/datasets/${proposal.datasetNodeId}/overview`)
}

const handleConfirmedAction = async () => {
  const { action, proposal } = confirmDialog.value
  const storeActions = {
    remove: proposalStore.removeProposal,
    submit: proposalStore.submitProposal,
    withdraw: proposalStore.withdrawProposal,
  }
  const successMessages = {
    remove: 'Proposal removed',
    submit: 'Proposal submitted',
    withdraw: 'Proposal withdrawn',
  }

  isConfirmProcessing.value = true
  try {
    await storeActions[action](proposal)
    ElMessage.success(successMessages[action])
    isConfirmDialogVisible.value = false
  } catch (err) {
    ElMessage.error(getProposalErrorMessage(action, err))
    // A stale proposal can't be retried, so close and show its real status;
    // otherwise keep the dialog open so the user can try again
    if (isStaleProposalError(err)) {
      isConfirmDialogVisible.value = false
      await fetchProposals()
    }
  } finally {
    isConfirmProcessing.value = false
  }
}

// Lifecycle
onMounted(async () => {
  await Promise.all([
    fetchProposals(),
    fetchRepositories()
  ])
})

const handleQueryParameters = () => {
  const urlParams = new URLSearchParams(window.location.search)
  const openSubmitModal = urlParams.get('openSubmitModal')
  const repositoryId = urlParams.get('repositoryId')
  const repositoryName = urlParams.get('repositoryName')
  
  if (openSubmitModal === 'true' && repositories.value.length > 0) {
    let repository = null
    
    // Try to find repository by ID first, then by name
    if (repositoryId) {
      repository = repositories.value.find(repo => 
        repo.organizationNodeId === repositoryId || 
        repo.id === repositoryId ||
        repo.name?.toLowerCase() === repositoryId.toLowerCase() ||
        repo.displayName?.toLowerCase() === repositoryId.toLowerCase()
      )
    }
    
    // If not found by ID and repositoryName is provided, search by name
    if (!repository && repositoryName) {
      repository = repositories.value.find(repo => 
        repo.name?.toLowerCase() === repositoryName.toLowerCase() ||
        repo.displayName?.toLowerCase() === repositoryName.toLowerCase()
      )
    }
    
    if (repository) {
      // Set the repository and open modal
      selectedRepository.value = repository
      activeProposal.value = null
      showProposalDialog.value = true
      
      // Clean up URL by removing query parameters
      const newUrl = window.location.pathname
      window.history.replaceState({}, document.title, newUrl)
    } else {
      const searchTerm = repositoryId || repositoryName
      if (searchTerm) {
        console.warn(`Repository "${searchTerm}" not found`)
      }
    }
  }
}

// Watch for repositories to be loaded and handle query parameters
watch(repositories, (newRepositories) => {
  if (newRepositories.length > 0) {
    handleQueryParameters()
  }
}, { immediate: true })
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.dataset-proposals {
  //padding: 40px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 40px;
  
  h1 {
    font-size: 28px;
    font-weight: 300;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }
  
  .page-description {
    font-size: 16px;
    color: theme.$gray_5;
    line-height: 1.6;
    margin: 0 0 24px 0;
    max-width: 800px;
  }
  
  .header-actions {
    display: flex;
    justify-content: flex-end;
  }
}

.proposals-content {
  min-height: 400px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  
  .loading-spinner {
    margin-bottom: 16px;
    
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid theme.$gray_2;
      border-top: 4px solid theme.$purple_2;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  }
  
  p {
    color: theme.$gray_5;
    font-size: 16px;
  }
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  
  .error-message {
    color: #e74c3c;
    font-size: 16px;
    margin-bottom: 16px;
    text-align: center;
  }
}

.proposals-section {
  .list-header {
    margin-bottom: 24px;
    
    h2 {
      font-size: 20px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0;
    }
  }
}

.proposals-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  
  .empty-content {
    text-align: center;
    max-width: 500px;
    
    .empty-icon {
      color: theme.$purple_tint;
      margin-bottom: 16px;
    }
    
    h2 {
      font-size: 24px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0 0 16px 0;
    }
    
    p {
      font-size: 16px;
      color: theme.$gray_5;
      line-height: 1.6;
      margin: 0 0 24px 0;
    }
  }
}

// Responsive Design
@media (max-width: 768px) {
  .dataset-proposals {
    padding: 20px;
  }
  
  .page-header {
    .header-actions {
      justify-content: center;
    }
  }
  
  .proposals-grid {
    gap: 12px;
  }
}

// Animation for spinner
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>