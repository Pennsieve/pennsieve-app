<template>
  <div>
    <el-dialog
      :modelValue="dialogVisible"
      @update:modelValue="$emit('update:dialogVisible', $event)"
      width="80%"
      :show-close="false"
      @close="closeDialog"
    >
      <template #header>
        <bf-dialog-header title="Repository Information" />
      </template>

      <div class="image-wrapper">
        <img :src="logoPath" class="logo" alt="Repository Logo" v-if="logoPath" />
        <div>
          <a :href="repository?.url" target="_blank" v-if="repository?.url">
            <bf-button class="primary"> Visit Repository </bf-button>
          </a>
        </div>
      </div>

      <dialog-body>
        <div v-if="isLoadingDescription" class="loading-state">
          <p>Loading repository information...</p>
        </div>
        <markdown-editor
          v-else
          ref="markdownEditor"
          :value="readmeText"
          :is-editing="false"
          :is-saving="false"
          :is-loading="false"
        />
      </dialog-body>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import BfDialogHeader from "../../shared/bf-dialog-header/BfDialogHeader.vue"
import DialogBody from "../../shared/dialog-body/DialogBody.vue"
import MarkdownEditor from "../../shared/MarkdownEditor/MarkdownEditor.vue"
import BfButton from "../../shared/bf-button/BfButton.vue"

const props = defineProps({
  dialogVisible: {
    type: Boolean,
    default: false,
  },
  repository: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:dialogVisible'])

const readmeText = ref("")
const isLoadingDescription = ref(false)

const logoPath = computed(() => {
  return props.repository?.logoFile || ''
})

const getReadmeText = async () => {
  if (!props.repository?.overviewDocument) {
    readmeText.value = props.repository?.description || 'No detailed information available for this repository.'
    return
  }

  isLoadingDescription.value = true
  try {
    const response = await fetch(props.repository.overviewDocument)
    if (response.ok) {
      readmeText.value = await response.text()
    } else {
      readmeText.value = props.repository?.description || 'No detailed information available for this repository.'
    }
  } catch (error) {
    console.error('Error fetching repository description:', error)
    readmeText.value = props.repository?.description || 'Failed to load repository information.'
  } finally {
    isLoadingDescription.value = false
  }
}

const closeDialog = () => {
  emit('update:dialogVisible', false)
}

watch(() => props.repository, (newRepo) => {
  if (newRepo && Object.keys(newRepo).length > 0) {
    getReadmeText()
  }
}, { immediate: true })

watch(() => props.dialogVisible, (isVisible) => {
  if (isVisible && props.repository && Object.keys(props.repository).length > 0) {
    getReadmeText()
  }
})
</script>

<style scoped lang="scss">
@import '../../../styles/_theme.scss';

.image-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  
  .logo {
    max-width: 240px;
    max-height: 80px;
    object-fit: contain;
  }
}

.loading-state {
  text-align: center;
  padding: 40px 20px;
  color: $gray_5;
}

:deep(.el-dialog) {
  margin-top: 16px;
}

:deep(.el-dialog__header) {
  padding: 20px 20px 10px;
}

:deep(.el-dialog__body) {
  padding: 10px 20px 20px;
}
</style>