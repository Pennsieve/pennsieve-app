<script setup>
import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import { useGetToken } from '@/composables/useGetToken'
import { useSendXhr } from '@/mixins/request/request_composable'
import * as siteConfig from '@/site-config/site.json'
import IconRemove from '@/components/icons/IconRemove.vue'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import ApiKeyDetail from './APIKeys/ApiKeyDetail.vue'
import CreateApiKey from './APIKeys/CreateApiKey.vue'
import DeleteApiKey from './APIKeys/DeleteApiKey.vue'

const store = useStore()

const profile = computed(() => store.state.profile)
const workspaces = computed(() => store.state.organizations || [])
const selectedWorkspace = ref('')
const apiKeys = ref([])
const isLoadingKeys = ref(false)


async function switchOrgAndFetchKeys() {
  apiKeys.value = []
  isLoadingKeys.value = true

  // Switch workspace prior to submitting request
  let targetOrgId = selectedWorkspace.value
  if (profile.value?.preferredOrganization !== targetOrgId) {
    try {
      const token = await useGetToken()
      const switchOrgUrl = `${siteConfig.apiUrl}/session/switch-organization?organization_id=${targetOrgId}&api_key=${token}`
      const response = await useSendXhr(switchOrgUrl, { method: 'PUT' })
      
      store.dispatch('updateProfile', response)
      await fetchAPIKeys()
    } catch (err) {
      console.error('Unable to select the organization:', err)
      isLoadingKeys.value = false
    }
  } else {
    await fetchAPIKeys()
  }
}

async function fetchAPIKeys() {
  console.log("Fetching API Keys")
  try {
    const token = await useGetToken()
    const apiKeysUrl = `${siteConfig.apiUrl}/token?api_key=${token}`
    const result = await useSendXhr(apiKeysUrl)
    
    isLoadingKeys.value = false
    apiKeys.value = result
  } catch (error) {
    console.error('Failed to fetch API keys:', error)
    isLoadingKeys.value = false
    apiKeys.value = []
  }
}

const showCreateAPIKeyDialog = ref(false)
const showAPIKeyDetailsDialog = ref(false)
const showDeleteAPIKeyDialog = ref(false)

const apiKey = ref({})
function openCreateAPIKeyDialog() {
  showCreateAPIKeyDialog.value = true
}
function closeCreateAPIKeyDialog() {
  showCreateAPIKeyDialog.value = false
}

function onCreateAPIKey(createdKey) {
  showCreateAPIKeyDialog.value = false
  apiKey.value = createdKey.apiKey
  apiKeys.value.push(createdKey.apiKey);
  showAPIKeyDetailsDialog.value = true
}

function closeAPIKeyDetailsDialog() {
  apiKey.value = {}
  showAPIKeyDetailsDialog.value = false
}

function onDeleteAPIKey(deletedKey) {
  showDeleteAPIKeyDialog.value = false
  apiKey.value = {}
  const index = apiKeys.value.findIndex((item) => item.key === deletedKey.key);
  apiKeys.value.splice(index, 1);

}

function openDeleteDialog(key) {
  apiKey.value = key
  showDeleteAPIKeyDialog.value = true
}

function closeDeleteAPIKeyDialog() {
  showDeleteAPIKeyDialog.value = false
}

onMounted(() => {
  // Initialize with current organization if available
  if (profile.value?.preferredOrganization) {
    selectedWorkspace.value = profile.value.preferredOrganization
    fetchAPIKeys()
  }
})

</script>

<template>
  <div class="api-keys-container">
    <div>
      <h2> Create API keys </h2>
      <div class="info-section">
        <p>
          API Keys can be used to login to the Pennsieve platform programmatically.
          In contrast to standard login, API keys are only valid for a single
          workspace. You can associate multiple API keys with your profile.
        </p>
      </div>
        <div class="keys-section">
          <div>
            Workspace:
          </div>

          <el-select
            v-model="selectedWorkspace"
            placeholder="Select a workspace"
            size="large"
            style="width: 240px"
            @change="switchOrgAndFetchKeys"
          >
            <el-option
              v-for="item in workspaces"
              :key="item.organization?.name || item.name"
              :label="item.organization?.name || item.name"
              :value="item.organization?.id || item.id"
            />
          </el-select>

          <div
            class="result-section"
            element-loading-background="transparent"
            v-loading="isLoadingKeys"
          >
            <h3>
            </h3>
            <div
              v-for="apiKey in apiKeys"
              :key="apiKey.key"
              class="api-key-item"
            >
              <div>
                {{ apiKey.name }}
              </div>
              <div>
                <button
                  @click="openDeleteDialog( apiKey)"
                >
                  <IconRemove :height="10" :width="10" color="black" />
                </button>
              </div>

            </div>
          </div>


        </div>

      <bf-button @click="openCreateAPIKeyDialog">
        Create API Key
      </bf-button>

    </div>

    <create-api-key
      :dialog-visible = "showCreateAPIKeyDialog"
      :api-keys="apiKeys"
      @api-key-created = "onCreateAPIKey"
      @close = "closeCreateAPIKeyDialog"
    />

    <api-key-detail
      :dialog-visible = "showAPIKeyDetailsDialog"
      :api-key="apiKey"
      @close = "closeAPIKeyDetailsDialog"
    />

    <delete-api-key
      :dialog-visible = "showDeleteAPIKeyDialog"
      :api-key="apiKey"
      @api-key-deleted ="onDeleteAPIKey"
      @close = "closeDeleteAPIKeyDialog"
    />


  </div>




</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';
@use '../../../styles/element/dialog';


.api-keys-container {
  margin: 0;
}

h3 {
  color: theme.$purple_3;
  margin-top: 24px;
  font-weight: 300;
  font-size: 16px;
}

h2 {
  font-weight: 300;
  font-size: 20px;
}

.result-section {
  max-width: 500px;
  min-height: 100px;
}
.keys-section {
  color: theme.$purple_2;
}

p {
  margin-bottom: 20px;
  font-weight: 300;
  font-size: 14px;
  color: theme.$gray_5;
  max-width: 500px;
}

.api-key-item {
  color: theme.$purple_2;
  margin: 4px 0;
  padding: 12px;
  border: 1px solid theme.$gray_2;
  max-width: 400px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

</style>