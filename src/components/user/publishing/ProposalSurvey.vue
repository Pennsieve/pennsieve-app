<script setup>
import { ref, computed, watch } from 'vue'
import { useStore } from 'vuex'
import { useProposalStore } from '@/stores/proposalStore'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import IconCheck from '@/components/icons/IconCheck.vue'
import IconKitchenTimer from '@/components/icons/IconKitchenTimer.vue'
import BfDialogHeader from "@/components/shared/bf-dialog-header/BfDialogHeader.vue";

const props = defineProps({
  dialogVisible: {
    type: Boolean,
    default: false
  },
  repository: {
    type: Object,
    default: () => ({})
  },
  proposal: {
    type: Object,
    default: () => null
  },
  readOnly: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'create-proposal', 'submit-proposal', 'recreate-proposal', 'recreate-and-submit-proposal', 'update:dialogVisible'])

const store = useStore()
const proposalStore = useProposalStore()

const proposal = ref({
  name: '',
  description: '',
  survey: []
})

const selectedRepository = ref({})
const surveyAnswersByRepository = ref({})

const profile = computed(() => store.state.profile)
const availableRepositories = computed(() => proposalStore.repositories)

const currentRepository = computed(() => selectedRepository.value.organizationNodeId ? selectedRepository.value : props.repository)

const repositoryQuestions = computed(() => {
  return currentRepository.value?.questions || []
})

const readyToSave = computed(() => {
  // For updating existing proposals, allow saving even if incomplete
  if (props.proposal) {
    return true
  }
  // For new proposals, require name and description
  return proposal.value.name && proposal.value.description
})

const readyToSubmit = computed(() => {
  // Require all fields including all questions for submission
  return proposal.value.name && 
         proposal.value.description && 
         allRepoQuestionsAnswered.value
})

const allRepoQuestionsAnswered = computed(() => {
  if (!repositoryQuestions.value.length) return true
  
  const answered = repositoryQuestions.value.filter(question => {
    return proposal.value.survey[question.id] && 
           proposal.value.survey[question.id].trim()
  })
  
  return answered.length === repositoryQuestions.value.length
})

const completedFieldsCount = computed(() => {
  let count = 0
  if (proposal.value.name) count++
  if (proposal.value.description) count++
  
  const answeredQuestions = repositoryQuestions.value.filter(question => {
    return proposal.value.survey[question.id] && 
           proposal.value.survey[question.id].trim()
  }).length
  
  count += answeredQuestions
  return count
})

const totalRequiredFields = computed(() => {
  return 2 + repositoryQuestions.value.length // name + description + questions
})

const progressPercentage = computed(() => {
  if (totalRequiredFields.value === 0) return 100
  return Math.round((completedFieldsCount.value / totalRequiredFields.value) * 100)
})

watch(() => props.dialogVisible, (newVal) => {
  if (newVal) {
    populateForm()
    initializeSelectedRepository()
  }
})

// Watch for repository changes and save/restore survey responses
watch(() => selectedRepository.value.organizationNodeId, (newNodeId, oldNodeId) => {
  if (oldNodeId && newNodeId !== oldNodeId) {
    // Save current survey answers before switching
    if (oldNodeId) {
      surveyAnswersByRepository.value[oldNodeId] = { ...proposal.value.survey }
    }
    
    // Update the proposal's organizationNodeId to match the new repository
    if (newNodeId) {
      // This ensures the proposal will be saved to the correct repository
      proposal.value.organizationNodeId = newNodeId
    }
    
    // Restore saved answers for the new repository, or start with blank answers
    if (newNodeId && surveyAnswersByRepository.value[newNodeId]) {
      proposal.value.survey = { ...surveyAnswersByRepository.value[newNodeId] }
    } else {
      proposal.value.survey = {}
    }
  }
})

function closeDialog() {
  clearForm()
  emit('close')
}

function clearForm() {
  proposal.value = {
    name: '',
    description: '',
    survey: []
  }
}

function initializeSelectedRepository() {
  // Set the initial repository from props
  selectedRepository.value = props.repository || {}
  
  // If editing an existing proposal, store its survey answers for the current repository
  if (props.proposal && props.repository?.organizationNodeId && proposal.value.survey) {
    surveyAnswersByRepository.value[props.repository.organizationNodeId] = { ...proposal.value.survey }
  }
}

