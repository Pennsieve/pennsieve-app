<template>
  <div class="dataset-proposals">
    <div class="page-header">
      <div class="header-row">
        <p class="page-intro">
          Propose your datasets to open repositories and follow them through review.
        </p>
        <bf-button class="primary" @click="startNewProposal">
          <template #prefix>
            <IconPlus :width="14" :height="14" color="currentColor" />
          </template>
          New Proposal
        </bf-button>
      </div>

      <ul class="workflow-steps">
        <li v-for="step in workflowSteps" :key="step.title" class="workflow-step">
          <span class="step-icon">
            <component :is="step.icon" :width="20" :height="20" color="currentColor" />
          </span>
          <div class="step-text">
            <h3 class="step-title">{{ step.title }}</h3>
            <p class="step-description">{{ step.description }}</p>
          </div>
        </li>
      </ul>
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
            You haven't created any dataset proposals yet. Click <strong>New Proposal</strong> to submit
            a dataset to an open repository for review and publication.
          </p>
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
import { ref, shallowRef, computed, onMounted, watch } from 'vue'
import { useStore } from 'vuex'
import { useRoute, useRouter } from 'vue-router'
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
import IconPlus from '@/components/icons/IconPlus.vue'
import IconPencil from '@/components/icons/IconPencil.vue'
import IconEyeball from '@/components/icons/IconEyeball.vue'
import { useProposalSave } from '@/composables/useProposalSave'
import { getProposalErrorMessage, isStaleProposalError } from '@/utils/proposalErrorMessages'

const store = useStore()
const proposalStore = useProposalStore()
const router = useRouter()
const route = useRoute()
const { isSavingProposal, saveProposal } = useProposalSave()

// Static content; icons are components so they're kept out of reactivity
const workflowSteps = [
  {
    icon: IconPlus,
    title: 'Propose a dataset',
    description: 'Start a new proposal and choose the open repository it should go to.',
  },
  {
    icon: IconPencil,
    title: 'Edit drafts',
    description: 'Drafts stay editable until you submit them for review.',
  },
  {
    icon: IconEyeball,
    title: 'Track status',
    description: 'Follow each proposal from submission through acceptance.',
  },
]

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

const copyProposalToDraft = (sourceProposal) => {
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
  const { openSubmitModal, repositoryId, repositoryName } = route.query
  
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
      
      // Drop the query so a refresh doesn't reopen the dialog
      router.replace({ query: {} })
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
  width: 100%;
  margin: 0;
}

.page-header {
  margin-bottom: 40px;

  .header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 24px;
  }

  .page-intro {
    font-size: 18px;
    color: theme.$gray_6;
    line-height: 1.5;
    margin: 0;
  }
}

.workflow-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.workflow-step {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 8px;

  .step-icon {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: theme.$purple_tint;
    color: theme.$purple_3;
  }

  .step-title {
    font-size: 15px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 4px 0;
  }

  .step-description {
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;
    margin: 0;
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
  
  .page-header .header-row {
    flex-direction: column;
    align-items: flex-start;
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