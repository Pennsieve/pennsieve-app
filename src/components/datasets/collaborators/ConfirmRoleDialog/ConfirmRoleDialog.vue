<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="handleDialogUpdate"
    :show-close="false"
    @close="close"
  >
    <template #header>
      <bf-dialog-header
        title="Change Permissions"/>
    </template>

    <dialog-body>
      <template #heading>
        <h2>{{ dialogTitle }}</h2>
      </template>

      <div v-html="dialogContent"></div>
    </dialog-body>

    <template #footer>
      <bf-button
        class="secondary"
        @click="close"
      >
        No
      </bf-button>
      <bf-button
        @click="$emit('confirm')"
      >
        {{ btnSubmitCopy }}
      </bf-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from 'vuex'
import { pathOr } from 'ramda'

import BfDialogHeader from '../../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../../shared/dialog-body/DialogBody.vue'
import BfButton from '../../../shared/bf-button/BfButton.vue'

// Props
const props = defineProps({
  dialogVisible: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    default: ''
  },
  currentRole: {
    type: String,
    default: ''
  },
  entity: {
    type: String,
    default: ''
  },
  memberName: {
    type: String,
    default: ''
  }
})

// Emits
const emit = defineEmits(['confirm', 'close-dialog'])

// Store
const store = useStore()

// Computed properties
const dataset = computed(() => store.state.dataset)

const datasetName = computed(() => {
  return pathOr('Dataset', ['content', 'name'], dataset.value)
})

const btnSubmitCopy = computed(() => {
  return props.role === 'owner' ? 'Change Owner' : 'Yes'
})

const entityCopy = computed(() => {
  return props.entity === 'organizations' || props.entity === 'teams' 
    ? 'These users' 
    : 'This user'
})

const dialogTitle = computed(() => {
  switch (props.role) {
    case 'owner':
      return 'Change dataset owner?'
    case 'viewer':
      return 'Change dataset access to Viewer?'
    case 'manager':
      return 'Change dataset access to Manager?'
    case 'editor':
      return 'Change dataset access to Editor?'
    case 'blind_reviewer':
      return 'Add Blind Reviewer User?'
    default:
      return 'Change Permissions'
  }
})

const dialogContent = computed(() => {
  switch (props.role) {
    case 'owner':
      return `
        <p>You are about to change the owner of <strong>${datasetName.value}</strong>. The new owner of the dataset will be <strong>${props.memberName}</strong>. Changes will take place immediately and cannot be undone.</p>
        <p>Click the <strong>Change Owner</strong> button to proceed.</p>
      `
    case 'viewer':
      if (props.currentRole === 'manager') {
        return `<p>${entityCopy.value} will no longer be able to invite organization members to this dataset, edit files, models, and records, or publish to Pennsieve Discover.</p>`
      } else if (props.currentRole === 'editor') {
        return `<p>${entityCopy.value} will no longer be able to create, edit, or delete records and files.</p>`
      }
      return `<p>${entityCopy.value} will have view-only access to this dataset.</p>`
    case 'manager':
      return '<p>Managers can invite people and teams to a dataset, edit and delete models, records and files, as well as publish to Pennsieve Discover.</p>'
    case 'editor':
      return '<p>Editors can create, edit, and delete records and files.</p>'
    case 'blind_reviewer':
      return '<p>Are you sure you want to add this user?</p>'
    default:
      return '<p>Are you sure you want to change these permissions?</p>'
  }
})

// Methods
const handleDialogUpdate = (value) => {
  // Don't modify the prop directly, just emit the close event if dialog is being closed
  if (!value) {
    close()
  }
}

const close = () => {
  emit('close-dialog')
}
</script>