function populateForm() {
  if (props.proposal) {
    // Editing existing proposal - populate with existing data
    proposal.value = {
      name: props.proposal.name || '',
      description: props.proposal.description || '',
      survey: {}
    }
    
    // Convert survey array to object format for the form
    if (props.proposal.survey && Array.isArray(props.proposal.survey)) {
      const surveyObject = {}
      props.proposal.survey.forEach(item => {
        if (item.questionId !== undefined && item.response) {
          surveyObject[item.questionId] = item.response
        }
      })
      proposal.value.survey = surveyObject
    }
  } else {
    // New proposal - clear form
    clearForm()
  }
}

function handleRepositoryChange(repository) {
  selectedRepository.value = repository
}

function handleDialogUpdate(visible) {
  // Allow ESC key and explicit close actions
  if (!visible) {
    closeDialog()
  } else {
    emit('update:dialogVisible', visible)
  }
}

function saveProposal() {
  if (!readyToSave.value) return

  const surveyResponses = repositoryQuestions.value.map((question) => ({
    questionId: question.id,
    response: proposal.value.survey[question.id] || ''
  })).filter(response => response.response.trim())

  const proposalData = {
    name: proposal.value.name,
    description: proposal.value.description,
    organizationNodeId: currentRepository.value.organizationNodeId,
    status: 'DRAFT',
    survey: surveyResponses,
    contributors: [],
    userId: profile.value?.intId,
    ownerName: `${profile.value?.firstName || ''} ${profile.value?.lastName || ''}`.trim()
  }

  // Check if this is an existing proposal and if the repository has changed
  const isExistingProposal = props.proposal && props.proposal.nodeId
  const hasRepositoryChanged = isExistingProposal && 
    props.proposal.organizationNodeId !== currentRepository.value.organizationNodeId

  if (hasRepositoryChanged) {
    // Repository changed - need to delete old proposal and create new one
    proposalData._originalProposal = props.proposal // Pass original for deletion
    proposalData._requiresRecreation = true
    emit('recreate-proposal', proposalData)
  } else if (isExistingProposal) {
    // Same repository - normal update
    proposalData.id = props.proposal.id
    proposalData.nodeId = props.proposal.nodeId
    proposalData.datasetNodeId = props.proposal.datasetNodeId
    proposalData.createdAt = props.proposal.createdAt
    proposalData.updatedAt = props.proposal.updatedAt
    emit('create-proposal', proposalData)
  } else {
    // New proposal - normal creation
    emit('create-proposal', proposalData)
  }

  closeDialog()
}

function submitProposal() {
  if (!readyToSubmit.value) return

  const surveyResponses = repositoryQuestions.value.map((question) => ({
    questionId: question.id,
    response: proposal.value.survey[question.id] || ''
  })).filter(response => response.response.trim())

  const proposalData = {
    name: proposal.value.name,
    description: proposal.value.description,
    organizationNodeId: currentRepository.value.organizationNodeId,
    status: 'DRAFT',
    survey: surveyResponses,
    contributors: [],
    userId: profile.value?.intId,
    ownerName: `${profile.value?.firstName || ''} ${profile.value?.lastName || ''}`.trim()
  }

  // Check if this is an existing proposal and if the repository has changed
  const isExistingProposal = props.proposal && props.proposal.nodeId
  const hasRepositoryChanged = isExistingProposal && 
    props.proposal.organizationNodeId !== currentRepository.value.organizationNodeId

  if (hasRepositoryChanged) {
    // Repository changed - need to delete old proposal and create new one, then submit
    proposalData._originalProposal = props.proposal // Pass original for deletion
    proposalData._requiresRecreation = true
    emit('recreate-and-submit-proposal', proposalData)
  } else if (isExistingProposal) {
    // Same repository - normal update then submit
    proposalData.id = props.proposal.id
    proposalData.nodeId = props.proposal.nodeId
    proposalData.datasetNodeId = props.proposal.datasetNodeId
    proposalData.createdAt = props.proposal.createdAt
    proposalData.updatedAt = props.proposal.updatedAt
    emit('submit-proposal', proposalData)
  } else {
    // New proposal - create and submit
    emit('submit-proposal', proposalData)
  }

  closeDialog()
}
</script>

