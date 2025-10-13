<script setup>
import { ref, computed, watch } from 'vue'
import { useStore } from 'vuex'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import IconCheck from '@/components/icons/IconCheck.vue'
import IconKitchenTimer from '@/components/icons/IconKitchenTimer.vue'

const props = defineProps({
  dialogVisible: {
    type: Boolean,
    default: false
  },
  repository: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['close', 'create-proposal', 'update:dialogVisible'])

const store = useStore()

const proposal = ref({
  name: '',
  description: '',
  survey: []
})

const profile = computed(() => store.state.profile)

const repositoryQuestions = computed(() => {
  return props.repository?.questions || []
})

const readyToSave = computed(() => {
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
    clearForm()
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

function handleDialogUpdate(visible) {
  // Allow ESC key and explicit close actions
  if (!visible) {
    closeDialog()
  } else {
    emit('update:dialogVisible', visible)
  }
}

function createProposal() {
  if (!readyToSave.value) return

  const surveyResponses = repositoryQuestions.value.map((question, index) => ({
    questionId: question.id,
    response: proposal.value.survey[question.id] || ''
  })).filter(response => response.response.trim())

  const proposalData = {
    name: proposal.value.name,
    description: proposal.value.description,
    organizationNodeId: props.repository.organizationNodeId,
    status: 'DRAFT',
    survey: surveyResponses,
    contributors: [],
    userId: profile.value?.intId,
    ownerName: `${profile.value?.firstName || ''} ${profile.value?.lastName || ''}`.trim()
  }

  emit('create-proposal', proposalData)
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
      :show-close="false"
      class="proposal-dialog"
    >
      <template #header>
<!--        <bf-dialog-header title="Submit Dataset Proposal" />-->
      </template>

      <div class="proposal-content">
        <!-- Repository Header -->
        <div class="repository-header">
          <div class="repo-info">
            <div v-if="repository.logoFile" class="repo-logo">
              <img :src="repository.logoFile" :alt="`${repository.displayName} logo`" />
            </div>
            <div class="repo-details">
              <h2>{{ repository.displayName }}</h2>
              <p class="repo-description" v-if="repository.description">{{ repository.description }}</p>
            </div>
          </div>
<!--          <div class="submission-indicator">-->
<!--            <div class="indicator-icon">📄</div>-->
<!--            <span class="indicator-text">Dataset Proposal</span>-->
<!--          </div>-->
        </div>

        <!-- Progress Indicator -->
        <div class="progress-section">
          <div class="progress-header">
            <h3>Complete your proposal</h3>
            <div class="progress-stats">
              <span class="completed-count">{{ completedFieldsCount }}</span>
              <span class="total-count">/ {{ totalRequiredFields }}</span>
              <span class="progress-label">required fields completed</span>
            </div>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
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
              <p class="field-description">Answer the following questions specific to {{ repository.displayName }}</p>
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
                />
              </div>
            </div>
          </div>
        </el-form>

        <!-- Action Section -->
        <div class="action-section">
          <div class="action-info">
            <div class="completion-status" :class="{ 'ready': readyToSave }">
              <div class="status-icon">
                <IconCheck v-if="readyToSave" :width="20" :height="20" />
                <IconKitchenTimer v-else :width="20" :height="20" />
              </div>
              <div class="status-text">
                <span v-if="readyToSave" class="ready-text">Ready to submit</span>
                <span v-else class="pending-text">Complete all required fields to continue</span>
              </div>
            </div>
          </div>
          
          <div class="action-buttons">
            <bf-button @click="closeDialog" class="secondary">
              Cancel
            </bf-button>
            <bf-button
              class="primary"
              :disabled="!readyToSave"
              @click="createProposal"
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
@import '../../../styles/_theme.scss';

.proposal-content {
  padding: 0;
}

// Repository Header
.repository-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px;
  background: linear-gradient(135deg, lighten($purple_2, 45%) 0%, lighten($purple_2, 50%) 100%);
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
        color: $purple_3;
        font-size: 20px;
        font-weight: 600;
      }

      .repo-description {
        margin: 0;
        color: $gray_5;
        font-size: 14px;
        line-height: 1.4;
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
    border: 1px solid rgba($purple_2, 0.2);

    .indicator-icon {
      font-size: 16px;
    }

    .indicator-text {
      font-size: 12px;
      font-weight: 500;
      color: $purple_3;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }
}

// Progress Section
.progress-section {
  margin-bottom: 32px;

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    h3 {
      margin: 0;
      color: $gray_6;
      font-size: 18px;
      font-weight: 500;
    }

    .progress-stats {
      display: flex;
      align-items: baseline;
      gap: 2px;
      font-size: 14px;

      .completed-count {
        font-size: 20px;
        font-weight: 600;
        color: $purple_3;
      }

      .total-count {
        color: $gray_4;
        font-weight: 500;
      }

      .progress-label {
        color: $gray_5;
        margin-left: 6px;
      }
    }
  }

  .progress-bar {
    height: 8px;
    background: $gray_1;
    border-radius: 4px;
    overflow: hidden;

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, $purple_2 0%, lighten($purple_2, 10%) 100%);
      transition: width 0.3s ease;
      border-radius: 4px;
    }
  }
}

