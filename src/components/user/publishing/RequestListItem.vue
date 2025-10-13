<template>
  <div class="request-list-item" :class="{ 'is-clickable': isEditable }" @click="handleItemClick">
    <div class="request-content">
      <!-- Left side: Main content -->
      <div class="request-info">
        <!-- Status badge and repository name -->
        <div class="request-header">
          <span class="request-status" :class="statusClass">
            {{ statusDisplay }}
          </span>
          <span class="request-repository">
            {{ repositoryName }}
          </span>
        </div>
        
        <!-- Proposal name -->
        <h3 class="request-title">
          {{ datasetRequest.name || 'Untitled Proposal' }}
        </h3>
        
        <!-- Description preview -->
        <p class="request-description" v-if="datasetRequest.description">
          {{ truncatedDescription }}
        </p>
        
        <!-- Metadata row -->
        <div class="request-metadata">
          <span class="metadata-item" v-if="datasetRequest.updatedAt">
            Last updated: {{ formatDate(datasetRequest.updatedAt) }}
          </span>
          <span class="metadata-item" v-if="!readyToSubmit && isDraft">
            <IconWarningCircle :width="14" :height="14" class="warning-icon" />
            Incomplete proposal
          </span>
        </div>
      </div>
      
      <!-- Right side: Actions and logo -->
      <div class="request-actions">
        <!-- Repository logo -->
        <div class="repository-logo" v-if="logoPath">
          <img
            :src="logoPath"
            :alt="`${repositoryName} logo`"
            class="logo"
          />
        </div>
        
        <!-- Action buttons -->
        <div class="action-buttons">
          <!-- Draft actions -->
          <template v-if="isDraft">
            <bf-button 
              v-if="readyToSubmit"
              class="primary small"
              @click.stop="triggerRequest(DatasetProposalAction.SUBMIT)"
            >
              Submit Proposal
            </bf-button>
            <bf-button 
              v-else
              class="secondary small"
              @click.stop="triggerRequest(DatasetProposalAction.EDIT)"
            >
              Complete Proposal
            </bf-button>
            <button 
              class="text-button danger"
              @click.stop="triggerRequest(DatasetProposalAction.REMOVE)"
            >
              Remove
            </button>
          </template>
          
          <!-- Submitted actions -->
          <template v-else-if="isSubmitted">
            <div class="status-message">
              Under Review
            </div>
            <button 
              class="text-button"
              @click.stop="triggerRequest(DatasetProposalAction.WITHDRAW)"
            >
              Withdraw Proposal
            </button>
          </template>
          
          <!-- Accepted actions -->
          <template v-else-if="isAccepted">
            <bf-button 
              class="primary small"
              @click.stop="triggerRequest(DatasetProposalAction.OPEN_DATASET)"
            >
              Open Dataset
            </bf-button>
            <div class="status-message success">
              <IconCheck :width="16" :height="16" class="status-icon" />
              Accepted
            </div>
          </template>
          
          <!-- Rejected actions -->
          <template v-else-if="isRejected">
            <bf-button 
              class="secondary small"
              @click.stop="triggerRequest(DatasetProposalAction.RESUBMIT)"
            >
              Resubmit to Another Repository
            </bf-button>
            <div class="status-message error">
              <IconXCircle :width="16" :height="16" class="status-icon" />
              Not Accepted
            </div>
          </template>
          
          <!-- Withdrawn actions -->
          <template v-else-if="isWithdrawn">
            <bf-button 
              class="secondary small"
              @click.stop="triggerRequest(DatasetProposalAction.EDIT)"
            >
              Edit & Resubmit
            </bf-button>
            <div class="status-message">
              Withdrawn
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapActions, mapGetters } from 'vuex'
import FormatDate from '../../../mixins/format-date'
import { DatasetProposalAction } from '../../../utils/constants'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import IconWarningCircle from '@/components/icons/IconWarningCircle.vue'
import IconCheck from '@/components/icons/IconCheck.vue'
import IconXCircle from '@/components/icons/IconXCircle.vue'