<template>
  <div>
    <el-dialog
      :modelValue="dialogVisible"
      @update:modelValue="handleDialogUpdate"
      width="90%"
      :max-width="900"
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      :show-close="true"
      class="proposal-dialog"
    >
      <template #header>
        <bf-dialog-header title="Submit Dataset Proposal" class="dialog-header" />
      </template>

      <div class="proposal-content">





        
        <!-- Read-only Close Button -->
        <div class="read-only-actions" v-if="readOnly">
          <bf-button @click="closeDialog" class="primary">
            Close
          </bf-button>
        </div>

        <!-- Progress Indicator -->
        <div class="progress-section" v-if="!readOnly">
          <div class="progress-info">
            <span class="progress-text">{{ completedFieldsCount }}/{{ totalRequiredFields }} fields completed</span>
            <span class="progress-percentage">{{ progressPercentage }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
          </div>
        </div>

        <!-- Repository Header -->
        <div class="repository-header">
          <div class="repo-info">
            <!-- Read-only indicator -->
            <div v-if="readOnly" class="read-only-tag">
              <span>Read Only</span>
            </div>
            <div v-if="currentRepository.logoFile" class="repo-logo">
              <img :src="currentRepository.logoFile" :alt="`${currentRepository.displayName} logo`" />
            </div>
            <div class="repo-details">
              <h2>{{ currentRepository.displayName }}</h2>
              <p class="repo-description" v-if="currentRepository.description">{{ currentRepository.description }}</p>
            </div>
          </div>

          <!-- Repository Selector -->
          <div class="repository-selector" v-if="!readOnly">
            <label class="selector-label">Submitting to:</label>
            <el-select
              v-model="selectedRepository"
              placeholder="Select repository"
              class="repository-dropdown"
              @change="handleRepositoryChange"
              value-key="organizationNodeId"
              size="large"
            >
              <el-option
                v-for="repo in availableRepositories"
                :key="repo.organizationNodeId"
                :label="repo.displayName"
                :value="repo"
                class="repository-option"
              >
                <div class="repository-option-content">
                  <img
                    v-if="repo.logoFile"
                    :src="repo.logoFile"
                    :alt="`${repo.displayName} logo`"
                    class="option-logo"
                  />
                  <div class="option-details">
                    <span class="option-name">{{ repo.displayName }}</span>
                  </div>
                </div>
              </el-option>
            </el-select>
          </div>
        </div>

        <!-- Form Content -->
        <el-form id="proposal-request-survey" :model="proposal" class="proposal-form">
          
          <!-- Dataset Name -->
          <div class="form-section">
            <div class="section-header">
              <h4>
                <span class="field-number">1</span>
                Dataset Name
                <span class="required-indicator">*</span>
              </h4>
              <p class="field-description">Provide a clear, descriptive name for your dataset</p>
            </div>
            <div class="form-field">
              <el-input 
                v-model="proposal.name" 
                placeholder="e.g., Neural Activity in Visual Cortex During Object Recognition"
                size="large"
                :class="{ 'field-completed': proposal.name }"
                :readonly="readOnly"
              />
            </div>
          </div>

          <!-- Dataset Description -->
          <div class="form-section">
            <div class="section-header">
              <h4>
                <span class="field-number">2</span>
                Dataset Description
                <span class="required-indicator">*</span>
              </h4>
              <p class="field-description">Provide a detailed description of your dataset including methodology, objectives, and relevance</p>
            </div>
            <div class="form-field">
              <el-input
                v-model="proposal.description"
                type="textarea"
                :rows="8"
                placeholder="Provide a detailed description of your dataset including methodology, objectives, and relevance to the repository..."
                size="large"
                :class="{ 'field-completed': proposal.description }"
                :readonly="readOnly"
              />
            </div>
          </div>

          <!-- Repository-specific Questions -->
          <div class="form-section" v-if="repositoryQuestions.length > 0">
            <div class="section-header">
              <h4>
                <span class="field-number">3</span>
                Repository Requirements
                <span class="required-indicator">*</span>
              </h4>
              <p class="field-description">Answer the following questions specific to {{ currentRepository.displayName }}</p>
            </div>
            
            <div class="questions-grid">
              <div 
                v-for="(question, index) in repositoryQuestions" 
                :key="question.id"
                class="question-item"
                :class="{ 'field-completed': proposal.survey[question.id] }"
              >
                <div class="question-header">
                  <label class="question-label">
                    {{ question.question }}
                    <span class="required-indicator">*</span>
                  </label>
                </div>
                <el-input
                  v-model="proposal.survey[question.id]"
                  type="textarea"
                  :rows="3"
                  :placeholder="`Please provide your answer...`"
                  size="large"
                  :readonly="readOnly"
                />
              </div>
            </div>
          </div>
        </el-form>

        <!-- Action Section -->
        <div class="action-section" v-if="!readOnly">
          <div class="action-info">
            <div class="completion-status" :class="{ 'ready': readyToSave }">
              <div class="status-icon">
                <IconCheck v-if="readyToSave" :width="20" :height="20" />
                <IconKitchenTimer v-else :width="20" :height="20" />
              </div>
              <div class="status-text">
                <span v-if="readyToSubmit" class="ready-text">Ready to submit</span>
                <span v-else-if="readyToSave" class="ready-text">Ready to save draft</span>
                <span v-else class="pending-text">Complete all required fields to continue</span>
              </div>
            </div>
          </div>

          <div class="action-buttons">
            <bf-button @click="closeDialog" class="secondary">
              Cancel
            </bf-button>
            <bf-button
              class="secondary"
              :disabled="!readyToSave"
              @click="saveProposal"
            >
              {{ props.proposal ? 'Update Proposal' : 'Save Proposal' }}
            </bf-button>
            <bf-button
              class="primary"
              :disabled="!readyToSubmit"
              @click="submitProposal"
            >
              Submit Proposal
            </bf-button>
          </div>
        </div>


      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.proposal-content {
  padding: 0;
}

.dialog-header {
  margin: 0 0 24px 0;
}

// Repository Header
.repository-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px;
  background: linear-gradient(135deg, lighten(theme.$purple_2, 45%) 0%, lighten(theme.$purple_2, 50%) 100%);
  margin-bottom: 24px;

  .repo-info {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;

    .repo-logo {
      img {
        height: 48px;
        width: auto;
        max-width: 120px;
        object-fit: contain;
        border-radius: 4px;
      }
    }

    .repo-details {
      h2 {
        margin: 0 0 4px 0;
        color: theme.$purple_3;
        font-size: 20px;
        font-weight: 600;
      }

      .repo-description {
        margin: 0;
        color: theme.$gray_5;
        font-size: 14px;
        line-height: 1.4;
      }
    }
  }

  .repository-selector {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    min-width: 280px;

    .selector-label {
      font-size: 12px;
      font-weight: 500;
      color: theme.$purple_3;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .repository-dropdown {
      width: 100%;
      
      :deep(.el-select__wrapper) {
        background: rgba(white, 0.95);
        border: 1px solid rgba(theme.$purple_2, 0.3);
        border-radius: 6px;
        transition: all 0.2s ease;

        &:hover {
          border-color: theme.$purple_2;
          box-shadow: 0 2px 8px rgba(theme.$purple_2, 0.1);
        }

        .el-select__placeholder {
          color: theme.$gray_4;
        }
      }
    }
  }

  .submission-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(white, 0.8);
    border-radius: 6px;
    border: 1px solid rgba(theme.$purple_2, 0.2);

    .indicator-icon {
      font-size: 16px;
    }

    .indicator-text {
      font-size: 12px;
      font-weight: 500;
      color: theme.$purple_3;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }
}

// Progress Section
.progress-section {
  margin-bottom: 20px;

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    .progress-text {
      font-size: 14px;
      color: theme.$gray_5;
      font-weight: 500;
    }

    .progress-percentage {
      font-size: 14px;
      font-weight: 600;
      color: theme.$purple_3;
    }
  }

  .progress-bar {
    height: 6px;
    background: theme.$gray_1;
    border-radius: 3px;
    overflow: hidden;

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, theme.$purple_2 0%, lighten(theme.$purple_2, 10%) 100%);
      transition: width 0.3s ease;
      border-radius: 3px;
    }
  }
}

