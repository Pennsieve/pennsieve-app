<template>
  <div class="user-orcid-container">
    <div class="orcid-content">
      <h2>Link your ORCID account</h2>
      <p>
        When you link your ORCID account to your Pennsieve account, any dataset publications will
        be posted on your ORCID account and your ORCID profile will be associated with your contributor listing on
        published datasets.
      </p>
      <p>
        In addition, you will be able to log into the Pennsieve platform with your ORCID
        account in addition to your email/password.
        <a href="https://docs.pennsieve.io/docs/orcid-ids-on-the-pennsieve-platform" target="_blank">
          Learn More
        </a>
      </p>

      <div v-if="!hasOrcidId" class="orcid-connect">
        <button id="connect-orcid-button" @click="openORCID">
          <img id="orcid-id-icon" src="../../../assets/images/orcid_24x24.png" width="24" height="24"
            alt="Logo for ORCID" />
          Register or Connect your ORCID iD
        </button>
      </div>

      <div v-else class="orcid-connected">
        <p class="orcid-success-text">
          Below is the ORCID associated with your Pennsieve account.
          <a href="https://docs.pennsieve.io/docs/orcid-ids-on-the-pennsieve-platform" target="_blank">
            Learn More
          </a>
        </p>
        <div v-if="!loading" class="orcid-success">
          <img src="../../../assets/images/orcid.png" alt="Logo for ORCID" />
          <div class="orcid-success-info">
            <a :href="getORCIDResultUrl" target="_blank">
              {{ getORCIDResultUrl }}
            </a>
          </div>
          <button class="orcid-delete-button" @click="isDeleteOrcidDialogVisible = true">
            <IconRemove :height="10" :width="10" />
          </button>
        </div>

        <div v-else class="orcid-waiting">
          <div class="orcid-loader">Loading...</div>
        </div>
        
        <div v-if="!publishToOrcid" class="update-preferences">
          <el-tooltip placement="right" content="Authorize Pennsieve to update ORCID with all of your Published Datasets">
            <bf-button @click="openORCID">
              Update ORCID Publish Preferences
            </bf-button>
          </el-tooltip>
        </div>
      </div>

      <el-dialog 
        v-model="isDeleteOrcidDialogVisible" 
        title="Delete ORCID Integration?"
        width="500px"
      >
        <p style="max-width: 450px">
          Are you sure you want to remove your linked ORCID account from your Pennsieve user profile?
        </p>
        <ul>
          <li>You will no longer be able to submit datasets for publication.</li>
          <li>Published datasets will no longer be listed in your ORCID account</li>
          <li>Your ORCID profile will no longer be associated with a publication if you are a contributor</li>
        </ul>

        <template #footer>
          <bf-button type="primary" @click="confirmOrcidDelete">
            Confirm
          </bf-button>
          <bf-button class="secondary" @click="isDeleteOrcidDialogVisible = false">Cancel</bf-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, getCurrentInstance } from 'vue'
import { useStore } from 'vuex'
import { useGetToken } from '@/composables/useGetToken'
import { useSendXhr } from '@/mixins/request/request_composable'
import * as siteConfig from '@/site-config/site.json'
import IconRemove from '@/components/icons/IconRemove.vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue";

const store = useStore()
const instance = getCurrentInstance()

const profile = computed(() => store.state.profile)
const publishToOrcid = ref(false)

const ORCIDUrl = computed(() => {
  return `${siteConfig.ORCIDUrl}`
})

const ORCIDApiUrl = ref('')

const getORCIDResultUrl = computed(() => {
  const orcidId = profile.value?.orcid?.orcid
  return orcidId ? `${siteConfig.ORCIDAPIHost}/${orcidId}` : ''
})

const hasOrcidId = computed(() => {
  return !!(profile.value?.orcid?.orcid)
})

const oauthWindow = ref(null)
const oauthCode = ref('')
const loading = ref(false)
const isDeleteOrcidDialogVisible = ref(false)

onMounted(() => {
  window.addEventListener('message', messageEventListener)
  fetchORCIDApiUrl()
})

onBeforeUnmount(() => {
  window.removeEventListener('message', messageEventListener)
})

function openORCID() {
  oauthWindow.value = window.open(
    ORCIDUrl.value,
    "_blank",
    "toolbar=no, scrollbars=yes, width=500, height=600, top=500, left=500"
  )
}

