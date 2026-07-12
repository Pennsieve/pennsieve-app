<template>
  <el-dialog
    v-model="dialogVisible"
    :show-close="false"
    width="820px"
    destroy-on-close
    class="add-property-wizard"
  >
    <template #header>
      <bf-dialog-header title="Add property" />
    </template>
    <dialog-body>
      <property-form :existing-properties="existingProperties" @save="onSave" @cancel="onCancel" />
    </dialog-body>
  </el-dialog>
</template>

<script setup>
// Thin dialog wrapper around the single-screen PropertyForm, for callers that
// want the builder as a modal (e.g. ModelSpecGenerator). CreateModelWizard uses
// PropertyForm inline instead. destroy-on-close remounts the form fresh each
// open, so it resets naturally.
import { computed } from 'vue'
import BfDialogHeader from '@/components/shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '@/components/shared/dialog-body/DialogBody.vue'
import PropertyForm from '@/components/datasets/metadata/models/PropertyForm.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  existingProperties: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:visible', 'save', 'cancel'])

const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const onSave = (defs) => {
  emit('save', defs)
  dialogVisible.value = false
}
const onCancel = () => {
  emit('cancel')
  dialogVisible.value = false
}
</script>