// Form Sections
.proposal-form {
  .form-section {
    margin-bottom: 32px;
    border: 1px solid theme.$gray_2;
    border-radius: 3px;
    overflow: hidden;
    transition: all 0.2s ease;

    &:hover {
      border-color: theme.$purple_2;
      box-shadow: 0 2px 8px rgba(theme.$purple_2, 0.1);
    }

    .section-header {
      padding: 16px 20px;
      background: theme.$gray_1;
      border-bottom: 1px solid theme.$gray_2;

      h4 {
        margin: 0 0 4px 0;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 600;
        color: theme.$gray_6;

        .field-number {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: theme.$purple_2;
          color: white;
          border-radius: 50%;
          font-size: 12px;
          font-weight: 600;
        }

        .required-indicator {
          color: #e74c3c;
          font-weight: 700;
        }
      }

      .field-description {
        margin: 0;
        color: theme.$gray_5;
        font-size: 14px;
        line-height: 1.4;
      }
    }

    .form-field {
      padding: 20px;

      :deep(.el-input) {
        &.field-completed .el-input__wrapper {
          border-color: theme.$green_2;
          box-shadow: 0 0 0 1px rgba(theme.$green_2, 0.2);
        }
      }

      :deep(.el-textarea) {
        &.field-completed .el-textarea__inner {
          border-color: theme.$green_2;
          box-shadow: 0 0 0 1px rgba(theme.$green_2, 0.2);
        }
      }
    }

    &.field-completed {
      border-color: theme.$green_2;
      background: rgba(theme.$green_2, 0.02);
    }
  }
}

