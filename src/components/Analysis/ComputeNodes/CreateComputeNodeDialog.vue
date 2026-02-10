<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import BfDialogHeader from '@/components/shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '@/components/shared/dialog-body/DialogBody.vue'
import IconInfo from '@/components/icons/IconInfo.vue'
import IconArrowRight from '@/components/icons/IconArrowRight.vue'

const props = defineProps({
  dialogVisible: Boolean
})

const emit = defineEmits(['close'])

const store = useStore()
const computeNodeForm = ref(null)
const isLoading = ref(false)
const computeResourceAccounts = ref([])
const isLoadingAccounts = ref(false)

// Form data
const computeNode = ref({
  name: '',
  description: '',
  account: null
})

// Validation rules
const rules = {
  name: [
    { required: true, message: 'Please input a name', trigger: 'blur' },
    { 
      min: 3, 
      max: 50, 
      message: 'Name should be between 3 and 50 characters', 
      trigger: 'blur' 
    },
    {
      pattern: /^[a-zA-Z0-9][a-zA-Z0-9-_]*[a-zA-Z0-9]$/,
      message: 'Name must start and end with alphanumeric characters, can contain hyphens and underscores',
      trigger: 'blur'
    }
  ],
  description: [
    { required: true, message: 'Please input a description', trigger: 'blur' },
    { min: 10, message: 'Description should be at least 10 characters', trigger: 'blur' }
  ],
  account: [
    { required: true, message: 'Please select a compute resource account', trigger: 'change' }
  ]
}

// Computed
const currentOrganization = computed(() => store.getters.activeOrganization?.organization)
const hasComputeResources = computed(() => computeResourceAccounts.value.length > 0)

// Format account for display in dropdown
const formatAccountForDisplay = (account) => {
  if (!account) return ''
  
  const accountId = account.accountId || ''
  const accountType = account.accountType || ''
  const name = account.name || ''
  
  // Use name if available, otherwise fall back to account type
  const displayName = name || `${getAccountTypeLabel(accountType)} Account`
  
  // Format AWS account ID with dashes
  const formattedId = formatAccountId(accountId)
  
  // Return a comprehensive label that shows both name and account ID
  return `${displayName} (${formattedId} - ${accountType})`
}

// Get the display name for a compute resource
const getResourceDisplayName = (account) => {
  if (!account) return 'Unknown Resource'
  return account.name || `${getAccountTypeLabel(account.accountType)} Account`
}

// Get account type display name
const getAccountTypeLabel = (type) => {
  switch (type) {
    case 'AWS': return 'Amazon Web Services'
    case 'GCP': return 'Google Cloud Platform'
    case 'AZURE': return 'Microsoft Azure'
    default: return type || 'Unknown'
  }
}

// Format account ID for display
const formatAccountId = (accountId) => {
  if (!accountId) return ''
  
  // Format AWS account ID with dashes for better readability
  if (accountId.length === 12) {
    return `${accountId.slice(0, 4)}-${accountId.slice(4, 8)}-${accountId.slice(8)}`
  }
  
  return accountId
}

// Fetch compute resource accounts
const fetchComputeResourceAccounts = async () => {
  isLoadingAccounts.value = true
  try {
    const token = await useGetToken()
    const orgId = currentOrganization.value?.id
    
    if (!orgId) {
      console.error('No organization ID found')
      return
    }
    
    const url = `${siteConfig.api2Url}/compute/resources/accounts?organization_id=${orgId}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      computeResourceAccounts.value = data || []
    } else {
      console.error('Failed to fetch compute resource accounts:', response.status, response.statusText)
      computeResourceAccounts.value = []
    }
  } catch (error) {
    console.error('Failed to fetch compute resource accounts:', error)
    computeResourceAccounts.value = []
  } finally {
    isLoadingAccounts.value = false
  }
}

// Create compute node
const createComputeNode = async (nodeData) => {
  const token = await useGetToken()
  const orgId = currentOrganization.value?.id
  
  if (!orgId) {
    throw new Error('No organization ID found')
  }
  
  const url = `${siteConfig.api2Url}/compute/resources/compute-nodes`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...nodeData,
      organizationId: orgId
    })
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Failed to create compute node: ${response.status}`)
  }
  
  return response.json()
}

