<template>
  <div class="user-github">
    <!-- As the Analysis views: the page's actions at the top right of its
         content (the intro row over the search), one primary action and a
         menu button beside it -->
    <AnalysisViewBar v-if="hasGithubProfile && !isLoading" actions-at="content">
      <bf-button @click="openAddRepository()">+ Add Repository</bf-button>
      <el-dropdown trigger="click" placement="bottom-end" @command="onMenu">
        <bf-button class="secondary code-menu" aria-label="More code actions">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </bf-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="github-settings">GitHub settings</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </AnalysisViewBar>

    <div v-if="isLoading" class="code-state">
      <div class="spinner" />
      <p>Loading GitHub integration…</p>
    </div>

    <div v-else-if="error" class="code-state">
      <p class="error-message">{{ error }}</p>
      <button type="button" class="link-button" @click="fetchGithubProfile">Try again</button>
    </div>

    <!-- Not connected: what to do first -->
    <div v-else-if="!hasGithubProfile" class="code-state">
      <IconGitHub :width="40" :height="40" color="#9ca3af" />
      <span class="code-state-title">GitHub isn't connected</span>
      <p>Connect your GitHub account to publish your repositories as apps or with DOIs.</p>
      <router-link to="/my-workspace/settings/integrations/github" class="connect-button">
        Connect GitHub
      </router-link>
    </div>

    <!-- The repositories, as the Apps tab's apps: the filters on the left,
         the search and Sort in one row, the chips and cards -->
    <FacetLayout
      v-else
      storage-key="pennsieve.code.filtersPanel"
      default-folded
      :chips="activeChips"
      @remove="removeChip"
      @clear-all="clearFacets"
    >
      <template #intro>
        <ContentIntro actions-id="analysis-content-actions" text="Your GitHub repositories: publish one to the App Store as an app, or release it with a DOI." />
      </template>

      <template #filters>
        <FacetSection
          v-if="destinationOptions.length"
          title="Releases go to"
          :clearable="destinationFilter.length > 0"
          @clear="clearFacet('destination')"
        >
          <FacetOptions :options="destinationOptions" :selected="destinationFilter" @toggle="(k) => (destinationFilter = toggleKey(destinationFilter, k))" />
        </FacetSection>
        <FacetSection title="App" :clearable="appFilter !== 'all'" @clear="clearFacet('app')">
          <FacetRadios v-model="appFilter" :options="APP_OPTIONS" label="App" />
        </FacetSection>
        <FacetSection title="Visibility" :clearable="visibilityFilter !== 'all'" @clear="clearFacet('visibility')">
          <FacetRadios v-model="visibilityFilter" :options="VISIBILITY_OPTIONS" label="Visibility" />
        </FacetSection>
      </template>

      <template #toolbar>
        <el-input
          v-model="reposSearchQuery"
          placeholder="Search by name or description…"
          clearable
          class="toolbar-search"
        />
        <label class="sort-control toolbar-sort">
          Sort
          <el-select v-model="sortBy" class="sort-select">
            <el-option v-for="o in REPO_SORTS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </label>
        <el-tooltip placement="bottom" content="Refresh the list">
          <button
            type="button"
            class="refresh-button"
            :disabled="refreshing"
            aria-label="Refresh the list"
            @click="refreshRepositories"
          >
            <el-icon :class="{ spinning: refreshing }"><Refresh /></el-icon>
          </button>
        </el-tooltip>
      </template>

      <div v-if="reposLoading && !repositories.length" class="code-state">
        <div class="spinner" />
        <p>Loading repositories…</p>
      </div>

      <div v-else-if="repositories.length === 0" class="empty-state">
        <span>The Pennsieve GitHub App doesn't see any repository yet</span>
        <button type="button" class="link-button" @click="openAddRepository()">Add a repository</button>
      </div>

      <div v-else-if="filteredRepositories.length === 0" class="empty-state">
        <span>No repositories match your search and filters</span>
        <button type="button" class="link-button" @click="clearFilters">Clear search and filters</button>
      </div>

      <template v-else>
        <p class="repos-count">
          {{ filteredRepositories.length }} of {{ repositories.length }} repositor{{ repositories.length === 1 ? 'y' : 'ies' }}
        </p>
        <div class="repos-grid">
          <code-repo-list-item
            v-for="repo in paginatedRepositories"
            :key="repo.id"
            :repo="repo"
            @manage-settings="openPublishingDialog"
            @setup="openAddRepository"
          />
        </div>

        <el-pagination
          v-if="filteredRepositories.length > pageSize"
          class="repos-pagination"
          :page-size="pageSize"
          :pager-count="5"
          :current-page="currentPage"
          layout="prev, pager, next"
          :total="filteredRepositories.length"
          @current-change="onPaginationPageChange"
        />
      </template>
    </FacetLayout>

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

    <!-- Add a repository: access, destinations, sharing, a release -->
    <add-repository-dialog
      v-model="showAddRepository"
      :initial-repo="addRepositoryInitial"
      @saved="refreshRepositories"
      @done="onRepositoryDone"
    />

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
import AddRepositoryDialog from '@/components/Analysis/Applications/AddRepositoryDialog.vue'
import { parseRepoInput } from '@/components/Analysis/Applications/addRepository'
import { Refresh } from '@element-plus/icons-vue'
import AnalysisViewBar from '@/components/Analysis/AnalysisViewBar.vue'
import ContentIntro from '@/components/shared/ContentIntro/ContentIntro.vue'
import FacetLayout from '@/components/Analysis/Facets/FacetLayout.vue'
import FacetSection from '@/components/Analysis/Facets/FacetSection.vue'
import FacetOptions from '@/components/Analysis/Facets/FacetOptions.vue'
import FacetRadios from '@/components/Analysis/Facets/FacetRadios.vue'
import { toggleKey } from '@/components/Analysis/Facets/facets'
import {
  APP_OPTIONS,
  REPO_FILTER_DEFAULTS,
  REPO_SORTS,
  VISIBILITY_OPTIONS,
  destinationFacets,
  filterRepos,
  repoActiveFilters,
  repoApp,
  sortRepos,
} from './codeRepos'