export default {
  name: 'RequestListItem',

  components: {
    BfButton,
    IconWarningCircle,
    IconCheck,
    IconXCircle
  },

  mixins: [FormatDate],

  props: {
    datasetRequest: {
      type: Object,
      default: () => ({})
    }
  },

  computed: {
    ...mapGetters('repositoryModule', ['getRepositoryByNodeId']),
    
    repository() {
      if (this.datasetRequest) {
        return this.getRepositoryByNodeId(this.datasetRequest.organizationNodeId)
      }
      return null
    },
    
    repositoryName() {
      return this.repository?.displayName || 'Unknown Repository'
    },
    
    logoPath() {
      return this.repository?.logoFile || ''
    },
    
    statusDisplay() {
      const statusMap = {
        'DRAFT': 'Draft',
        'SUBMITTED': 'Submitted',
        'ACCEPTED': 'Accepted',
        'REJECTED': 'Rejected',
        'WITHDRAWN': 'Withdrawn'
      }
      return statusMap[this.datasetRequest.proposalStatus] || this.datasetRequest.proposalStatus
    },
    
    statusClass() {
      const status = this.datasetRequest.proposalStatus?.toLowerCase()
      return `status-${status}`
    },
    
    isDraft() {
      return this.datasetRequest.proposalStatus === 'DRAFT'
    },
    
    isSubmitted() {
      return this.datasetRequest.proposalStatus === 'SUBMITTED'
    },
    
    isAccepted() {
      return this.datasetRequest.proposalStatus === 'ACCEPTED'
    },
    
    isRejected() {
      return this.datasetRequest.proposalStatus === 'REJECTED'
    },
    
    isWithdrawn() {
      return this.datasetRequest.proposalStatus === 'WITHDRAWN'
    },
    
    isEditable() {
      return this.isDraft || this.isWithdrawn
    },
    
    truncatedDescription() {
      const desc = this.datasetRequest.description || ''
      return desc.length > 200 ? desc.substring(0, 200) + '...' : desc
    },
    
    readyToSubmit() {
      const validName = this.datasetRequest.name !== null && this.datasetRequest.name !== ''
      const validDescription = this.datasetRequest.description !== null && this.datasetRequest.description !== ''
      const surveyCompleted = this.surveyComplete()
      return validName && validDescription && surveyCompleted
    },
    
    DatasetProposalAction() {
      return DatasetProposalAction
    }
  },

  methods: {
    ...mapActions('repositoryModule', [
      'updateRequestModalVisible',
      'setRepositoryDescription'
    ]),
    
    handleItemClick() {
      if (this.isEditable) {
        this.triggerRequest(DatasetProposalAction.EDIT)
      }
    },
    
    surveyComplete() {
      let result = false
      const organizationNodeId = this.datasetRequest.organizationNodeId
      const repository = this.getRepositoryByNodeId(organizationNodeId)
      
      if (repository && repository.questions != null && this.datasetRequest && this.datasetRequest.survey != null) {
        result = repository.questions.map(q => {
          const answer = this.datasetRequest.survey.find(r => r.questionId === q.id)
          return answer && answer.response !== ''
        }).reduce((a, c) => a && c, true)
      }
      return result
    },
    
    triggerRequest(action) {
      this.$emit(action, this.datasetRequest)
    },
    
    formatDate(dateString) {
      if (!dateString) return ''
      const date = new Date(dateString)
      const options = { year: 'numeric', month: 'short', day: 'numeric' }
      return date.toLocaleDateString('en-US', options)
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.request-list-item {
  background: white;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  margin-bottom: 16px;
  transition: all 0.2s ease;
  
  &.is-clickable {
    cursor: pointer;
    
    &:hover {
      border-color: theme.$purple_2;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
  }
}

.request-content {
  display: flex;
  justify-content: space-between;
  padding: 20px;
  gap: 24px;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
}

.request-info {
  flex: 1;
  min-width: 0; // Allow text truncation
}

.request-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.request-status {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  &.status-draft {
    background: theme.$gray_2;
    color: theme.$gray_6;
  }
  
  &.status-submitted {
    background: lighten(theme.$purple_2, 35%);
    color: theme.$purple_2;
  }
  
  &.status-accepted {
    background: lighten(theme.$green_1, 45%);
    color: darken(theme.$green_1, 10%);
  }
  
  &.status-rejected {
    background: lighten(theme.$red_1, 35%);
    color: theme.$red_1;
  }
  
  &.status-withdrawn {
    background: lighten(theme.$orange_1, 35%);
    color: darken(theme.$orange_1, 10%);
  }
}

.request-repository {
  font-size: 13px;
  color: theme.$gray_5;
  font-weight: 500;
}

.request-title {
  font-size: 18px;
  font-weight: 500;
  color: theme.$gray_6;
  margin: 0 0 8px 0;
  line-height: 1.3;
}

.request-description {
  font-size: 14px;
  color: theme.$gray_5;
  line-height: 1.5;
  margin: 0 0 12px 0;
}

.request-metadata {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  
  .metadata-item {
    font-size: 12px;
    color: theme.$gray_4;
    display: flex;
    align-items: center;
    gap: 4px;
    
    .warning-icon {
      color: theme.$orange_1;
    }
  }
}

.request-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 16px;
  min-width: 200px;
  
  @media (max-width: 768px) {
    align-items: stretch;
  }
}

.repository-logo {
  .logo {
    height: 40px;
    width: auto;
    max-width: 150px;
    object-fit: contain;
  }
}

.action-buttons {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  
  @media (max-width: 768px) {
    align-items: stretch;
  }
}

.text-button {
  background: none;
  border: none;
  color: theme.$purple_2;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 0;
  text-decoration: none;
  transition: all 0.2s ease;
  
  &:hover {
    text-decoration: underline;
    color: theme.$purple_3;
  }
  
  &.danger {
    color: theme.$red_1;
    
    &:hover {
      color: darken(theme.$red_1, 10%);
    }
  }
}

.status-message {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: theme.$gray_5;
  
  &.success {
    color: theme.$green_1;
  }
  
  &.error {
    color: theme.$red_1;
  }
  
  .status-icon {
    flex-shrink: 0;
  }
}

// Button overrides for small size
:deep(.bf-button) {
  &.small {
    padding: 6px 12px;
    font-size: 14px;
    min-width: auto;
  }
}
</style>