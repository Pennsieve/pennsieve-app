<template>
  <!-- A repository, as the Apps tab's cards: its name and whether it's
       public on top, the description, its latest release, then where its
       releases go; the actions over the foot's end on hover. -->
  <div class="repo-card">
    <div class="repo-title">
      <span class="repo-name" :title="fullName">{{ fullName }}</span>
      <span class="repo-badge">{{ repo.private ? 'Private' : 'Public' }}</span>
    </div>
    <p class="repo-description">{{ repo.description || 'No description.' }}</p>
    <div class="repo-meta">{{ release }}</div>
    <div class="repo-foot">
      <span class="repo-status" :title="status.title || ''">
        <span class="repo-dot" :class="status.state" />
        <span class="repo-status-text">{{ status.text }}</span>
      </span>
      <span class="repo-actions">
        <button
          v-if="!repo.publishing_to_appstore && !repo.publishing_to_discover"
          type="button"
          class="repo-action repo-action--primary"
          title="Choose where its releases go, who can use the app, and release it"
          @click="$emit('setup', repo)"
        >
          Set up
        </button>
        <button
          v-else-if="releaseRepo"
          type="button"
          class="repo-action repo-action--primary"
          :disabled="releaseLoading"
          :title="releaseTitle"
          @click="openRelease"
        >
          {{ releaseLoading ? 'Checking…' : 'Release' }}
        </button>
        <el-dropdown trigger="click" placement="bottom-end" @command="onMenu">
          <button type="button" class="repo-action repo-action--icon" aria-label="More: settings, GitHub, the app" title="More">
            <el-icon><MoreFilled /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-if="matchedApp" command="app">Open the app</el-dropdown-item>
              <el-dropdown-item command="settings">Where releases go…</el-dropdown-item>
              <el-dropdown-item v-if="canShowExternalLinks" command="github">View on GitHub</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </span>
    </div>
    <ReleaseDialog
      v-if="releaseRepo && releaseOpen"
      v-model="releaseOpen"
      :api2-url="api2Url"
      :repo="releaseRepo"
      :known-tags="knownTags"
      :status="releaseStatus"
      :default-branch="releaseStatus?.target || ''"
      @released="onReleased"
    />
  </div>
</template>

<script>
import { ElMessage } from "element-plus";
import { MoreFilled } from "@element-plus/icons-vue";
import ReleaseDialog from "@/components/Analysis/Applications/ReleaseDialog.vue";
import { fetchReleaseStatus } from "@/components/Analysis/Applications/release";
import { useGetToken } from "@/composables/useGetToken";
import { latestRelease, releaseLabel, repoApp, repoFullName, repoStatus } from "./codeRepos";

