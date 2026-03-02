<script setup>
import { ref } from 'vue'
import { useGetToken } from '@/composables/useGetToken'
import { useSendXhr, useHandleXhrError } from '@/mixins/request/request_composable'
import { compose, defaultTo, includes, indexOf, map, not, path, toLower } from 'ramda'
import * as siteConfig from '@/site-config/site.json'
import BfDialogHeader from '@/components/shared/bf-dialog-header/BfDialogHeader.vue'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
const props = defineProps({
    dialogVisible: {
      type: Boolean,
      default: false
    },
    apiKeys: {
      type: Array,
      default: [],
    },
})
const emit = defineEmits(['close','api-key-created'])

const ruleForm = ref({
  apiKeyName: ''
})

const rules= ref({
  apiKeyName: [
    { validator: (rule, value, callback) => {
        if (!value) {
          callback(new Error('Please provide an API key'))
        }

        const isUnique = checkUniqueName(props.apiKeys, ['name'], value, '')
        if (isUnique === false) {
          callback(new Error('Please provide unique API key'))
        } else {
          callback()
        }
      }, trigger: 'false' },
  ]
})

const apiKeyFormRef = ref(null)

function onFormSubmit(e) {
  e.preventDefault()
  apiKeyFormRef.value
    .validate((valid) => {
      if (!valid) {
        return
      }
      sendRequest()
    })
}

/**
 * Makes XHR call to create api key
 */
async function sendRequest() {
  try {
    const token = await useGetToken()
    const url = `${siteConfig.apiUrl}/token?api_key=${token}`
    const response = await useSendXhr(url, {
      method: 'POST',
      body: {
        name: ruleForm.value.apiKeyName
      }
    })
    
    // Using console.log since we don't have ElMessage available
    console.log('API key successfully added')
    
    ruleForm.value.apiKeyName = ""
    emit('api-key-created', { apiKey: response, type: 'CREATED' })
  } catch (err) {
    useHandleXhrError(err)
  }
}

const getItemsLower= (p) => compose(
  toLower(),
  path(p),
  defaultTo([])
)

function checkUniqueName(list, p, name, exclude) {
  let filteredNames = map(getItemsLower(p), list);

  // Remove name from list if excluding
  if(exclude) {
    const index = indexOf(toLower(exclude), filteredNames);
    if(index >= 0) {
      filteredNames.splice(index, 1);
    }
  }

  return not(includes(toLower(name), filteredNames));
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
      <bf-dialog-header
        title="Create an API Key"
        class="my-header"
      />
    </template>

    <el-form
      ref="apiKeyFormRef"
      :model="ruleForm"
      :rules="rules"
      label-position="top"
    >
      <el-form-item
        label="Label"
        prop="apiKeyName"
      >
        <el-input
          v-model="ruleForm.apiKeyName"
          placeholder="Provide a label for the API Key"
        />
      </el-form-item>
      <div class="sub-title">
        Key names must be unique
      </div>
    </el-form>

    <template #footer>
      <bf-button
        class="secondary"
        @click="closeDialog"
      >
        Cancel
      </bf-button>
      <bf-button @click="onFormSubmit">
        Confirm
      </bf-button>
    </template>

  </el-dialog>
</template>

<style scoped>

</style>
