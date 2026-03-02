<template>
  <div class="dataset-statuses-form">
    <div class="form-header">
      <h3>Custom Dataset Statuses</h3>
      <p class="form-description">
        Add custom statuses to new datasets based on your organization's unique workflow. 
        You can create up to 20 custom statuses.
      </p>
    </div>

    <div class="statuses-list">
      <div
        v-for="status in orgDatasetStatuses"
        :key="status.id"
        class="status-item"
      >
        <dataset-status-input
          :active-org-id="activeOrgId"
          :status="status"
          :created-new-status="createdNewStatus"
        />
      </div>
    </div>

    <div class="form-actions">
      <bf-button
        class="primary"
        :disabled="orgDatasetStatuses.length >= 20 || !hasAdminRights"
        @click="addStatus"
      >
        <template v-if="orgDatasetStatuses.length >= 20">
          Maximum Statuses Reached (20)
        </template>
        <template v-else>
          Add Status
        </template>
      </bf-button>
      
      <div class="status-count">
        {{ orgDatasetStatuses.length }} / 20 statuses created
      </div>
    </div>

    <div class="info-section">
      <div class="info-card">
        <h4>How Dataset Statuses Work</h4>
        <ul>
          <li>Custom statuses help you track datasets through your organization's workflow</li>
          <li>Each status can have a custom name and color for easy identification</li>
          <li>Statuses can be applied to datasets to indicate their current stage</li>
          <li>Team members can filter and sort datasets by status</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { mapActions, mapState } from 'vuex'
import { pathOr, propOr } from 'ramda'
import BfButton from '../../shared/bf-button/BfButton.vue'
import DatasetStatusInput from '../DatasetStatusInput/DatasetStatusInput.vue'
import { useGetToken } from '@/composables/useGetToken'
import { useHandleXhrError } from '@/mixins/request/request_composable'

export default {
  name: 'DatasetStatusesForm',

  components: {
    BfButton,
    DatasetStatusInput
  },

  data() {
    return {
      createdNewStatus: false
    }
  },

  computed: {
    ...mapState([
      'activeOrganization',
      'config',
      'orgDatasetStatuses'
    ]),

    activeOrgId() {
      return pathOr('', ['organization', 'id'], this.activeOrganization)
    },

    hasAdminRights() {
      if (this.activeOrganization) {
        const isAdmin = propOr(false, 'isAdmin', this.activeOrganization)
        const isOwner = propOr(false, 'isOwner', this.activeOrganization)
        return isAdmin || isOwner
      }
      return false
    }
  },

  watch: {
    activeOrganization: {
      handler() {
        this.getAllDatasetStatuses()
      },
      immediate: true
    }
  },

  methods: {
    ...mapActions(['updateOrgDatasetStatuses']),

    async getAllDatasetStatuses() {
      if (!this.activeOrgId) return

      try {
        const token = await useGetToken()
        const url = `${this.config.apiUrl}/organizations/${this.activeOrgId}/dataset-status?api_key=${token}`
        
        const response = await this.sendXhr(url, {})
        this.updateOrgDatasetStatuses(response)
      } catch (error) {
        useHandleXhrError(error)
      }
    },

    addStatus() {
      if (!this.hasAdminRights || this.orgDatasetStatuses.length >= 20) return

      const status = {
        displayName: '',
        color: '#71747C',
        placeholder: 'Enter status name...',
        isNew: true
      }
      
      this.updateOrgDatasetStatuses([...this.orgDatasetStatuses, status])
      this.createdNewStatus = true
    },

    // Simple XHR helper (would normally come from mixin)
    async sendXhr(url, options = {}) {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return response.json()
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.dataset-statuses-form {
  max-width: 900px;
}

.form-header {
  margin-bottom: 32px;

  h3 {
    font-size: 20px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  .form-description {
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;
    margin: 0;
  }
}

.statuses-list {
  margin-bottom: 32px;
  
  .status-item {
    margin-bottom: 16px;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
}

.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 0;
  border-top: 1px solid theme.$gray_2;
  border-bottom: 1px solid theme.$gray_2;
  margin-bottom: 32px;

  .status-count {
    font-size: 14px;
    color: theme.$gray_5;
    font-weight: 500;
  }
}

.info-section {
  .info-card {
    background: theme.$gray_1;
    border: 1px solid theme.$gray_2;
    border-radius: 8px;
    padding: 20px;

    h4 {
      font-size: 16px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0 0 12px 0;
    }

    ul {
      margin: 0;
      padding-left: 20px;
      
      li {
        font-size: 14px;
        color: theme.$gray_5;
        line-height: 1.6;
        margin-bottom: 8px;
        
        &:last-child {
          margin-bottom: 0;
        }
      }
    }
  }
}

:deep(.bf-button) {
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}
</style>