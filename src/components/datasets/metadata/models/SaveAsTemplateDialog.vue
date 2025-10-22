<template>
  <div>
    <el-dialog
      v-model="isVisible"
      :show-close="false"
      class="template-dialog"
      width="500px"
      @closed="handleDialogClosed"
    >
      <template #header>
        <bf-dialog-header title="Save as Template" />
      </template>

      <dialog-body>
        <el-form label-position="top" class="template-form">
          <el-form-item label="Template Name" required>
            <el-input
              v-model="templateForm.name"
              placeholder="Enter template identifier"
            />
            <div class="field-help">Used as the technical identifier for the template</div>
          </el-form-item>

          <el-form-item label="Display Name" required>
            <el-input
              v-model="templateForm.display_name"
              placeholder="Enter human-readable name"
            />
            <div class="field-help">Shown in the template gallery</div>
          </el-form-item>

          <el-form-item label="Description">
            <el-input
              v-model="templateForm.description"
              type="textarea"
              :rows="3"
              placeholder="Describe this template's purpose"
            />
            <div class="field-help">Help others understand when to use this template</div>
          </el-form-item>
        </el-form>

        <div class="dialog-actions">
          <bf-button @click="handleCancel">Cancel</bf-button>
          <bf-button type="primary" @click="handleSubmit" :loading="saving">
            Create Template
          </bf-button>
        </div>
      </dialog-body>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElDialog, ElForm, ElFormItem, ElInput, ElMessage } from 'element-plus'
import BfButton from "@/components/shared/bf-button/BfButton.vue"
import BfDialogHeader from "@/components/shared/bf-dialog-header/BfDialogHeader.vue"
import DialogBody from "@/components/shared/dialog-body/DialogBody.vue"
import { useMetadataStore } from '@/stores/metadataStore.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  modelData: {
    type: Object,
    required: true
  },
  organizationId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:visible', 'template-created'])

const metadataStore = useMetadataStore()

// Local reactive state
const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const templateForm = ref({
  name: '',
  display_name: '',
  description: ''
})

const saving = ref(false)

// Initialize form when dialog becomes visible
watch(() => props.visible, (newVisible) => {
  if (newVisible && props.modelData) {
    templateForm.value = {
      name: props.modelData.name + '_template',
      display_name: (props.modelData.display_name || props.modelData.name) + ' Template',
      description: `Template created from model: ${props.modelData.display_name || props.modelData.name}`
    }
  }
})

const handleSubmit = async () => {
  if (!templateForm.value.name.trim() || !templateForm.value.display_name.trim()) {
    ElMessage.error('Name and Display Name are required')
    return
  }

  saving.value = true
  
  try {
    const templateData = {
      name: templateForm.value.name.trim(),
      display_name: templateForm.value.display_name.trim(),
      description: templateForm.value.description.trim(),
      schema: props.modelData.latest_version.schema
    }

    const createdTemplate = await metadataStore.createTemplateFromModel(templateData, props.organizationId)
    
    ElMessage.success({
      message: `Template "${templateData.display_name}" created successfully`,
      duration: 3000
    })
    
    isVisible.value = false
    emit('template-created', createdTemplate)
    
  } catch (error) {
    console.error('Error creating template from model:', error)
    ElMessage.error({
      message: `Failed to create template: ${error.message || 'Unknown error'}`,
      duration: 4000
    })
  } finally {
    saving.value = false
  }
}

const handleCancel = () => {
  isVisible.value = false
}

const handleDialogClosed = () => {
  // Reset form when dialog is closed
  templateForm.value = {
    name: '',
    display_name: '',
    description: ''
  }
  saving.value = false
}
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/dialog';

// Template Dialog Styling
:deep(.template-dialog) {
  .el-dialog__header {
    padding: 0;
  }

  .el-dialog__body {
    padding: 0;
  }
  
  // Override DialogBody's flex centering for forms
  .dialog-body {
    align-items: stretch;
    justify-content: flex-start;
    padding: 24px 32px;
  }
  
  .dialog-body-content {
    width: 100%;
  }

  .template-form {
    .el-form-item {
      margin-bottom: 20px;

      .el-form-item__label {
        font-weight: 500;
        color: theme.$gray_6;
        margin-bottom: 6px;
        display: block;
      }

      .el-input__wrapper {
        box-shadow: 0 0 0 1px theme.$gray_3 inset;
        border-radius: 4px;

        &.is-focus {
          box-shadow: 0 0 0 2px theme.$purple_2 inset;
        }
      }

      .el-textarea__inner {
        border: 1px solid theme.$gray_3;
        border-radius: 4px;

        &:focus {
          border-color: theme.$purple_2;
          box-shadow: 0 0 0 1px theme.$purple_2;
        }
      }
    }

    .field-help {
      font-size: 12px;
      color: theme.$gray_5;
      margin-top: 4px;
      line-height: 1.4;
    }
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid theme.$gray_2;
  }
}
</style>