// Handle dialog close
const closeDialog = () => {
  computeNode.value = {
    name: '',
    description: '',
    account: null
  }
  emit('close', false)
  if (computeNodeForm.value) {
    computeNodeForm.value.clearValidate()
  }
}

// Handle compute node creation
const handleCreateComputeNode = async () => {
  if (!computeNodeForm.value) return
  
  computeNodeForm.value.validate(async (valid) => {
    if (valid) {
      isLoading.value = true
      
      try {
        const selectedAccount = computeResourceAccounts.value.find(
          (account) => account.accountId === computeNode.value.account
        )
        
        if (!selectedAccount) {
          throw new Error('Selected account not found')
        }
        
        const formattedComputeNode = {
          name: computeNode.value.name.trim(),
          description: computeNode.value.description.trim(),
          account: selectedAccount
        }
        
        await createComputeNode(formattedComputeNode)
        
        ElMessage.success({
          message: 'Compute node creation initiated successfully. This process may take several minutes to complete.',
          duration: 8000
        })
        
        closeDialog()
      } catch (error) {
        console.error('Failed to create compute node:', error)
        ElMessage.error({
          message: error.message || 'Failed to create compute node. Please try again.',
          duration: 6000
        })
      } finally {
        isLoading.value = false
      }
    }
  })
}

// Watch for dialog visibility to fetch accounts
watch(() => props.dialogVisible, (newValue) => {
  if (newValue) {
    fetchComputeResourceAccounts()
  }
})

onMounted(() => {
  if (props.dialogVisible) {
    fetchComputeResourceAccounts()
  }
})
</script>

