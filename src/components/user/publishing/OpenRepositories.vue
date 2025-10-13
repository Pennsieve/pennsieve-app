<script setup>
import { ref, onMounted, computed } from 'vue'
import { useStore } from 'vuex'
import { useGetToken } from '@/composables/useGetToken'
import RepositoryListItem from './RepositoryListItem.vue'
import ProposalSurvey from './ProposalSurvey.vue'
import RepositoryInfoModal from './RepositoryInfoModal.vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue";

const store = useStore()

const repositories = ref([])
const isLoading = ref(false)
const error = ref('')
const showProposalDialog = ref(false)
const selectedRepository = ref({})
const selectedRepositoryForProposal = ref(null)
const showRepositoryInfo = ref(false)
const selectedRepositoryForInfo = ref({})

const profile = computed(() => store.state.profile)

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
  isLoading.value = true
  error.value = ''
  
  try {
    const token = await useGetToken()
    const response = await fetch('https://api2.pennsieve.net/publishing/repositories', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })
    
    if (response.ok) {
      const responseJson = await response.json()
      let count = 0
      
      const processedRepositories = responseJson.map((r) => {
        return {
          'id': ++count,
          'isPublic': r.type === "PUBLIC",
          ...r
        }
      })
      
      repositories.value = sortRepositories(processedRepositories)
    } else {
      throw new Error(response.statusText)
    }
  } catch (err) {
    console.error('Failed to fetch repositories:', err)
    error.value = 'Failed to load repositories'
    repositories.value = []
  } finally {
    isLoading.value = false
  }
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
    const token = await useGetToken()
    const response = await fetch('https://api2.pennsieve.net/publishing/proposal', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(proposalData)
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('Proposal created successfully:', result)
      
      // Show success message or redirect
      // You might want to emit an event or show a notification here
      
    } else {
      throw new Error(`Failed to create proposal: ${response.statusText}`)
    }
  } catch (err) {
    console.error('Error creating proposal:', err)
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
    />

    <!-- Repository Information Modal -->
    <repository-info-modal
      v-model:dialog-visible="showRepositoryInfo"
      :repository="selectedRepositoryForInfo"
    />
  </div>
</template>

<style scoped lang="scss">
@import '../../../styles/_theme.scss';

.open-repositories {
  //padding: 40px;
  //max-width: 1000px;
  margin: 0;
}

.repositories-header {
  text-align: left;
  margin-bottom: 48px;

  h1 {
    font-size: 28px;
    font-weight: 300;
    color: $gray_6;
    margin: 0 0 16px 0;
  }

  .subtitle {
    font-size: 16px;
    color: $gray_5;
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
  color: $gray_5;
}

.error-state {
  .retry-button {
    margin-top: 16px;
    padding: 8px 16px;
    background: $purple_2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    
    &:hover {
      background: $purple_3;
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
    background: $purple_2;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 200px;
    
    &:hover:not(.disabled) {
      background: $purple_3;
      transform: translateY(-1px);
    }
    
    &.disabled {
      background: $gray_3;
      color: $gray_5;
      cursor: not-allowed;
    }
  }
}

.repositories-list {
  background: white;
  border-radius: 8px;
  border: 1px solid $gray_2;
  overflow: hidden;
}
</style>