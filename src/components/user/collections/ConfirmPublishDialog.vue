<template>
  <div>
    <el-dialog
      v-model="isVisible"
      title="Confirm Publication"
      :show-close="false"
      @close="closeDialog"
    >
      <template #header>
        <bf-dialog-header
          title="Confirm Publish"
        />
      </template>
      <div class="warning-wrap bf-dialog-body">
        <icon-warning-circle
          :height="32"
          :width="32"
          color="#C14D49"
        />
        <h4 class="delete-dataset-title">
          Publish {{ props.collectionDetails.name }}
        </h4>
        <div class="warning-message">
          Warning: This cannot be undone
        </div>
      </div>
      <el-form
        ref="deleteDatasetForm"
        @submit="onFormSubmit"
      >
        <el-form-item prop="checkBoxes">
          <el-checkbox-group
            v-model="form.checkBoxes"
            @change="isChecked"
          >
            <el-checkbox
              class="step-2"
              label="Published collections will become accessible for all users"
              name="type"
            />
            <el-checkbox
              class="step-2"
              label="This collection will persist even after deletion. It can not be unpublished at this time."
              name="type"
            />
          </el-checkbox-group>
        </el-form-item>
      </el-form>

      <template #footer>
        <bf-button
          class="secondary"
          @click="closeDialog"
        >
          Cancel
        </bf-button>
        <bf-button
          class="red"
          :disabled="disabled"
          @click="onFormSubmit"
        >
          Publish
        </bf-button>
      </template>

    </el-dialog>

  </div>
  </template>
  
  <script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useCollectionsStore } from '@/stores/collectionStore'

import BfButton from '../../shared/bf-button/BfButton.vue'
import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
import IconWarningCircle from '../../icons/IconWarningCircle.vue'

const isVisible = ref(true);
// Emits
const emit = defineEmits<{
  (e: 'publishDatasetConfirmed'): void
  (e: 'close'): void
}>()

const props = defineProps<{
  collectionDetails: {
    name: string
    id: string
  }
}>()


const isPublished = computed<boolean>(() => {
  // e.g., return Boolean(dataset.value?.publishedAt)
  return false
})


const checkBoxCount = computed(() => (isPublished.value ? 3 : 2))


// Local state (replaces data())
const form = reactive<{ checkBoxes: string[] }>({
  checkBoxes: []
})
const disabled = ref(true)

// Methods
function isChecked(val: unknown[]) {
  disabled.value = val.length !== checkBoxCount.value
}

function onFormSubmit() {
  emit('publishDatasetConfirmed')
  closeDialog()
}

function closeDialog() {
  form.checkBoxes = []
  disabled.value = true
  emit('close')
}
</script>

  
  <style lang="scss" scoped>
  @import '../../../styles/_theme.scss';
  
  .el-form {
    display: flex;
    flex-direction: row;
    justify-content: center;
  }
  
  .delete-dataset-title {
    color: $red_2;
    margin-top: 0;
  }
  
  .el-checkbox-group {
    line-height: 32px;
    width: min-content;
    max-width: 476px;

  }
  
  .el-checkbox {
    line-height: 0;
  }
  
  .svg-icon {
    color: $red_1;
  }
  
  .warning-wrap {
    text-align: center;
    margin-bottom: 24px;
  }
  
  .warning-message {
    color: $red_2;
  }
  
  .el-form-item {
    // margin-left: 45px;
  }
  
  .step-1,
  .step-2 {
    margin-left: 0;
    color: rgb(210, 210, 210);
  }
  </style>
  