<template>
  <el-dialog
    :model-value="dialogVisible"
    @update:model-value="$emit('close', false)"
    class="create-compute-node-dialog"
    @close="closeDialog"
    width="600px"
    :close-on-click-modal="false"
  >
    <template #header>
      <bf-dialog-header title="Create Compute Node" />
    </template>

    <dialog-body>
      <!-- Information Section -->
      <div class="info-section">
        <div class="info-card">
          <div class="info-header">
            <IconInfo :width="20" :height="20" />
            <h3>About Compute Nodes</h3>
          </div>
          <p>
            Compute nodes are computational resources that process and analyze your Pennsieve data within your cloud accounts.
            Each node is associated with a specific compute resource account and can run analysis workflows on your datasets.
          </p>
          <div class="creation-info">
            <div class="timing-notice">
              <strong>⏱️ Creation Time:</strong> 
              Setting up your compute node typically takes 3-5 minutes.
            </div>
          </div>
        </div>
      </div>

      <!-- Form Section -->
      <div class="form-section">
        <el-form
          :model="computeNode"
          :rules="rules"
          ref="computeNodeForm"
          label-position="top"
          @submit.native.prevent="handleCreateComputeNode"
        >
          <el-form-item prop="name">
            <template #label>
              <span class="field-label">Name</span>
              <span class="label-helper">required</span>
            </template>
            <el-input
              v-model="computeNode.name"
              placeholder="e.g., my-analysis-node"
              :disabled="isLoading"
              maxlength="50"
              show-word-limit
            />
            <div class="field-help">
              Choose a descriptive name for your compute node. Use only letters, numbers, hyphens, and underscores.
            </div>
          </el-form-item>

          <el-form-item prop="description">
            <template #label>
              <span class="field-label">Description</span>
              <span class="label-helper">required</span>
            </template>
            <el-input
              v-model="computeNode.description"
              type="textarea"
              :rows="3"
              maxlength="255"
              show-word-limit
              placeholder="Describe the purpose and use case for this compute node..."
              :disabled="isLoading"
            />
            <div class="field-help">
              Provide a clear description of how you plan to use this compute node.
            </div>
          </el-form-item>

          <el-form-item prop="account">
            <template #label>
              <span class="field-label">Compute Resource Account</span>
              <span class="label-helper">required</span>
            </template>
            
            <div v-if="!hasComputeResources && !isLoadingAccounts" class="no-accounts-warning">
              <div class="warning-content">
                <div class="warning-icon">⚠️</div>
                <div>
                  <strong>No Compute Resource Accounts Available</strong>
                  <p>
                    You need to register a compute resource account before creating compute nodes.
                    Visit the Compute Resources section to add your cloud account.
                  </p>
                  <a 
                    href="/integrations" 
                    target="_blank" 
                    class="setup-link"
                    @click="closeDialog"
                  >
                    Setup Compute Resources
                    <IconArrowRight :width="14" :height="14" />
                  </a>
                </div>
              </div>
            </div>
            
            <el-select
              v-else
              v-model="computeNode.account"
              placeholder="Select a compute resource account"
              :disabled="isLoading || isLoadingAccounts"
              :loading="isLoadingAccounts"
              class="account-select"
            >
              <el-option
                v-for="account in computeResourceAccounts"
                :key="account.accountId"
                :value="account.accountId"
                class="account-option"
              >
                <span class="account-name">{{ getResourceDisplayName(account) }}</span>
                <span class="account-details">
                  {{ formatAccountId(account.accountId) }} - {{ account.accountType }}
                </span>
              </el-option>
            </el-select>
            
            <div v-if="hasComputeResources" class="field-help">
              Select the cloud account where this compute node will be created.
            </div>
          </el-form-item>
        </el-form>
      </div>
    </dialog-body>

    <template #footer>
      <div class="dialog-footer">
        <bf-button 
          @click="closeDialog" 
          class="secondary"
          :disabled="isLoading"
        >
          Cancel
        </bf-button>
        <bf-button 
          @click="handleCreateComputeNode"
          :loading="isLoading"
          :disabled="!hasComputeResources"
          class="primary"
        >
          {{ isLoading ? 'Creating Node...' : 'Create Compute Node' }}
        </bf-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.create-compute-node-dialog {
  .info-section {
    margin-bottom: 32px;
  }

  .info-card {
    background: theme.$gray_1;
    border: 1px solid theme.$gray_2;
    border-radius: 8px;
    padding: 20px;

    .info-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;

      h3 {
        font-size: 16px;
        font-weight: 500;
        color: theme.$gray_6;
        margin: 0;
      }

      svg {
        color: theme.$purple_2;
        flex-shrink: 0;
      }
    }

    p {
      font-size: 14px;
      color: theme.$gray_5;
      line-height: 1.5;
      margin: 0 0 16px 0;
    }

    .creation-info {
      .timing-notice {
        background: rgba(theme.$teal_1, 0.1);
        border-left: 3px solid theme.$teal_1;
        padding: 12px;
        border-radius: 4px;
        font-size: 14px;
        color: theme.$gray_6;
        line-height: 1.4;

        strong {
          color: theme.$teal_1;
        }
      }
    }
  }

  .form-section {
    .el-form-item {
      margin-bottom: 24px;

      .field-label {
        font-weight: 500;
        color: theme.$gray_6;
        font-size: 14px;
      }

      .label-helper {
        color: theme.$red_1;
        font-size: 12px;
        font-weight: 400;
        margin-left: 4px;
      }

      .field-help {
        font-size: 12px;
        color: theme.$gray_4;
        margin-top: 6px;
        line-height: 1.4;
      }
    }

    .account-select {
      width: 100%;

      :deep(.el-select__wrapper) {
        min-height: 40px;
      }
    }

    // Target Element Plus dropdown options with deep selector
    :deep(.el-select-dropdown__item) {
      &.account-option {
        .account-name {
          display: block;
          font-weight: 600;
          color: var(--el-text-color-primary);
          font-size: 14px;
          line-height: 1.4;
        }

        .account-details {
          display: block;
          color: var(--el-text-color-secondary);
          font-size: 12px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          margin-top: 2px;
          line-height: 1.3;
        }
      }
    }

    // Also target the option wrapper directly
    :deep(.el-option) {
      &.account-option {
        .account-name {
          display: block;
          font-weight: 600;
          color: var(--el-text-color-primary);
          font-size: 14px;
          line-height: 1.4;
        }

        .account-details {
          display: block;
          color: var(--el-text-color-secondary);
          font-size: 12px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          margin-top: 2px;
          line-height: 1.3;
        }
      }
    }

    .no-accounts-warning {
      .warning-content {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px;
        background: rgba(#F59E0B, 0.05);
        border: 1px solid rgba(#F59E0B, 0.15);
        border-radius: 8px;

        .warning-icon {
          font-size: 20px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        strong {
          color: theme.$gray_6;
          font-size: 14px;
          display: block;
          margin-bottom: 4px;
        }

        p {
          color: theme.$gray_5;
          font-size: 13px;
          margin: 0 0 12px 0;
          line-height: 1.4;
        }

        .setup-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: theme.$purple_2;
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
          
          &:hover {
            color: theme.$purple_1;
            text-decoration: underline;
          }

          svg {
            flex-shrink: 0;
          }
        }
      }
    }
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  // Element UI Form Overrides
  :deep(.el-form-item__label) {
    font-weight: 500;
    color: theme.$gray_6;
    margin-bottom: 8px;
  }

  :deep(.el-input__wrapper) {
    border-radius: 6px;
    border: 1px solid theme.$gray_3;
    transition: all 0.2s ease;

    &:hover {
      border-color: theme.$gray_4;
    }

    &.is-focus {
      border-color: theme.$purple_2;
      box-shadow: 0 0 0 2px rgba(theme.$purple_2, 0.1);
    }
  }

  :deep(.el-textarea__inner) {
    border-radius: 6px;
    border: 1px solid theme.$gray_3;
    font-family: inherit;
    transition: all 0.2s ease;
    resize: vertical;
    min-height: 80px;

    &:hover {
      border-color: theme.$gray_4;
    }

    &:focus {
      border-color: theme.$purple_2;
      box-shadow: 0 0 0 2px rgba(theme.$purple_2, 0.1);
    }
  }

  :deep(.el-select__wrapper) {
    border-radius: 6px;
    border: 1px solid theme.$gray_3;
    transition: all 0.2s ease;

    &:hover {
      border-color: theme.$gray_4;
    }

    &.is-focused {
      border-color: theme.$purple_2;
      box-shadow: 0 0 0 2px rgba(theme.$purple_2, 0.1);
    }
  }

  :deep(.el-input__count) {
    font-size: 11px;
    color: theme.$gray_4;
  }

  :deep(.el-form-item.is-error) {
    .el-input__wrapper {
      border-color: theme.$red_1;
      
      &:hover, &.is-focus {
        border-color: theme.$red_1;
        box-shadow: 0 0 0 2px rgba(theme.$red_1, 0.1);
      }
    }
    
    .el-textarea__inner {
      border-color: theme.$red_1;
      
      &:hover, &:focus {
        border-color: theme.$red_1;
        box-shadow: 0 0 0 2px rgba(theme.$red_1, 0.1);
      }
    }
    
    .el-select__wrapper {
      border-color: theme.$red_1;
      
      &:hover, &.is-focused {
        border-color: theme.$red_1;
        box-shadow: 0 0 0 2px rgba(theme.$red_1, 0.1);
      }
    }
  }

  :deep(.el-form-item__error) {
    color: theme.$red_1;
    font-size: 12px;
    line-height: 1.4;
  }

  // Dialog styling
  :deep(.el-dialog) {
    border-radius: 8px;
    
    .el-dialog__header {
      padding: 20px 24px 0;
    }
    
    .el-dialog__body {
      padding: 20px 24px;
    }
    
    .el-dialog__footer {
      padding: 0 24px 24px;
    }
  }

  // Button styling
  :deep(.bf-button) {
    &.primary {
      background: theme.$purple_2;
      border-color: theme.$purple_2;
      color: white;
      
      &:hover:not(:disabled) {
        background: theme.$purple_1;
        border-color: theme.$purple_1;
      }
      
      &:disabled {
        background: theme.$gray_3;
        border-color: theme.$gray_3;
        color: theme.$gray_4;
        cursor: not-allowed;
      }
    }
    
    &.secondary {
      background: white;
      border-color: theme.$gray_3;
      color: theme.$gray_6;
      
      &:hover:not(:disabled) {
        border-color: theme.$gray_4;
        background: theme.$gray_1;
      }
    }
  }
}
</style>