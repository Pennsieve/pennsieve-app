<script setup>
import { ref, onMounted, computed } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import { useProposalStore } from '@/stores/proposalStore'
import RepositoryListItem from './RepositoryListItem.vue'
import RepositoryInfoModal from './RepositoryInfoModal.vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue";

const store = useStore()
const proposalStore = useProposalStore()
const router = useRouter()

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

// New proposals are all created from the Dataset Proposals page, so hand the
// chosen repository over instead of opening a second copy of the dialog here
function handleSubmitProposal() {
  if (!selectedRepositoryForProposal.value) return
  router.push({
    name: 'dataset-proposals',
    query: {
      openSubmitModal: 'true',
      repositoryId: selectedRepositoryForProposal.value.organizationNodeId
    }
  })
}

function handleViewInfo(repository) {
  selectedRepositoryForInfo.value = repository
  showRepositoryInfo.value = true
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