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
      <div v-else-if="hasProposals" class="proposals-list">
        <div class="list-header">
          <h2>Your Proposals ({{ datasetProposals.length }})</h2>
        </div>
        
        <div class="proposals-grid">
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
      @create-proposal="handleCreateProposal"
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
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import RequestListItem from './RequestListItem.vue'
import ProposalSurvey from './ProposalSurvey.vue'
import ConfirmationDialog from '@/components/shared/ConfirmationDialog/ConfirmationDialog.vue'

const store = useStore()
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
const datasetProposals = computed(() => store.state.repositoryModule?.datasetProposals || [])
const hasProposals = computed(() => datasetProposals.value.length > 0)
const repositories = computed(() => store.state.repositoryModule?.repositories || [])

// Methods
const fetchProposals = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    await store.dispatch('repositoryModule/fetchProposals')
  } catch (err) {
    error.value = 'Failed to load proposals. Please try again.'
    console.error('Error fetching proposals:', err)
  } finally {
    isLoading.value = false
  }
}

const fetchRepositories = async () => {
  try {
    await store.dispatch('repositoryModule/fetchRepositories')
  } catch (err) {
    console.error('Error fetching repositories:', err)
  }
}

const startNewProposal = () => {
  // Navigate to open repositories page to select a repository
  router.push({ name: 'open-repositories' })
}

const handleCreateProposal = async (proposalData) => {
  try {
    await store.dispatch('repositoryModule/storeNewProposal', proposalData)
    await fetchProposals()
    closeProposalDialog()
  } catch (err) {
    error.value = 'Failed to create proposal. Please try again.'
    console.error('Error creating proposal:', err)
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
        await store.dispatch('repositoryModule/removeProposal', resource)
        break
      case 'submit':
        await store.dispatch('repositoryModule/submitProposal', resource)
        break
      case 'withdraw':
        await store.dispatch('repositoryModule/withdrawProposal', resource)
        break
    }
    
    await fetchProposals()
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
@import '../../../styles/_theme.scss';

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
    color: $gray_6;
    margin: 0 0 8px 0;
  }
  
  .page-description {
    font-size: 16px;
    color: $gray_5;
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
      border: 4px solid $gray_2;
      border-top: 4px solid $purple_2;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  }
  
  p {
    color: $gray_5;
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

.proposals-list {
  .list-header {
    margin-bottom: 24px;
    
    h2 {
      font-size: 20px;
      font-weight: 500;
      color: $gray_6;
      margin: 0;
    }
  }
  
  .proposals-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
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
      color: $gray_6;
      margin: 0 0 16px 0;
    }
    
    p {
      font-size: 16px;
      color: $gray_5;
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