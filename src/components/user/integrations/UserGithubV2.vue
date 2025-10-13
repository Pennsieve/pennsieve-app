<template>
  <div class="user-github-container">
    <div class="github-content">
      <h2>Link your GitHub account</h2>
      <p class="github-requirements">
        When you link your GitHub account to your Pennsieve account, you can
        select to track and publish repositories on Pennsieve. Each time you
        generate a release on a tracked repository, Pennsieve will archive the
        version, create a citable DOI and generate a landing page for that
        specific version of your code.
      </p>

      <div v-if="loading" class="loading">
        Loading...
      </div>
      <div v-else>
        <div v-if="!hasGithubProfile" class="github-connect">
          <p>
            Register the Pennsieve GitHub Application in your Github account,
            and authorize Pennsieve to get notified about events.
            <a href="https://docs.pennsieve.io/docs" target="_blank">Learn More</a>
          </p>
          <el-button type="primary" @click="openGitHub">
            Register your GitHub Account
          </el-button>
        </div>

        <div v-else class="github-connected">
          <p class="github-success-text">
            You have successfully linked your GitHub Account and installed the
            Pennsieve Github Application.
            <a
              href="https://docs.pennsieve.io/docs/github-integration"
              target="_blank"
            >
              Learn More
            </a>
          </p>
          <div class="integration-success">
            <IconGitHub :height="30" :width="30" />
            <a class="link" :href="displayGithubProfile.html_url" target="_blank">
              {{ displayGithubProfile.login }}
            </a>
            <button class="delete-button" @click="isDeleteDialogVisible = true">
              <IconRemove :height="10" :width="10" />
            </button>
          </div>
        </div>
      </div>

      <!-- Repository List (if connected) -->
      <div v-if="hasGithubProfile && showRepositories" class="repositories-section">
        <h3>My GitHub Repositories</h3>
        <p>
          Repositories can be published publically to Discover and/or to the
          App Store for users to include as part of analytic pipelines.
        </p>
        
        <div v-if="repoLoading" class="loading">
          Loading repositories...
        </div>
        <div v-else-if="repositories.length > 0" class="repo-list">
          <div 
            v-for="repo in repositories" 
            :key="repo.id" 
            class="repo-item"
          >
            <div class="repo-info">
              <h4>{{ repo.name }}</h4>
              <p>{{ repo.description || 'No description' }}</p>
              <div class="repo-meta">
                <span class="language">{{ repo.language }}</span>
                <span class="stars">⭐ {{ repo.stargazers_count }}</span>
              </div>
            </div>
            <div class="repo-actions">
              <el-button size="small" @click="manageRepo(repo)">
                Manage
              </el-button>
            </div>
          </div>
        </div>
        <div v-else class="no-repos">
          No repositories found.
        </div>
      </div>

      <el-dialog 
        v-model="isDeleteDialogVisible" 
        title="Delete GitHub Integration?"
        width="500px"
      >
        <p style="max-width: 450px">
          Are you sure you want to remove your linked GitHub account from your
          Pennsieve user profile?
        </p>
        <ul>
          <li>Pennsieve will no longer track GitHub repositories in your account.</li>
          <li>GitHub releases will no longer result in Pennsieve GitHub Publications.</li>
          <li>You can no longer create Applications and Workflows on Pennsieve.</li>
        </ul>

        <template #footer>
          <el-button @click="isDeleteDialogVisible = false">Cancel</el-button>
          <el-button type="danger" @click="confirmDelete">
            Confirm
          </el-button>
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
import IconGitHub from '@/components/icons/IconGitHub.vue'
import IconRemove from '@/components/icons/IconRemove.vue'

const store = useStore()
const instance = getCurrentInstance()

const profile = computed(() => store.state.profile)
const loading = ref(false)
const repoLoading = ref(false)
const isDeleteDialogVisible = ref(false)
const showRepositories = ref(true)
const repositories = ref([])
const githubProfile = ref({})
const oauthWindow = ref(null)

const hasGithubProfile = computed(() => {
  // Check both the local githubProfile and the store's profile
  return !!(githubProfile.value?.login || profile.value?.githubProfile?.login)
})

// Get the actual GitHub profile data from either local or store
const displayGithubProfile = computed(() => {
  return githubProfile.value?.login ? githubProfile.value : (profile.value?.githubProfile || {})
})

onMounted(() => {
  window.addEventListener('message', messageEventListener)
  initializeGithubData()
})

onBeforeUnmount(() => {
  window.removeEventListener('message', messageEventListener)
})

async function initializeGithubData() {
  loading.value = true
  
  // First try to fetch fresh GitHub data from API
  await fetchGithubProfile()
  
  // If API fetch fails, fall back to store data
  if (!githubProfile.value?.login && profile.value?.githubProfile) {
    githubProfile.value = profile.value.githubProfile
  }
  
  // Load repositories if we have GitHub profile
  if (hasGithubProfile.value && showRepositories.value) {
    await fetchRepositories()
  }
  
  loading.value = false
}

async function fetchGithubProfile() {
  try {
    const token = await useGetToken()
    const response = await fetch('https://api2.pennsieve.net/accounts/github/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': '*/*'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      
      if (data && data.login) {
        githubProfile.value = data
        
        // Update store with fresh data - ensure we're updating the githubProfile property
        const updatedProfile = {
          ...profile.value,
          githubProfile: data
        }
        
        store.dispatch('updateProfile', updatedProfile)
        
        console.log('Updated store with GitHub profile:', data)
      }
    } else {
      console.error('GitHub API response not ok:', response.status, response.statusText)
    }
  } catch (error) {
    console.error('Failed to fetch GitHub profile:', error)
    // We'll fall back to store data in initializeGithubData
  }
}

