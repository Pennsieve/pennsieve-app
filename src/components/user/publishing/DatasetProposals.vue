<template>
  <div class="dataset-proposals">
    <div class="page-header">
      <p class="page-description">
        Manage your dataset proposal submissions. Track the status of your submissions, edit drafts, 
        and submit new proposals to open repositories.
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
      <div v-else-if="error" class="error-state">
        <p class="error-message">{{ error }}</p>
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
            :key="proposal.id"
            :dataset-request="proposal"
            @edit="editProposal"
            @remove="removeProposal"
            @submit="submitProposal"
            @withdraw="withdrawProposal"
            @open-dataset="openDataset"
            @resubmit="resubmitProposal"
          />
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <div class="empty-content">
          <div class="empty-icon">📋</div>
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
      :read-only="activeProposal && !['DRAFT', 'WITHDRAWN'].includes(activeProposal.proposalStatus)"
      @create-proposal="handleCreateProposal"
      @submit-proposal="handleSubmitProposal"
      @recreate-proposal="handleRecreateProposal"
      @recreate-and-submit-proposal="handleRecreateAndSubmitProposal"
      @close="closeProposalDialog"
    />


    <!-- Confirmation Dialog -->
    <confirmation-dialog
      :dialog-visible="confirmationDialogVisible"
      :action="confirmationDialog.action"
      :action-message="confirmationDialog.actionMessage"
      :resource="confirmationDialog.resource"
      :info-message="confirmationDialog.infoMessage"
      :warning-message="confirmationDialog.warningMessage"
      :confirm-action-label="confirmationDialog.confirmActionLabel"
      :cancel-action-label="confirmationDialog.cancelActionLabel"
      @close="closeConfirmationDialog"
      @confirmed="handleConfirmedAction"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import { useProposalStore } from '@/stores/proposalStore'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import RequestListItem from './RequestListItem.vue'
import ProposalSurvey from './ProposalSurvey.vue'
import ConfirmationDialog from '@/components/shared/ConfirmationDialog/ConfirmationDialog.vue'

const store = useStore()
const proposalStore = useProposalStore()
const router = useRouter()

// Reactive data
const isLoading = ref(false)
const error = ref('')
const showProposalDialog = ref(false)
const selectedRepository = ref({})
const activeProposal = ref({})
const confirmationDialogVisible = ref(false)
const confirmationDialog = ref({
  action: '',
  actionMessage: '',
  resource: {},
  infoMessage: '',
  warningMessage: '',
  confirmActionLabel: '',
  cancelActionLabel: '',
})

// Computed properties
const datasetProposals = computed(() => {
  // Sort proposals by updatedAt timestamp, most recent first
  return [...proposalStore.datasetProposals].sort((a, b) => {
    const aTime = a.updatedAt || a.createdAt || 0
    const bTime = b.updatedAt || b.createdAt || 0
    return bTime - aTime // Descending order (newest first)
  })
})
const hasProposals = computed(() => proposalStore.hasProposals)
const repositories = computed(() => proposalStore.repositories)
const profile = computed(() => store.state.profile)

// Methods
const fetchProposals = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    await proposalStore.fetchProposals()
  } catch (err) {
    error.value = 'Failed to load proposals. Please try again.'
    console.error('Error fetching proposals:', err)
  } finally {
    isLoading.value = false
  }
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

const handleCreateProposal = async (proposalData) => {
  try {
    // Check if we're editing an existing proposal (has nodeId) or creating new
    if (proposalData.nodeId) {
      // Editing existing proposal - use PUT API
      await proposalStore.updateProposal(proposalData, profile.value)
    } else {
      // Creating new proposal - use POST API
      await proposalStore.storeNewProposal(proposalData, profile.value)
    }
    closeProposalDialog()
  } catch (err) {
    const action = proposalData.nodeId ? 'update' : 'create'
    error.value = `Failed to ${action} proposal. Please try again.`
    console.error(`Error ${action}ing proposal:`, err)
  }
}

const handleSubmitProposal = async (proposalData) => {
  try {
    let proposalToSubmit = proposalData
    
    // If editing existing proposal, first update it
    if (proposalData.nodeId) {
      const response = await proposalStore.updateProposal(proposalData, profile.value)
      proposalToSubmit = response.result
    } else {
      // If creating new proposal, first save it as DRAFT
      const response = await proposalStore.storeNewProposal(proposalData, profile.value)
      proposalToSubmit = response.result
    }
    
    // Now submit the proposal
    if (proposalToSubmit?.nodeId) {
      await proposalStore.submitProposal(proposalToSubmit)
    }
    
    closeProposalDialog()
  } catch (err) {
    error.value = 'Failed to submit proposal. Please try again.'
    console.error('Error submitting proposal:', err)
  }
}

