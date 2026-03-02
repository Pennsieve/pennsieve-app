<script setup>
import { useGetToken } from '@/composables/useGetToken'
import { useSendXhr, useHandleXhrError } from '@/mixins/request/request_composable'
import { pathOr } from 'ramda'
import * as siteConfig from '@/site-config/site.json'
import BfDialogHeader from '@/components/shared/bf-dialog-header/BfDialogHeader.vue'
import BfButton from '@/components/shared/bf-button/BfButton.vue'

const emit = defineEmits(['close','api-key-deleted'])
const props = defineProps({
  apiKey: {
    type: Object,
    default: {
      name: '',
      key: ''
    },
  },
  dialogVisible: {
    type: Boolean,
    default: false
  }
})

async function sendRequest() {
  try {
    const token = await useGetToken()
    const apiKey = pathOr('', ['apiKey', 'key'], props)
    const url = `${siteConfig.apiUrl}/token/${apiKey}?api_key=${token}`
    
    await useSendXhr(url, {
      method: 'DELETE'
    })
    
    console.log('API key successfully deleted')
    emit('api-key-deleted', { apiKey: props.apiKey, type: 'DELETED' })
  } catch (error) {
    useHandleXhrError(error)
  }
}

function closeDialog() {
  emit('close')
}
</script>

<template>
    <el-dialog
      class="dark-header"
      :modelValue="dialogVisible"
      @update:modelValue="dialogVisible = $event"
      :show-close="false"
      @close="closeDialog"
    >
      <template #header="{ close, titleId, titleClass }">
        <bf-dialog-header title="Confirm Removal" @close="closeDialog"/>
      </template>

      <p>Are you sure you want to delete the following API key:</p>

      <p>Name: <b>{{ apiKey.name }}?</b></p>

      <p> Key: {{apiKey.key}}</p>
      <template #footer>
        <div class="dialog-simple-buttons">
          <bf-button
            class="secondary"
            @click="closeDialog"
          >
            Cancel
          </bf-button>
          <bf-button
            class="red"
            @click="sendRequest"
          >
            Confirm
          </bf-button>
        </div>
      </template>


    </el-dialog>
</template>