export default {
  name: 'CodeRepoListItem',

  components: {
    MoreFilled,
    ReleaseDialog,
  },

  data() {
    return {
      // Release from here, as on an app's page: an app's first release is
      // what adds it to the App Store, so it can't start from the app page.
      releaseOpen: false,
      releaseLoading: false,
      releaseStatus: null,
      releaseTimers: [],
    }
  },

  beforeUnmount() {
    this.releaseTimers.forEach(clearTimeout)
  },

  props: {
    repo: {
      type: Object,
      default: () => ({})
    }
  },

  emits: ['manage-settings', 'setup'],

  computed: {
    applications() {
      return this.$store.state.analysisModule?.applications || []
    },

    profileId() {
      const profile = this.$store.state.profile || {}
      return profile.id || profile.intId || null
    },

    fullName() {
      return repoFullName(this.repo)
    },

    // Resolved by sourceUrl match — does NOT apply privacy gating, so the
    // template can decide which links to surface.
    matchedAppRaw() {
      return repoApp(this.repo, this.applications)
    },

    // True when there's a matched app, it's private, and the viewer is
    // neither the owner nor someone we can confirm has explicit access.
    isPrivateUnowned() {
      const app = this.matchedAppRaw
      if (!app) return false
      if (app.isPrivate !== true) return false
      return !this.profileId || app.ownerId !== this.profileId
    },

    // Privacy-aware match used by template links so non-owners aren't
    // routed to an access-denied detail screen.
    matchedApp() {
      return this.isPrivateUnowned ? null : this.matchedAppRaw
    },

    // Hides the View on GitHub link in the same scenarios where the
    // application detail link is hidden: a private matched app the
    // viewer doesn't own. Repos without a matched app keep the link.
    canShowExternalLinks() {
      return !this.isPrivateUnowned
    },

    // Where its releases go, for the foot.
    status() {
      return repoStatus(this.repo, { hasApp: Boolean(this.matchedAppRaw) })
    },
    release() {
      return releaseLabel(this.repo)
    },

    api2Url() {
      return this.$store.state.config?.api2Url || ''
    },
    // { owner, repo } from the repository's full name or its URL.
    releaseRepo() {
      const [owner, name] = this.fullName.split('/')
      return owner && name ? { owner, repo: name } : null
    },
    // Versions already released, so the dialog suggests the next one.
    knownTags() {
      const releases = this.repo?.content?.releases || this.repo?.releases || [latestRelease(this.repo)]
      return releases
        .map((r) => r?.label || r?.tag_name || r?.name)
        .filter(Boolean)
    },
    releaseTitle() {
      return this.repo.publishing_to_appstore
        ? 'Publish a GitHub release; the App Store adds the version'
        : 'Publish a GitHub release (turn on App Store tracking to add it to the App Store)'
    },
  },

  methods: {
    async openRelease() {
      this.releaseLoading = true
      try {
        const token = await useGetToken()
        this.releaseStatus = await fetchReleaseStatus(this.api2Url, this.releaseRepo, token)
        if (this.releaseStatus?.canRelease === false) {
          ElMessage({
            type: 'info',
            showClose: true,
            message: `Nothing new to release: the ${this.releaseStatus.target} branch is at ${this.releaseStatus.latestTag}.`,
          })
          return
        }
        this.releaseOpen = true
      } finally {
        this.releaseLoading = false
      }
    },
    // The App Store adds the version from the release webhook (and the app,
    // on a first release): look again after a minute or two.
    onReleased({ tag }) {
      ElMessage({
        type: 'success',
        showClose: true,
        message: this.repo.publishing_to_appstore
          ? `Released ${tag}. The App Store adds it in a minute or two.`
          : `Released ${tag}.`,
      })
      if (!this.repo.publishing_to_appstore) return
      for (const delay of [60000, 150000]) {
        this.releaseTimers.push(setTimeout(() => {
          this.$store.dispatch('analysisModule/fetchApplications', { force: true }).catch(() => {})
        }, delay))
      }
    },
    // The card's menu: its app, its settings, or GitHub.
    onMenu(command) {
      if (command === 'app') {
        this.$router.push({ name: 'my-application-detail', params: { uuid: this.matchedApp.uuid } })
      } else if (command === 'settings') {
        this.$emit('manage-settings', this.repo)
      } else if (command === 'github') {
        window.open(this.repo.html_url || this.repo.url, '_blank', 'noopener')
      }
    },
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss' as theme;

/* As an app card's text side (ApplicationsGrid): the same border, hover,
   type and foot; no banner. */
.repo-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  min-height: 140px;
  box-sizing: border-box;
  padding: 14px 16px 12px;
  border: 1px solid theme.$gray_2;
  background: theme.$white;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover,
  &:focus-within {
    border-color: theme.$purple_1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }
  &:hover .repo-actions,
  &:focus-within .repo-actions {
    opacity: 1;
    pointer-events: auto;
  }
}
.repo-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.repo-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
/* In the top-right corner: the badges line up down the grid. */
.repo-badge {
  flex-shrink: 0;
  margin-left: auto;
  padding: 0 6px;
  border-radius: 3px;
  background: theme.$gray_0;
  color: theme.$gray_5;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}
.repo-description {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 13px;
  line-height: 1.4;
  color: theme.$gray_5;
}
.repo-meta {
  font-size: 12px;
  color: theme.$gray_4;
}
/* One line at the foot: the status gives way (…) to the buttons. */
.repo-foot {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
}
.repo-status {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.repo-status-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.repo-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: theme.$gray_3;

  &.ok { background: theme.$status_green; }
  &.pending { background: #f59e0b; }
}
/* Over the status's end, on hover only (in the line on a touch screen). */
.repo-actions {
  position: absolute;
  right: 0;
  display: flex;
  gap: 6px;
  padding-left: 12px;
  background: linear-gradient(to right, rgba(255, 255, 255, 0), theme.$white 12px);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.repo-action {
  padding: 3px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}
.repo-action--icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 6px;
}
.repo-action--primary {
  border-color: theme.$purple_3;
  background: theme.$purple_3;
  color: theme.$white;

  &:hover {
    background: theme.$purple_2;
    color: theme.$white;
  }
}
@media (hover: none) {
  .repo-actions {
    position: static;
    flex-shrink: 0;
    margin-left: auto;
    padding-left: 0;
    background: none;
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