export default {
  name: 'UserGithubCode',

  components: {
    BfButton,
    IconGitHub,
    IconXCircle,
    CodeRepoListItem,
    PublishingDialog,
    AddRepositoryDialog,
    Refresh,
    AnalysisViewBar,
    ContentIntro,
    FacetLayout,
    FacetSection,
    FacetOptions,
    FacetRadios,
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
      selectedRepo: null,
      reposSearchQuery: '',
      // The filters and Sort, as the Apps tab's (codeRepos.js)
      destinationFilter: [],
      appFilter: 'all',
      visibilityFilter: 'all',
      sortBy: 'apps',
      APP_OPTIONS,
      VISIBILITY_OPTIONS,
      REPO_SORTS,

      // The Add repository wizard, and the repository it opens on
      // ({ owner, repo }) when started from a card or a link.
      showAddRepository: false,
      addRepositoryInitial: null,
      refreshTimers: [],
    }
  },

  beforeUnmount() {
    this.refreshTimers.forEach(clearTimeout)
  },

  computed: {
    hasGithubProfile() {
      return this.githubProfile && this.githubProfile.login
    },

    // Use store state for repositories
    repositories() {
      return this.$store.getters['codeReposModule/myRepos']
    },
    
    currentPage() {
      return this.$store.state.codeReposModule.myReposPaginationParams.currentPage
    },
    
    pageSize() {
      return this.$store.state.codeReposModule.myReposPaginationParams.size
    },
    
    myReposLoaded() {
      return this.$store.state.codeReposModule.myReposLoaded
    },

    applications() {
      return this.$store.state.analysisModule?.applications || []
    },

    // Whether a repository has an app (by its source URL).
    hasApp() {
      return (repo) => Boolean(repoApp(repo, this.applications))
    },

    // The filters' options, with their counts
    destinationOptions() {
      return destinationFacets(this.repositories)
    },
    activeChips() {
      return repoActiveFilters({ destination: this.destinationFilter, app: this.appFilter, visibility: this.visibilityFilter })
    },

    // What the list is filtered by, to start again on page 1 when it changes.
    filterKey() {
      return JSON.stringify([this.reposSearchQuery, this.destinationFilter, this.appFilter, this.visibilityFilter])
    },

    filteredRepositories() {
      const filters = {
        query: this.reposSearchQuery,
        destination: this.destinationFilter,
        app: this.appFilter,
        visibility: this.visibilityFilter,
      }
      return sortRepos(filterRepos(this.repositories, filters, this.hasApp), this.sortBy, this.hasApp)
    },

    paginatedRepositories() {
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredRepositories.slice(start, start + this.pageSize)
    },
  },

  watch: {
    filterKey() {
      // Back to the first page when the search or a filter changes, so a
      // shorter list doesn't strand the user on an empty page.
      if (this.currentPage !== 1) {
        this.$store.commit('codeReposModule/SET_MY_REPOS_CURRENT_PAGE', 1)
      }
    },
  },

  mounted() {
    this.fetchGithubProfile().then(() => this.openFromQuery())
  },

  methods: {
    onMenu(command) {
      if (command === 'github-settings') this.$router.push('/my-workspace/settings/integrations/github')
    },
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
        if (err && err.status === 404) {
          // No GitHub account connected — show the "Not Connected" state
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
      this.reposLoading = true

      try {
        await this.$store.dispatch('codeReposModule/fetchAllMyRepos')
        // Load published applications so repo cards can deep-link into the
        // application detail view when publishing_to_appstore is on.
        this.$store
          .dispatch('analysisModule/fetchApplications')
          .catch((err) =>
            console.error('Failed to fetch applications:', err)
          )
      } catch (err) {
        console.error('Error fetching repositories:', err)
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

    toggleKey,

    clearFacet(key, value) {
      const field = { destination: 'destinationFilter', app: 'appFilter', visibility: 'visibilityFilter' }[key]
      this[field] = value === undefined ? REPO_FILTER_DEFAULTS[key] : this[field].filter((k) => k !== value)
    },
    removeChip(chip) {
      this.clearFacet(chip.key, chip.value)
    },
    clearFacets() {
      ['destination', 'app', 'visibility'].forEach((key) => this.clearFacet(key))
    },
    clearFilters() {
      this.reposSearchQuery = ''
      this.clearFacets()
    },

    async refreshRepositories() {
      this.refreshing = true
      await this.fetchRepositories()
    },

    onPaginationPageChange(page) {
      // All repos are already loaded; just update the current page locally.
      this.$store.commit('codeReposModule/SET_MY_REPOS_CURRENT_PAGE', page)
    },

    // The wizard, on a repository when one is given (a card's "Set up", or
    // a link's ?add=owner/repo); otherwise where the draft left off.
    openAddRepository(repo = null) {
      const full = repo?.full_name || (repo?.html_url || repo?.url || '')
      this.addRepositoryInitial = parseRepoInput(full)
      this.showAddRepository = true
    },

    // Opened from a link: ?add=owner/repo starts the wizard on that
    // repository; GitHub's return after a change to the installation
    // (?setup_action=...) resumes it. The query is dropped once used.
    openFromQuery() {
      if (!this.hasGithubProfile) return
      const { add, setup_action: setupAction, installation_id: installationId, ...rest } = this.$route.query
      if (add === undefined && setupAction === undefined) return
      if (add) {
        this.addRepositoryInitial = parseRepoInput(add)
      } else {
        this.addRepositoryInitial = null
      }
      this.showAddRepository = true
      this.$router.replace({ query: rest }).catch(() => {})
    },

    // A release is under way: the App Store adds the app (or version) once
    // its image is built, Discover its publication; look again in a while.
    onRepositoryDone({ destinations = [] } = {}) {
      this.refreshRepositories()
      if (!destinations.includes('appstore')) return
      for (const delay of [60000, 150000]) {
        this.refreshTimers.push(setTimeout(() => {
          this.$store.dispatch('analysisModule/fetchApplications', { force: true }).catch(() => {})
        }, delay))
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
@use '../../../styles/_theme.scss' as theme;
@use '../../../styles/element/input';
@use '../../../styles/element/pagination';

/* As the Apps tab: no padding of its own (the filter panel sits against
   the page's edges; FacetLayout pads the list). */
.user-github {
  min-height: 100%;
  background: theme.$white;
}

/* The menu button: a square, as tall as the primary action beside it.
   More specific than the view bar's button sizing. */
.bf-button.bf-button.secondary.code-menu {
  aspect-ratio: 1;
  width: auto;
  padding: 0;
  justify-content: center;

  svg {
    display: block;
  }
}

/* The search fills the toolbar's row up to Sort and the refresh. */
.toolbar-search {
  flex: 1;
  min-width: 0;
}
.sort-control {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: theme.$gray_5;
}
.sort-select {
  width: 170px;
}
.refresh-button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$white;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
  &:disabled {
    cursor: default;
  }
  .spinning {
    animation: spin 1s linear infinite;
  }
}
@media (max-width: 767px) {
  .toolbar-sort {
    font-size: 0;
  }
  .sort-select {
    width: 130px;
  }
}

.repos-count {
  margin: 0 0 12px;
  font-size: 12px;
  color: theme.$gray_4;
}
/* As the app cards: two or more to a row where 340px each fit. */
.repos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr));
  gap: 16px;
}
.repos-pagination {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  --el-pagination-hover-color: #{theme.$purple_3};
}

/* Loading, an error, or GitHub not connected: centred, in the page. */
.code-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 64px 32px;
  text-align: center;

  p {
    max-width: 420px;
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: theme.$gray_5;
  }
  .error-message {
    color: theme.$red_1;
  }
}
.code-state-title {
  font-size: 16px;
  font-weight: 600;
  color: theme.$gray_6;
}
.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid theme.$gray_2;
  border-top-color: theme.$purple_2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.connect-button {
  padding: 8px 16px;
  border-radius: 4px;
  background: theme.$purple_3;
  color: theme.$white;
  font-size: 14px;
  text-decoration: none;

  &:hover {
    background: theme.$purple_2;
  }
}

/* As the Apps tab's: nothing to show, and what to do about it. */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px;
  border: 1px solid theme.$gray_2;
  background: theme.$gray_1;
  font-size: 14px;
  color: theme.$gray_5;
  text-align: center;
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

.link-button {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 13px;
  color: theme.$link-color;
  cursor: pointer;

  &:hover {
    color: theme.$link-color-hover;
  }
}
</style>
