/**
 * Composable for model metadata inline editing functionality
 * Handles display_name and description editing with PATCH API calls
 */

import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useMetadataStore } from '@/stores/metadataStore.js'

export function useModelEditing(props, model) {
  const metadataStore = useMetadataStore()
  
  // Editing state
  const editingDisplayName = ref(false)
  const editingDescription = ref(false)
  const editDisplayName = ref('')
  const editDescription = ref('')
  const savingMetadata = ref(false)

  /**
   * Determine if editing is allowed
   * Only allow editing if we have a real model with modelId and datasetId
   * and we're not in preview mode (props.model means preview)
   */
  const canEdit = computed(() => {
    return !!(props.modelId && props.datasetId && !props.model)
  })

  /**
   * Start editing display name
   */
  const startEditDisplayName = () => {
    if (!canEdit.value) return
    editDisplayName.value = model.value?.display_name || ''
    editingDisplayName.value = true
  }

  /**
   * Start editing description
   */
  const startEditDescription = () => {
    if (!canEdit.value) return
    editDescription.value = model.value?.description || ''
    editingDescription.value = true
  }

  /**
   * Cancel display name editing
   */
  const cancelEditDisplayName = () => {
    editingDisplayName.value = false
    editDisplayName.value = ''
  }

  /**
   * Cancel description editing
   */
  const cancelEditDescription = () => {
    editingDescription.value = false
    editDescription.value = ''
  }

  /**
   * Save display name changes
   */
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
      
      // Update the local model data
      if (model.value) {
        model.value.display_name = editDisplayName.value.trim()
      }
    } catch (error) {
      console.error('Failed to update display name:', error)
      ElMessage.error('Failed to update display name: ' + error.message)
    } finally {
      savingMetadata.value = false
    }
  }

  /**
   * Save description changes
   */
  const saveDescription = async () => {
    try {
      savingMetadata.value = true
      await metadataStore.updateModelMetadata(props.datasetId, props.modelId, {
        description: editDescription.value.trim()
      })
      
      ElMessage.success('Description updated successfully')
      editingDescription.value = false
      
      // Update the local model data
      if (model.value) {
        model.value.description = editDescription.value.trim()
      }
    } catch (error) {
      console.error('Failed to update description:', error)
      ElMessage.error('Failed to update description: ' + error.message)
    } finally {
      savingMetadata.value = false
    }
  }

  return {
    // State
    editingDisplayName,
    editingDescription,
    editDisplayName,
    editDescription,
    savingMetadata,
    
    // Computed
    canEdit,
    
    // Actions
    startEditDisplayName,
    startEditDescription,
    cancelEditDisplayName,
    cancelEditDescription,
    saveDisplayName,
    saveDescription
  }
}