// Description Field Specific
.description-field {
  .markdown-container {
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid theme.$gray_2;

    &.field-completed {
      border: 1px solid theme.$green_2;
    }

    .markdown-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: theme.$gray_1;
      border-bottom: 1px solid theme.$gray_2;

      .header-left {
        .completion-badge {
          color: theme.$green_2;
          font-size: 14px;
          font-weight: 500;
        }

        .editing-badge {
          color: theme.$purple_3;
          font-size: 14px;
          font-weight: 500;
        }

        .empty-badge {
          color: theme.$gray_5;
          font-size: 14px;
        }
      }

      .header-actions {
        .edit-button {
          background: none;
          border: none;
          color: theme.$purple_2;
          cursor: pointer;
          font-size: 14px;
          padding: 4px 8px;
          border-radius: 4px;
          transition: all 0.2s ease;

          &:hover {
            background: theme.$purple_2;
            color: white;
          }
        }

        .edit-actions {
          display: flex;
          gap: 8px;

          .save-button {
            background: theme.$green_2;
            color: white;
            border: none;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
              background: darken(theme.$green_2, 10%);
            }
          }

          .cancel-button {
            background: none;
            border: 1px solid theme.$gray_3;
            color: theme.$gray_5;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
              background: theme.$gray_1;
              border-color: theme.$gray_4;
            }
          }
        }
      }
    }
  }
}

// Questions Grid
.questions-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .question-item {
    padding: 16px;
    //border: 1px solid $gray_2;
    //border-radius: 6px;
    transition: all 0.2s ease;

    &:hover {
      border-color: theme.$purple_2;
    }

    &.field-completed {
      border-color: theme.$green_2;
      background: rgba(theme.$green_2, 0.02);
    }

    .question-header {
      margin-bottom: 8px;

      .question-label {
        font-size: 14px;
        font-weight: 500;
        color: theme.$gray_6;
        display: block;

        .required-indicator {
          color: #e74c3c;
          margin-left: 4px;
        }
      }
    }
  }
}

// Action Section
.action-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 24px 0;
  margin-top: 16px;

  .action-info {
    .completion-status {
      display: flex;
      align-items: center;
      gap: 12px;

      .status-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: theme.$purple_1;
      }

      .status-text {
        .ready-text {
          color: theme.$green_2;
          font-weight: 500;
        }

        .pending-text {
          color: theme.$gray_5;
        }
      }

      &.ready {
        .status-text {
          color: theme.$green_2;
        }
      }
    }
  }

  .action-buttons {
    display: flex;
    gap: 12px;
  }
}

// Dialog Overrides
:deep(.el-dialog) {
  border-radius: 12px;
  max-height: 90vh;
  overflow: hidden;
}

:deep(.el-dialog__header) {
  padding: 20px 24px 0;
  position: relative;
}

:deep(.el-dialog__body) {
  padding: 0 24px 24px;
  max-height: calc(90vh - 120px);
  overflow-y: auto;
}

:deep(.el-input__wrapper) {
  border-radius: 6px;
  transition: all 0.2s ease;
}

:deep(.el-textarea__inner) {
  border-radius: 6px;
  transition: all 0.2s ease;
}

// Repository Option Content Styling (scoped to component)
.repository-option-content {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  padding: 8px 12px;
  width: 100%;
  
  .option-logo {
    height: 18px;
    width: auto;
    max-width: 40px;
    object-fit: contain;
    border-radius: 2px;
    flex-shrink: 0;
    display: block;
  }
  
  .option-details {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    flex: 1;
    min-width: 0;
    
    .option-name {
      font-size: 14px;
      font-weight: 500;
      color: theme.$gray_6;
      line-height: 1.3;
      text-align: left;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }
  }
}

// Responsive Design
@media (max-width: 768px) {
  .repository-header {
    flex-direction: column;
    gap: 16px;
    text-align: center;

    .repo-info {
      flex-direction: column;
      text-align: center;
    }
    
    .repository-selector {
      align-items: center;
      min-width: auto;
      width: 100%;
    }
  }

  .progress-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .action-section {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
}

// Read-only specific styles
.read-only-tag {
  position: absolute;
  top: 20px;
  left: 24px;
  z-index: 10;
  
  span {
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    background: rgba(theme.$orange_1, 0.1);
    color: theme.$orange_1;
    border: 1px solid rgba(theme.$orange_1, 0.3);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.read-only-actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 0 24px 0;
  margin-top: 24px;
}

</style>