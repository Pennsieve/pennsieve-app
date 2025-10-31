<template>
  <div class="user-github">
    <div class="github-header">
      <p class="page-description">
        Connect your GitHub account to track and publish your repositories. Each time you create a release, 
        Pennsieve will archive the version, create a citable DOI, and generate a landing page.
      </p>
    </div>

    <!-- GitHub Account Linking Section -->
    <div class="github-section">
      <div class="section-header">
      </div>
      
      <div class="section-content">
        <div v-if="isLoading" class="loading-state">
          <div class="loading-spinner">
            <div class="spinner"></div>
          </div>
          <p>Loading GitHub integration...</p>
        </div>

        <div v-else-if="error" class="error-state">
          <p class="error-message">{{ error }}</p>
          <button @click="fetchGithubProfile" class="retry-button">
            Try Again
          </button>
        </div>

        <div v-else>
          <!-- Not Connected State -->
          <div v-if="!hasGithubProfile" class="not-connected">
            <div class="not-connected-content">
              <IconGitHub :width="48" :height="48" color="#666" />
              <h3>GitHub Account Not Connected</h3>
              <p>
                Connect your GitHub account to track and publish your repositories with DOIs.
              </p>
              <router-link to="/my-workspace/settings/integrations/github" class="connect-button">
                Connect GitHub Account
              </router-link>
            </div>
          </div>

          <!-- Connected State -->
          <div v-else class="github-connected">