const messageEventListener = (event) => {
  if (
    event.data &&
    event.data.source &&
    event.data.source === "orcid-redirect-response" &&
    event.data.code
  ) {
    oauthCode.value = event.data.code
    if (oauthCode.value !== "") {
      if (!ORCIDApiUrl.value) {
        return
      }

      useSendXhr(ORCIDApiUrl.value, {
        method: "POST",
        body: {
          authorizationCode: {
            source: "orcid-redirect-response",
            code: oauthCode.value,
          },
        },
      })
        .then((response) => {
          store.dispatch('updateProfile', {
            ...profile.value,
            orcid: response,
          })

          instance.proxy.$message({
            message: 'Your ORCID has been successfully added',
            type: 'success',
            center: true,
            duration: 3000,
            showClose: true
          })
        })
        .catch((error) => {
          console.error('ORCID error:', error)
          instance.proxy.$message({
            message: 'Failed to connect ORCID. Please try again.',
            type: 'error',
            center: true,
            duration: 5000,
            showClose: true
          })
        })
    }
  }
}

const confirmOrcidDelete = () => {
  useSendXhr(ORCIDApiUrl.value, {
    method: "DELETE",
  })
    .then(() => {
      store.dispatch('updateProfile', {
        ...profile.value,
        orcid: null,
      })

      instance.proxy.$message({
        message: 'Your ORCID has been successfully removed',
        type: 'success',
        center: true,
        duration: 3000,
        showClose: true
      })

      isDeleteOrcidDialogVisible.value = false
    })
    .catch((error) => {
      console.error('ORCID delete error:', error)
      instance.proxy.$message({
        message: 'Failed to remove ORCID. Please try again.',
        type: 'error',
        center: true,
        duration: 5000,
        showClose: true
      })
    })
}

const fetchORCIDApiUrl = async () => {
  const token = await useGetToken()
  ORCIDApiUrl.value = `${siteConfig.apiUrl}/user/orcid?api_key=${token}`
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';
@use '../../../styles/element/dialog';


.user-orcid-container {
  margin: 0;
}

.orcid-content {
  h2 {
    font-weight: 300;
    font-size: 20px;
    margin-top: 0;
    color: theme.$gray_6;
    margin-bottom: 8px;
  }

  p {
    margin-bottom: 20px;
    font-weight: 300;
    font-size: 14px;
    color: theme.$gray_5;
    max-width: 500px;
    line-height: 1.5;

    a {
      color: theme.$purple_2;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

.orcid-connect {
  margin: 32px 0;
}

#connect-orcid-button {
  border: 1px solid #d3d3d3;
  padding: 12px 16px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 1px 1px 3px #999;
  cursor: pointer;
  color: #999;
  font-weight: bold;
  font-size: 14px;
  line-height: 24px;
  vertical-align: middle;
  display: flex;
  align-items: center;
  transition: all 0.2s ease;

  &:hover {
    border: 1px solid #338caf;
    color: #338caf;
  }

  #orcid-id-icon {
    margin-right: 8px;
  }
}

.orcid-connected {
  margin: 32px 0;

  .orcid-success-text {
    margin-bottom: 16px;
  }
}

.orcid-success {
  border: solid 1px #dadada;
  padding: 16px;
  display: flex;
  align-items: center;
  background: #fff;
  max-width: 500px;
  border-radius: 4px;

  img {
    width: 30px;
    height: 30px;
    margin-right: 12px;
  }

  .orcid-success-info {
    flex: 1;

    a {
      color: theme.$purple_2;
      text-decoration: none;
      font-family: monospace;
      font-size: 14px;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .orcid-delete-button {
    background: none;
    border: none;
    color: theme.$gray_4;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;

    &:hover {
      color: theme.$red_1;
      background: rgba(theme.$red_1, 0.1);
    }
  }
}

.orcid-waiting {
  padding: 30px 0;

  .orcid-loader {
    text-align: center;
    color: theme.$gray_4;
  }
}

.update-preferences {
  margin-top: 20px;
}

// Element Plus dialog styling
:deep(.el-dialog__header) {
  padding: 20px 20px 0 20px;
}

:deep(.el-dialog__body) {
  padding: 20px;

  ul {
    margin: 16px 0;
    padding-left: 20px;

    li {
      margin-bottom: 8px;
      color: theme.$gray_5;
    }
  }
}

:deep(.el-dialog__footer) {
  padding: 0 20px 20px 20px;
}
</style>