<template>
  <el-descriptions :column="1" border size="small">
    <el-descriptions-item label="Name">
      {{ modelData.name }}
    </el-descriptions-item>
    
    <el-descriptions-item label="Display Name">
      <div v-if="!editingDisplayName" class="editable-field">
        <span>{{ modelData.display_name }}</span>
        <el-button 
          v-if="canEdit" 
          @click="startEditDisplayName" 
          type="text" 
          size="small" 
          class="edit-btn" 
        >
          <IconPencil />
        </el-button>
      </div>
      <div v-else class="edit-container">
        <el-input
          v-model="editDisplayName"
          @keyup.enter="saveDisplayName"
          @keyup.esc="cancelEditDisplayName"
          size="small"
          :loading="savingMetadata"
          ref="displayNameInput"
        />
        <div class="edit-actions">
          <el-button 
            @click="saveDisplayName" 
            type="primary" 
            size="small" 
            :loading="savingMetadata"
          >
            Save
          </el-button>
          <el-button @click="cancelEditDisplayName" size="small">
            Cancel
          </el-button>
        </div>
      </div>
    </el-descriptions-item>
    
    <el-descriptions-item label="Description">
      <div v-if="!editingDescription" class="editable-field">
        <span>{{ modelData.description || 'No description' }}</span>
        <el-button 
          v-if="canEdit" 
          @click="startEditDescription" 
          type="text" 
          size="small" 
          class="edit-btn" 
        >
          <IconPencil />
        </el-button>
      </div>
      <div v-else class="edit-container">
        <el-input
          v-model="editDescription"
          type="textarea"
          @keyup.enter="saveDescription"
          @keyup.esc="cancelEditDescription"
          size="small"
          :loading="savingMetadata"
          ref="descriptionInput"
        />
        <div class="edit-actions">
          <el-button 
            @click="saveDescription" 
            type="primary" 
            size="small" 
            :loading="savingMetadata"
          >
            Save
          </el-button>
          <el-button @click="cancelEditDescription" size="small">
            Cancel
          </el-button>
        </div>
      </div>
    </el-descriptions-item>
    
    <el-descriptions-item :label="isTemplate ? 'Template ID' : 'Model ID'">
      <div class="editable-field">
        <span style="font-family: Monaco, monospace; font-size: 12px;">{{ modelData.id }}</span>
        <el-button 
          @click="copyModelId" 
          type="text" 
          size="small" 
          class="edit-btn" 
          :title="isTemplate ? 'Copy Template ID' : 'Copy Model ID'"
        >
          <IconCopyDocument />
        </el-button>
      </div>
    </el-descriptions-item>
    
    <el-descriptions-item label="Created">
      {{ formatDate(modelData.latest_version.created_at) }}
    </el-descriptions-item>
    
    <el-descriptions-item label="Version">
      v{{ modelData.latest_version.version }}
    </el-descriptions-item>
  </el-descriptions>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElDescriptions, ElDescriptionsItem, ElButton, ElInput, ElMessage } from 'element-plus'
import IconPencil from "@/components/icons/IconPencil.vue"
import IconCopyDocument from "@/components/icons/IconCopyDocument.vue"
import { usePropertyFormatting } from '@/composables/usePropertyFormatting.js'
import { useMetadataStore } from '@/stores/metadataStore.js'

const props = defineProps({
  modelData: {
    type: Object,
    required: true
  },
  datasetId: {
    type: String,
    default: ''
  },
  modelId: {
    type: String,
    default: ''
  },
  model: {
    type: Object,
    default: null
  },
  isTemplate: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['metadata-updated'])

// Use composables
const { formatDate } = usePropertyFormatting()
const metadataStore = useMetadataStore()

// Editing state
const editingDisplayName = ref(false)
const editingDescription = ref(false)
const editDisplayName = ref('')
const editDescription = ref('')
const savingMetadata = ref(false)

// Can edit if we have modelId and datasetId, regardless of model prop
const canEdit = computed(() => {
  return !!(props.modelId && props.datasetId)
})

// Editing functions
const startEditDisplayName = () => {
  if (!canEdit.value) return
  editDisplayName.value = props.modelData.display_name || ''
  editingDisplayName.value = true
}

const startEditDescription = () => {
  if (!canEdit.value) return
  editDescription.value = props.modelData.description || ''
  editingDescription.value = true
}

const cancelEditDisplayName = () => {
  editingDisplayName.value = false
  editDisplayName.value = ''
}

const cancelEditDescription = () => {
  editingDescription.value = false
  editDescription.value = ''
}

const saveDisplayName = async () => {
  if (!editDisplayName.value.trim()) {
    ElMessage.error('Display name cannot be empty')
    return
  }

  try {
    savingMetadata.value = true
    await metadataStore.updateModelMetadata(props.datasetId, props.modelId, {
      display_name: editDisplayName.value.trim()
    })
    
    ElMessage.success('Display name updated successfully')
    editingDisplayName.value = false
    emit('metadata-updated')
  } catch (error) {
    console.error('Failed to update display name:', error)
    ElMessage.error('Failed to update display name: ' + error.message)
  } finally {
    savingMetadata.value = false
  }
}

const saveDescription = async () => {
  try {
    savingMetadata.value = true
    await metadataStore.updateModelMetadata(props.datasetId, props.modelId, {
      description: editDescription.value.trim()
    })
    
    ElMessage.success('Description updated successfully')
    editingDescription.value = false
    emit('metadata-updated')
  } catch (error) {
    console.error('Failed to update description:', error)
    ElMessage.error('Failed to update description: ' + error.message)
  } finally {
    savingMetadata.value = false
  }
}

// Copy Model/Template ID to clipboard
const copyModelId = async () => {
  const idType = props.isTemplate ? 'Template ID' : 'Model ID'
  try {
    await navigator.clipboard.writeText(props.modelData.id)
    ElMessage.success(`${idType} copied to clipboard`)
  } catch (error) {
    console.error(`Failed to copy ${idType.toLowerCase()}:`, error)
    ElMessage.error(`Failed to copy ${idType.toLowerCase()} to clipboard`)
  }
}
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;

:deep(.el-descriptions__label) {
  font-weight: 500;
  width: 120px;
}

:deep(.el-descriptions__content) {
  min-height: 18px;
  display: flex;
  align-items: center;
}

// Inline editing styles
.editable-field {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .edit-btn {
    opacity: 0.7;
    transition: all 0.2s ease;
    padding: 2px !important;
    min-height: unset !important;
    height: 16px !important;
    width: 16px !important;
    color: theme.$gray_5 !important;
    
    :deep(.el-button__icon) {
      margin: 0 !important;
    }
    
    :deep(svg) {
      width: 12px !important;
      height: 12px !important;
    }
    
    &:hover {
      opacity: 1;
      color: theme.$purple_2 !important;
    }
  }
}

.edit-container {
  .edit-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
}
</style>