async function fetchRepositories() {
  if (!hasGithubProfile.value) return
  
  repoLoading.value = true
  try {
    const token = await useGetToken()
    const response = await useSendXhr('https://api2.pennsieve.net/accounts/github/repositories', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })
    
    if (response && Array.isArray(response)) {
      repositories.value = response
    }
  } catch (error) {
    console.error('Failed to fetch repositories:', error)
    repositories.value = []
  } finally {
    repoLoading.value = false
  }
}

function openGitHub() {
  const redirectUri = `${window.location.origin}/github-redirect`
  const githubAppUrl = siteConfig.githubAppUrl || 'https://github.com/apps/pennsieve'
  const url = `${githubAppUrl}?redirect_uri=${redirectUri}`
  
  oauthWindow.value = window.open(
    url,
    "_blank",
    "toolbar=no, scrollbars=yes, width=600, height=800, top=200, left=500"
  )
}

const messageEventListener = async (event) => {
  if (
    event.data &&
    event.data.source &&
    event.data.source === "github-redirect-response" &&
    event.data.code
  ) {
    const oauthCode = event.data.code
    if (oauthCode !== "") {
      try {
        const token = await useGetToken()
        const response = await useSendXhr(`${siteConfig.apiUrl}/user/github/register?api_key=${token}`, {
          method: "POST",
          body: {
            code: oauthCode,
            installation_id: event.data.installationId,
          },
        })

        githubProfile.value = response
        window.removeEventListener("message", messageEventListener)

        instance.proxy.$message({
          message: 'Your GitHub account has been successfully added!',
          type: 'success',
          center: true,
          duration: 3000,
          showClose: true
        })

        // Update store with fresh GitHub data
        const updatedProfile = {
          ...profile.value,
          githubProfile: response
        }
        
        store.dispatch('updateProfile', updatedProfile)
        console.log('Updated store with GitHub profile after registration:', response)

        if (showRepositories.value) {
          await fetchRepositories()
        }
      } catch (error) {
        console.error('GitHub registration error:', error)
        instance.proxy.$message({
          message: 'Failed to connect GitHub account. Please try again.',
          type: 'error',
          center: true,
          duration: 5000,
          showClose: true
        })
      }
    }
  }
}

async function confirmDelete() {
  try {
    const token = await useGetToken()
    await useSendXhr('https://api2.pennsieve.net/accounts/github/user', {
      method: "DELETE",
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })

    githubProfile.value = {}
    repositories.value = []
    isDeleteDialogVisible.value = false

    // Update store
    store.dispatch('updateProfile', {
      ...profile.value,
      githubProfile: null,
    })

    instance.proxy.$message({
      message: 'Your GitHub account has been successfully removed',
      type: 'success',
      center: true,
      duration: 3000,
      showClose: true
    })
  } catch (error) {
    console.error('GitHub deletion error:', error)
    instance.proxy.$message({
      message: 'Failed to remove GitHub account. Please try again.',
      type: 'error',
      center: true,
      duration: 5000,
      showClose: true
    })
  }
}

function manageRepo(repo) {
  // Placeholder for repository management functionality
  instance.proxy.$message({
    message: `Repository management for ${repo.name} coming soon!`,
    type: 'info',
    center: true,
    duration: 3000,
    showClose: true
  })
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.user-github-container {
  margin: 0;
}

.github-content {
  h2 {
    font-weight: 300;
    font-size: 20px;
    margin-top: 0;
    color: theme.$gray_6;
    margin-bottom: 8px;
  }

  h3 {
    font-weight: 500;
    font-size: 18px;
    color: theme.$gray_6;
    margin: 32px 0 16px 0;
  }

  p {
    margin-bottom: 20px;
    font-weight: 300;
    font-size: 14px;
    color: theme.$gray_5;
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

.loading {
  color: theme.$gray_4;
  padding: 16px 0;
  text-align: center;
}

.github-connect {
  margin: 32px 0;
}

.github-connected {
  margin: 32px 0;

  .github-success-text {
    margin-bottom: 16px;
  }
}

.integration-success {
  border: 1px solid theme.$gray_2;
  padding: 16px;
  display: flex;
  align-items: center;
  background: white;
  border-radius: 4px;
  max-width: 500px;

  .link {
    margin-left: 16px;
    color: theme.$purple_2;
    text-decoration: none;
    flex: 1;
    font-family: monospace;
    font-size: 14px;

    &:hover {
      text-decoration: underline;
    }
  }

  .delete-button {
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

.repositories-section {
  margin-top: 32px;
  padding-top: 32px;
  border-top: 1px solid theme.$gray_2;
}

.repo-list {
  margin-top: 16px;
}

.repo-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  margin-bottom: 12px;
  background: white;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$purple_3;
    background: theme.$purple_tint;
  }

  .repo-info {
    flex: 1;

    h4 {
      margin: 0 0 4px 0;
      font-size: 16px;
      font-weight: 500;
      color: theme.$gray_6;
    }

    p {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: theme.$gray_4;
    }

    .repo-meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: theme.$gray_4;

      .language {
        font-weight: 500;
      }
    }
  }

  .repo-actions {
    margin-left: 16px;
  }
}

.no-repos {
  text-align: center;
  color: theme.$gray_4;
  padding: 32px;
  background: theme.$gray_1;
  border-radius: 4px;
  margin-top: 16px;
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