const handleRecreateProposal = async (proposalData) => {
  try {
    // First delete the original proposal
    await proposalStore.removeProposal(proposalData._originalProposal)
    
    // Then create the new proposal with the new repository
    delete proposalData._originalProposal
    delete proposalData._requiresRecreation
    await proposalStore.storeNewProposal(proposalData, profile.value)
    
    closeProposalDialog()
  } catch (err) {
    error.value = 'Failed to move proposal to new repository. Please try again.'
    console.error('Error recreating proposal:', err)
  }
}

const handleRecreateAndSubmitProposal = async (proposalData) => {
  try {
    // First delete the original proposal
    await proposalStore.removeProposal(proposalData._originalProposal)
    
    // Then create the new proposal with the new repository
    delete proposalData._originalProposal
    delete proposalData._requiresRecreation
    const response = await proposalStore.storeNewProposal(proposalData, profile.value)
    
    // Now submit the new proposal
    if (response.result?.nodeId) {
      await proposalStore.submitProposal(response.result)
    }
    
    closeProposalDialog()
  } catch (err) {
    error.value = 'Failed to move and submit proposal to new repository. Please try again.'
    console.error('Error recreating and submitting proposal:', err)
  }
}

const closeProposalDialog = () => {
  showProposalDialog.value = false
  selectedRepository.value = {}
  activeProposal.value = {}
}

const editProposal = (proposal) => {
  activeProposal.value = proposal
  
  // Find the repository for this proposal
  const repository = repositories.value.find(repo => 
    repo.organizationNodeId === proposal.organizationNodeId
  )
  
  if (repository) {
    selectedRepository.value = repository
    showProposalDialog.value = true
  } else {
    error.value = 'Repository not found for this proposal.'
  }
}

const removeProposal = (proposal) => {
  confirmationDialog.value = {
    action: 'remove',
    actionMessage: `Remove Dataset Proposal: "${proposal.name}"?`,
    resource: proposal,
    warningMessage: 'This will permanently delete the dataset proposal and cannot be undone.',
    confirmActionLabel: 'Remove',
    cancelActionLabel: 'Cancel',
  }
  confirmationDialogVisible.value = true
}

const submitProposal = (proposal) => {
  const repository = repositories.value.find(repo => 
    repo.organizationNodeId === proposal.organizationNodeId
  )
  const repositoryName = repository?.displayName || 'Unknown Repository'
  
  confirmationDialog.value = {
    action: 'submit',
    actionMessage: `Submit Dataset Proposal: "${proposal.name}"?`,
    resource: proposal,
    warningMessage: `This will submit your proposal to ${repositoryName} for review. You will not be able to edit it after submission.`,
    confirmActionLabel: 'Submit',
    cancelActionLabel: 'Cancel',
  }
  confirmationDialogVisible.value = true
}

const withdrawProposal = (proposal) => {
  const repository = repositories.value.find(repo => 
    repo.organizationNodeId === proposal.organizationNodeId
  )
  const repositoryName = repository?.displayName || 'Unknown Repository'
  
  confirmationDialog.value = {
    action: 'withdraw',
    actionMessage: `Withdraw Dataset Proposal: "${proposal.name}"?`,
    resource: proposal,
    warningMessage: `This will withdraw your proposal from ${repositoryName}. You can resubmit it later if needed.`,
    confirmActionLabel: 'Withdraw',
    cancelActionLabel: 'Cancel',
  }
  confirmationDialogVisible.value = true
}

const resubmitProposal = (proposal) => {
  // Navigate to open repositories page to select a new repository for resubmission
  router.push({ name: 'open-repositories' })
}

const openDataset = (proposal) => {
  // Navigate to the dataset
  router.push(`/${proposal.organizationNodeId}/datasets/${proposal.datasetNodeId}/overview`)
}

const handleConfirmedAction = async (event) => {
  const { action, resource } = event
  
  try {
    switch (action) {
      case 'remove':
        await proposalStore.removeProposal(resource)
        break
      case 'submit':
        await proposalStore.submitProposal(resource)
        break
      case 'withdraw':
        await proposalStore.withdrawProposal(resource)
        break
    }
  } catch (err) {
    error.value = `Failed to ${action} proposal. Please try again.`
    console.error(`Error ${action} proposal:`, err)
  }
  
  closeConfirmationDialog()
}

const closeConfirmationDialog = () => {
  confirmationDialogVisible.value = false
  confirmationDialog.value = {
    action: '',
    actionMessage: '',
    resource: {},
    infoMessage: '',
    warningMessage: '',
    confirmActionLabel: '',
    cancelActionLabel: '',
  }
}

// Lifecycle
onMounted(async () => {
  await Promise.all([
    fetchProposals(),
    fetchRepositories()
  ])
})
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
  background: white;
  border-radius: 4px;
  border: 1px solid theme.$gray_2;
  overflow: hidden;
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
      font-size: 64px;
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