// Form Sections
.proposal-form {
  .form-section {
    margin-bottom: 32px;
    border: 1px solid $gray_2;
    border-radius: 3px;
    overflow: hidden;
    transition: all 0.2s ease;

    &:hover {
      border-color: $purple_2;
      box-shadow: 0 2px 8px rgba($purple_2, 0.1);
    }

    .section-header {
      padding: 16px 20px;
      background: $gray_1;
      border-bottom: 1px solid $gray_2;

      h4 {
        margin: 0 0 4px 0;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 600;
        color: $gray_6;

        .field-number {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: $purple_2;
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
        color: $gray_5;
        font-size: 14px;
        line-height: 1.4;
      }
    }

    .form-field {
      padding: 20px;

      :deep(.el-input) {
        &.field-completed .el-input__wrapper {
          border-color: $green_2;
          box-shadow: 0 0 0 1px rgba($green_2, 0.2);
        }
      }

      :deep(.el-textarea) {
        &.field-completed .el-textarea__inner {
          border-color: $green_2;
          box-shadow: 0 0 0 1px rgba($green_2, 0.2);
        }
      }
    }

    &.field-completed {
      border-color: $green_2;
      background: rgba($green_2, 0.02);
    }
  }
}

// Description Field Specific
.description-field {
  .markdown-container {
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid $gray_2;

    &.field-completed {
      border: 1px solid $green_2;
    }

    .markdown-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: $gray_1;
      border-bottom: 1px solid $gray_2;

      .header-left {
        .completion-badge {
          color: $green_2;
          font-size: 14px;
          font-weight: 500;
        }

        .editing-badge {
          color: $purple_3;
          font-size: 14px;
          font-weight: 500;
        }

        .empty-badge {
          color: $gray_5;
          font-size: 14px;
        }
      }

      .header-actions {
        .edit-button {
          background: none;
          border: none;
          color: $purple_2;
          cursor: pointer;
          font-size: 14px;
          padding: 4px 8px;
          border-radius: 4px;
          transition: all 0.2s ease;

          &:hover {
            background: $purple_2;
            color: white;
          }
        }

        .edit-actions {
          display: flex;
          gap: 8px;

          .save-button {
            background: $green_2;
            color: white;
            border: none;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
              background: darken($green_2, 10%);
            }
          }

          .cancel-button {
            background: none;
            border: 1px solid $gray_3;
            color: $gray_5;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
              background: $gray_1;
              border-color: $gray_4;
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
      border-color: $purple_2;
    }

    &.field-completed {
      border-color: $green_2;
      background: rgba($green_2, 0.02);
    }

    .question-header {
      margin-bottom: 8px;

      .question-label {
        font-size: 14px;
        font-weight: 500;
        color: $gray_6;
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
  padding: 24px 0;
  border-top: 1px solid $gray_2;
  margin-top: 32px;

  .action-info {
    .completion-status {
      display: flex;
      align-items: center;
      gap: 12px;

      .status-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: $purple_1;
      }

      .status-text {
        .ready-text {
          color: $green_2;
          font-weight: 500;
        }

        .pending-text {
          color: $gray_5;
        }
      }

      &.ready {
        .status-text {
          color: $green_2;
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
</style>