<!--            <div class="connection-info">-->
<!--              <div class="github-profile">-->
<!--                <IconGitHub :width="32" :height="32" color="#333" />-->
<!--                <div class="profile-details">-->
<!--                  <h3>{{ githubProfile.login }}</h3>-->
<!--                  <p>GitHub account successfully connected</p>-->
<!--                  <a-->
<!--                    :href="githubProfile.html_url"-->
<!--                    target="_blank"-->
<!--                    class="profile-link"-->
<!--                  >-->
<!--                    View GitHub Profile-->
<!--                  </a>-->
<!--                </div>-->
<!--                <button-->
<!--                  @click="showDisconnectDialog = true"-->
<!--                  class="disconnect-button"-->
<!--                  title="Disconnect GitHub Account"-->
<!--                >-->
<!--                  <IconXCircle :width="16" :height="16" color="#666" />-->
<!--                </button>-->
<!--              </div>-->
<!--            </div>-->

            <!-- Repositories Section -->
            <div class="repositories-section">
              <div class="repos-header">
                <h3>My Repositories ({{ totalRepoCount }})</h3>
                <div class="header-actions">

                  <el-tooltip
                    ref="refresh-tooltip"
                    placement="bottom-end"
                    content="Refresh list"
                  >
                    <button @click="refreshRepositories" class="refresh-icon-button" :disabled="refreshing" :title="refreshing ? 'Refreshing...' : 'Refresh'">
                      <el-icon :class="{ spinning: refreshing }">
                        <Refresh />
                      </el-icon>
                    </button>
                  </el-tooltip>

                  <router-link to="/my-workspace/settings/integrations/github" class="manage-link">
                    Manage GitHub Settings
                  </router-link>
                </div>
              </div>

              <div v-if="reposLoading" class="loading-state">
                <div class="loading-spinner">
                  <div class="spinner"></div>
                </div>
                <p>Loading repositories...</p>
              </div>

              <div v-else-if="repositories.length === 0" class="empty-repos">
                <p>No repositories found. Make sure you have repositories in your connected GitHub account.</p>
              </div>

              <div v-else class="repos-list">
                <code-repo-list-item
                  v-for="repo in repositories"
                  :key="repo.id"
                  :repo="repo"
                  @manage-settings="openPublishingDialog"
                />
              </div>

              <!-- Pagination -->
              <div v-if="totalRepoCount > pageSize" class="pagination">
                <button
                  @click="previousPage"
                  :disabled="currentPage === 1"
                  class="page-button"
                >
                  Previous
                </button>
                <span class="page-info">
                  Page {{ currentPage }} of {{ totalPages }}
                </span>
                <button
                  @click="nextPage"
                  :disabled="currentPage === totalPages"
                  class="page-button"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Disconnect Confirmation Dialog -->
    <div v-if="showDisconnectDialog" class="dialog-overlay" @click="showDisconnectDialog = false">
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h3>Disconnect GitHub Account</h3>
        </div>
        <div class="dialog-content">
          <p>
            Are you sure you want to disconnect your GitHub account? This will stop tracking 
            all repositories and remove publishing capabilities.
          </p>
        </div>
        <div class="dialog-actions">
          <button @click="showDisconnectDialog = false" class="cancel-button">
            Cancel
          </button>
          <button @click="disconnectGithub" class="disconnect-confirm-button" :disabled="disconnecting">
            {{ disconnecting ? 'Disconnecting...' : 'Disconnect' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Publishing Dialog -->
    <publishing-dialog
      v-if="showPublishingDialog"
      :repo="selectedRepo"
      :dialog-visible="showPublishingDialog"
      @close="closePublishingDialog"
      @save="handlePublishingSave"
    />
  </div>
</template>

<script>
import { useGetToken } from '@/composables/useGetToken'
import { useSendXhr } from '@/mixins/request/request_composable'
import * as siteConfig from '@/site-config/site.json'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import IconGitHub from '@/components/icons/IconGitHub.vue'
import IconXCircle from '@/components/icons/IconXCircle.vue'
import CodeRepoListItem from './CodeRepoListItem.vue'
import PublishingDialog from './PublishingDialog.vue'
import { Refresh } from '@element-plus/icons-vue'

export default {
  name: 'UserGithubCode',

  components: {
    BfButton,
    IconGitHub,
    IconXCircle,
    CodeRepoListItem,
    PublishingDialog,
    Refresh
  },

  data() {
    return {
      // GitHub Profile
      githubProfile: null,
      isLoading: false,
      error: '',
      connecting: false,
      
      // Loading states (UI specific)
      reposLoading: false,
      refreshing: false,
      
      // UI State
      showDisconnectDialog: false,
      disconnecting: false,
      showPublishingDialog: false,
      selectedRepo: null
    }
  },

  computed: {
    hasGithubProfile() {
      return this.githubProfile && this.githubProfile.login
    },
    
    // Use store state for repositories
    repositories() {
      return this.$store.getters['codeReposModule/myRepos']
    },
    
    totalRepoCount() {
      return this.$store.state.codeReposModule.myReposCount
    },
    
    currentPage() {
      return this.$store.state.codeReposModule.myReposPaginationParams.currentPage
    },
    
    pageSize() {
      return this.$store.state.codeReposModule.myReposPaginationParams.size
    },
    
    totalPages() {
      return Math.ceil(this.totalRepoCount / this.pageSize)
    },
    
    myReposLoaded() {
      return this.$store.state.codeReposModule.myReposLoaded
    }
  },

  mounted() {
    console.log('Store state keys:', Object.keys(this.$store.state))
    console.log('Store codeRepos state:', this.$store.state.codeRepos)
    console.log('Store modules:', this.$store._modules)
    this.fetchGithubProfile()
  },

  methods: {
    async fetchGithubProfile() {
      this.isLoading = true
      this.error = ''
      
      try {
        const token = await useGetToken()
        const url = `${siteConfig.api2Url}/accounts/github/user`
        
        const response = await useSendXhr(url, {
          method: 'GET',
          header: {
            Authorization: `Bearer ${token}`
          }
        })
        
        this.githubProfile = response
        
        if (this.hasGithubProfile) {
          await this.fetchRepositories()
        }
      } catch (err) {
        if (err.response && err.response.status === 404) {
          // No GitHub account connected - this is normal
          this.githubProfile = null
        } else {
          this.error = 'Failed to load GitHub profile. Please try again.'
          console.error('Error fetching GitHub profile:', err)
        }
      } finally {
        this.isLoading = false
      }
    },

    async fetchRepositories() {
      console.log('fetchRepositories called in component')
      this.reposLoading = true
      
      try {
        console.log('About to dispatch fetchMyRepos with:', { page: this.currentPage, size: this.pageSize })
        await this.$store.dispatch('codeReposModule/fetchMyRepos', {
          page: this.currentPage,
          size: this.pageSize
        })
        console.log('fetchMyRepos dispatch completed')
      } catch (err) {
        console.error('Error fetching repositories:', err)
        // Store handles setting empty state on error
      } finally {
        this.reposLoading = false
        this.refreshing = false
      }
    },

    async connectGithub() {
      this.connecting = true
      
      try {
        // This would typically open a popup for OAuth
        // For now, we'll show a placeholder message
        console.log('GitHub OAuth flow would be implemented here')
        // Placeholder for actual OAuth implementation
        alert('GitHub OAuth integration would be implemented here')
      } catch (err) {
        console.error('Error connecting GitHub:', err)
        this.error = 'Failed to connect GitHub account. Please try again.'
      } finally {
        this.connecting = false
      }
    },

    async disconnectGithub() {
      this.disconnecting = true
      
      try {
        const token = await useGetToken()
        const url = `${siteConfig.api2Url}/accounts/github/user`
        
        await useSendXhr(url, {
          method: 'DELETE',
          header: {
            Authorization: `Bearer ${token}`
          }
        })
        
        this.githubProfile = null
        // Clear store state
        this.$store.commit('codeReposModule/SET_MY_REPOS', [])
        this.$store.commit('codeReposModule/SET_MY_REPOS_COUNT', 0)
        this.showDisconnectDialog = false
      } catch (err) {
        console.error('Error disconnecting GitHub:', err)
        this.error = 'Failed to disconnect GitHub account. Please try again.'
      } finally {
        this.disconnecting = false
      }
    },

    async refreshRepositories() {
      this.refreshing = true
      await this.fetchRepositories()
    },

    previousPage() {
      if (this.currentPage > 1) {
        const newPage = this.currentPage - 1
        this.$store.commit('codeReposModule/SET_MY_REPOS_CURRENT_PAGE', newPage)
        this.fetchRepositories()
      }
    },

    nextPage() {
      if (this.currentPage < this.totalPages) {
        const newPage = this.currentPage + 1
        this.$store.commit('codeReposModule/SET_MY_REPOS_CURRENT_PAGE', newPage)
        this.fetchRepositories()
      }
    },

    openPublishingDialog(repo) {
      this.selectedRepo = repo
      this.showPublishingDialog = true
    },

    closePublishingDialog() {
      this.showPublishingDialog = false
      this.selectedRepo = null
    },

    async handlePublishingSave(saveData) {
      try {
        const { repo, settings } = saveData
        
        if (!repo || !repo.id) {
          console.error('No repository data found in save event')
          return
        }

        // Update the local repo in the store by refreshing the data
        this.closePublishingDialog()
        await this.refreshRepositories()
      } catch (error) {
        console.error('Error handling publishing save:', error)
        // You might want to show an error message to the user
      }
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';



.user-github {
  margin: 32px;
}

.github-header {
  margin-bottom: 32px;

  .page-description {
    font-size: 16px;
    color: theme.$gray_5;
    line-height: 1.6;
    margin: 0 0 24px 0;
    max-width: 800px;
  }
}

.github-section {
  background: white;
  margin-bottom: 24px;

  .section-header {
    &:empty {
      display: none;
    }

    &:not(:empty) {
      padding: 20px 24px 0;
      border-bottom: 1px solid theme.$gray_2;
      margin-bottom: 0;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;

      h2 {
        font-size: 18px;
        font-weight: 500;
        color: theme.$gray_6;
        margin: 0 0 20px 0;
      }

      .settings-link {
        color: theme.$purple_2;
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        padding: 4px 0;
        margin-bottom: 20px;

        &:hover {
          text-decoration: underline;
        }
      }
    }
  }

  .section-content {
  }
}

.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;

  .loading-spinner {
    margin-bottom: 16px;

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid theme.$gray_2;
      border-top: 3px solid theme.$purple_2;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  }

  p {
    color: theme.$gray_5;
    margin: 0;
  }

  .error-message {
    color: theme.$red_1;
    margin-bottom: 16px;
  }

  .retry-button {
    padding: 8px 16px;
    background: theme.$purple_2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s ease;

    &:hover {
      background: theme.$purple_3;
    }
  }
}

.not-connected {
  .not-connected-content {
    text-align: center;
    max-width: 500px;
    margin: 0 auto;
    padding: 40px 20px;

    h3 {
      font-size: 20px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 16px 0;
    }

    p {
      color: theme.$gray_5;
      line-height: 1.6;
      margin-bottom: 24px;
    }

    .connect-button {
      display: inline-block;
      padding: 12px 24px;
      background: theme.$purple_2;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
      transition: background 0.2s ease;

      &:hover {
        background: theme.$purple_3;
        text-decoration: none;
      }
    }
  }
}

.connect-github {
  .connect-content {
    text-align: center;
    max-width: 500px;
    margin: 0 auto;
    padding: 40px 20px;

    .connect-icon {
      margin-bottom: 20px;
    }

    h3 {
      font-size: 20px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0 0 16px 0;
    }

    p {
      color: theme.$gray_5;
      line-height: 1.6;
      margin-bottom: 24px;
    }

    .learn-more {
      margin-top: 16px;
      font-size: 14px;

      a {
        color: theme.$purple_2;
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}

.github-connected {
  .connection-info {
    margin-bottom: 32px;
  }

  .github-profile {
    display: flex;
    align-items: center;
    padding: 20px;
    background: theme.$gray_1;
    border-radius: 4px;
    gap: 16px;

    .profile-details {
      flex: 1;

      h3 {
        font-size: 16px;
        font-weight: 500;
        color: theme.$gray_6;
        margin: 0 0 4px 0;
      }

      p {
        font-size: 14px;
        color: theme.$gray_5;
        margin: 0 0 8px 0;
      }

      .profile-link {
        font-size: 14px;
        color: theme.$purple_2;
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .disconnect-button {
      background: none;
      border: none;
      padding: 8px;
      cursor: pointer;
      border-radius: 4px;
      transition: background 0.2s ease;

      &:hover {
        background: theme.$gray_2;
      }
    }
  }
}

.repositories-section {
  .repos-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    h3 {
      font-size: 16px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .manage-link {
      color: theme.$purple_2;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }
    }

    .refresh-icon-button {
      background: none;
      border: none;
      color: theme.$purple_2;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease;

      &:hover:not(:disabled) {
        background: rgba(theme.$purple_2, 0.1);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .el-icon {
        font-size: 16px;
        transition: transform 0.2s ease;

        &.spinning {
          animation: spin 1s linear infinite;
        }
      }
    }
  }

  .empty-repos {
    text-align: center;
    padding: 40px 20px;
    color: theme.$gray_5;
  }

  .repos-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    margin-top: 24px;

    .page-button {
      padding: 8px 16px;
      background: theme.$purple_2;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s ease;

      &:hover:not(:disabled) {
        background: theme.$purple_3;
      }

      &:disabled {
        background: theme.$gray_3;
        cursor: not-allowed;
      }
    }

    .page-info {
      color: theme.$gray_5;
      font-size: 14px;
    }
  }
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;

  .dialog {
    background: white;
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;

    .dialog-header {
      padding: 20px 24px 0;
      border-bottom: 1px solid theme.$gray_2;

      h3 {
        font-size: 18px;
        font-weight: 500;
        color: theme.$gray_6;
        margin: 0 0 20px 0;
      }
    }

    .dialog-content {
      padding: 24px;

      p {
        color: theme.$gray_5;
        line-height: 1.6;
        margin: 0;
      }
    }

    .dialog-actions {
      padding: 0 24px 24px;
      display: flex;
      gap: 12px;
      justify-content: flex-end;

      .cancel-button {
        padding: 8px 16px;
        background: theme.$gray_2;
        border: 1px solid theme.$gray_3;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s ease;

        &:hover {
          background: theme.$gray_3;
        }
      }

      .disconnect-confirm-button {
        padding: 8px 16px;
        background: theme.$red_1;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s ease;

        &:hover:not(:disabled) {
          background: darken(theme.$red_1, 10%);
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
    }
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>