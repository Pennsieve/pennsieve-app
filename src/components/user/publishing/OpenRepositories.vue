<script setup>
import { ref, onMounted, computed } from 'vue'
import { useStore } from 'vuex'
import { useProposalStore } from '@/stores/proposalStore'
import RepositoryListItem from './RepositoryListItem.vue'
import ProposalSurvey from './ProposalSurvey.vue'
import RepositoryInfoModal from './RepositoryInfoModal.vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue";

const store = useStore()
const proposalStore = useProposalStore()

const showProposalDialog = ref(false)
const selectedRepository = ref({})
const selectedRepositoryForProposal = ref(null)
const showRepositoryInfo = ref(false)
const selectedRepositoryForInfo = ref({})

const profile = computed(() => store.state.profile)
const repositories = computed(() => proposalStore.repositories)
const isLoading = computed(() => proposalStore.isLoadingRepositories)
const error = computed(() => proposalStore.repositoriesError)

const canSubmitProposal = computed(() => {
  return selectedRepositoryForProposal.value && selectedRepositoryForProposal.value.isPublic
})

const submitButtonText = computed(() => {
  if (selectedRepositoryForProposal.value) {
    return `Propose Dataset to ${selectedRepositoryForProposal.value.displayName}`
  }
  return 'Select a repository to submit dataset proposal'
})

const sortRepositories = (repositories) => {
  return repositories.sort((a, b) => a.displayName.localeCompare(b.displayName, 'en', { numeric: true }))
}

async function fetchRepositories() {
  await proposalStore.fetchRepositories()
}

function handleRepositorySelect(repository) {
  selectedRepositoryForProposal.value = repository
}

function handleSubmitProposal() {
  if (selectedRepositoryForProposal.value) {
    selectedRepository.value = selectedRepositoryForProposal.value
    showProposalDialog.value = true
  }
}

function handleViewInfo(repository) {
  selectedRepositoryForInfo.value = repository
  showRepositoryInfo.value = true
}

function closeProposalDialog() {
  showProposalDialog.value = false
  selectedRepository.value = {}
}

async function createProposal(proposalData) {
  try {
    await proposalStore.storeNewProposal(proposalData, profile.value)
    console.log('Proposal created successfully')
    closeProposalDialog()
    // Show success message or redirect
    // You might want to emit an event or show a notification here
  } catch (err) {
    console.error('Error creating proposal:', err)
    // Handle error - show error message to user
  }
}

async function submitProposal(proposalData) {
  try {
    // First save the proposal as DRAFT
    const response = await proposalStore.storeNewProposal(proposalData, profile.value)
    
    // Get the saved proposal with its nodeId from the response
    if (response?.result?.nodeId) {
      // Now submit the saved proposal
      await proposalStore.submitProposal(response.result)
    }
    
    console.log('Proposal submitted successfully')
    closeProposalDialog()
    // Show success message or redirect
  } catch (err) {
    console.error('Error submitting proposal:', err)
    // Handle error - show error message to user
  }
}

onMounted(() => {
  fetchRepositories()
})
</script>

<template>
  <div class="open-repositories">
    <div class="repositories-header">
      <p class="subtitle">
        The Pennsieve Platform supports several open repositories. You can propose a dataset to one of
        the repositories by following the Dataset Proposal workflow. The publishing team of the corresponding
        repository will evaluate the fit of your dataset for the repository and accept or reject your proposal.
        If your proposal is accepted, you'll receive an invite to upload, curate and submit your dataset for
        publication on the targeted repository.
      </p>
    </div>

    <div class="repositories-content">
      <div v-if="isLoading" class="loading-state">
        <p>Loading repositories...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <button @click="fetchRepositories" class="retry-button">
          Try Again
        </button>
      </div>

      <div v-else-if="repositories.length > 0" class="repositories-section">
        <div class="submit-proposal-section">
          <bf-button
            @click="handleSubmitProposal"
            :disabled="!canSubmitProposal"
            :class="{ disabled: !canSubmitProposal }"
          >
            {{ submitButtonText }}
          </bf-button>
        </div>
        
        <div class="repositories-list">
          <repository-list-item
            v-for="repo in repositories"
            :key="repo.id"
            :repository="repo"
            :selected="selectedRepositoryForProposal?.id === repo.id"
            @select="handleRepositorySelect"
            @view-info="handleViewInfo"
          />
        </div>
      </div>

      <div v-else class="empty-state">
        <p>No repositories available at this time.</p>
      </div>
    </div>

    <!-- Proposal Submission Dialog -->
    <proposal-survey
      :dialog-visible="showProposalDialog"
      :repository="selectedRepository"
      @close="closeProposalDialog"
      @create-proposal="createProposal"
      @submit-proposal="submitProposal"
    />

    <!-- Repository Information Modal -->
    <repository-info-modal
      v-model:dialog-visible="showRepositoryInfo"
      :repository="selectedRepositoryForInfo"
    />
  </div>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.open-repositories {
  margin: 0;
}

.repositories-header {
  text-align: left;
  margin-bottom: 48px;

  h1 {
    font-size: 28px;
    font-weight: 300;
    color: theme.$gray_6;
    margin: 0 0 16px 0;
  }

  .subtitle {
    font-size: 16px;
    color: theme.$gray_5;
    line-height: 1.6;
    max-width: 800px;
    margin: 0;
  }
}

.repositories-content {
  min-height: 200px;
}

.loading-state, .error-state, .empty-state {
  text-align: center;
  padding: 60px 20px;
  color: theme.$gray_5;
}

.error-state {
  .retry-button {
    margin-top: 16px;
    padding: 8px 16px;
    background: theme.$purple_2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    
    &:hover {
      background: theme.$purple_3;
    }
  }
}

.repositories-section {
  .submit-proposal-section {
    margin-bottom: 24px;
    text-align: right;
  }
  
  .submit-proposal-button {
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 500;
    background: theme.$purple_2;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 200px;
    
    &:hover:not(.disabled) {
      background: theme.$purple_3;
      transform: translateY(-1px);
    }
    
    &.disabled {
      background: theme.$gray_3;
      color: theme.$gray_5;
      cursor: not-allowed;
    }
  }
}

.repositories-list {
  background: white;
  border-radius: 4px;
  border: 1px solid theme.$gray_2;
  overflow: hidden;
}
</style>