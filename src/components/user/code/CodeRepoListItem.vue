<template>
  <div class="repo-card">
    <div class="repo-header">
      <div class="repo-info">
        <h3>{{ repo.full_name || repo.name }}</h3>
        <div class="repo-subtitle">GitHub Repository</div>
        <div v-if="repo.description" class="repo-description">
          {{ repo.description }}
        </div>
        <div class="repo-tags">
          <span
            v-if="matchedAppRaw && typeof matchedAppRaw.isPrivate === 'boolean'"
            class="tag"
            :class="matchedAppRaw.isPrivate ? 'private' : 'public'"
          >
            {{ matchedAppRaw.isPrivate ? 'Private' : 'Public' }}
          </span>
          <span v-if="repo.language" class="tag language">
            {{ repo.language }}
          </span>
        </div>
      </div>

      <div class="header-right">
        <div class="tracking-box">
          <div class="tracking-statuses">
            <div
              class="status-icon-row"
              :class="repo.publishing_to_discover ? 'enabled' : 'disabled'"
            >
              <span class="status-icon-label">Discover</span>
              <span class="status-icon-state">
                {{ repo.publishing_to_discover ? 'On' : 'Off' }}
              </span>
            </div>
            <div
              class="status-icon-row"
              :class="repo.publishing_to_appstore ? 'enabled' : 'disabled'"
            >
              <span class="status-icon-label">App Store</span>
              <span class="status-icon-state">
                {{ repo.publishing_to_appstore ? 'On' : 'Off' }}
              </span>
            </div>
          </div>
        </div>
        <button
          class="settings-button"
          type="button"
          title="Edit tracking settings"
          @click="handleManageSettings"
        >
          <IconSettings :width="20" :height="20" color="currentColor" />
        </button>
      </div>
    </div>

    <div class="repo-stats">
      <span v-if="repo.stargazers_count !== undefined" class="stat-item">
        ⭐ {{ repo.stargazers_count }}
      </span>
      <span v-if="repo.forks_count !== undefined" class="stat-item">
        🍴 {{ repo.forks_count }}
      </span>
      <span v-if="repo.updated_at" class="stat-item">
        Updated {{ formatDate(repo.updated_at) }}
      </span>
    </div>

    <div class="repo-card-actions">
      <a
        v-if="canShowExternalLinks"
        :href="repo.html_url || repo.url"
        target="_blank"
        rel="noopener noreferrer"
        class="card-action-link"
      >
        <IconGitHub :width="14" :height="14" color="currentColor" />
        <span>View on GitHub</span>
      </a>
      <span
        v-if="repo.publishing_to_appstore && !matchedAppRaw && !hasReleases"
        class="card-action-hint"
      >
        Create Github release to add to app store
      </span>
    </div>
  </div>
</template>

<script>
import IconGitHub from "@/components/icons/IconGitHub.vue";
import IconSettings from "@/components/icons/IconSettings.vue";

export default {
  name: 'CodeRepoListItem',

  components: {
    IconGitHub,
    IconSettings,
  },

  props: {
    repo: {
      type: Object,
      default: () => ({})
    }
  },

  computed: {
    applications() {
      return this.$store.state.analysisModule?.applications || []
    },

    profileId() {
      const profile = this.$store.state.profile || {}
      return profile.id || profile.intId || null
    },

    // Resolved by sourceUrl match — does NOT apply privacy gating, so the
    // template can decide which links to surface.
    matchedAppRaw() {
      const candidates = [this.repo.html_url, this.repo.url].filter(Boolean)
      if (candidates.length === 0) return null
      const normalize = (url) =>
        (url || '')
          .replace(/\.git$/, '')
          .replace(/\/+$/, '')
          .toLowerCase()
      const targets = new Set(candidates.map(normalize))
      return this.applications.find((a) => targets.has(normalize(a.sourceUrl))) || null
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

    // True when the repo already has at least one GitHub release. A repo that
    // has been released doesn't need another release to reach the App Store,
    // so the "create a release" hint should not be shown in that case.
    hasReleases() {
      return (this.repo?.content?.releases?.length || 0) > 0
    },
  },

  methods: {
    handleManageSettings() {
      this.$emit('manage-settings', this.repo)
    },

    formatDate(dateString) {
      if (!dateString) return ''
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = Math.abs(now - date)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays === 1) {
        return '1 day ago'
      } else if (diffDays < 30) {
        return `${diffDays} days ago`
      } else if (diffDays < 365) {
        const months = Math.ceil(diffDays / 30)
        return `${months} month${months > 1 ? 's' : ''} ago`
      } else {
        const years = Math.ceil(diffDays / 365)
        return `${years} year${years > 1 ? 's' : ''} ago`
      }
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.repo-card {
  background: white;
  border: 1px solid theme.$gray_2;
  padding: 20px;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: theme.$gray_3;
  }
}

.repo-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.repo-info {
  flex: 1;
  min-width: 0;

  h3 {
    font-size: 16px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  .repo-name-link {
    color: theme.$gray_6;
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
      color: theme.$purple_2;
      text-decoration: underline;
    }
  }
}

.repo-subtitle {
  font-size: 13px;
  color: theme.$gray_5;
  margin-bottom: 6px;
  font-weight: 400;
}

.repo-description {
  font-size: 13px;
  color: theme.$gray_5;
  margin: 4px 0 8px 0;
  line-height: 1.4;
  word-break: break-word;
}

.repo-tags {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;

  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    &.private {
      background: rgba(#EF4444, 0.1);
      color: #DC2626;
    }

    &.public {
      background: rgba(#10B981, 0.1);
      color: #059669;
    }

    &.language {
      background: theme.$gray_1;
      color: theme.$gray_5;
    }
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.settings-button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: theme.$gray_4;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: theme.$purple_2;
    background: rgba(theme.$purple_2, 0.08);
  }
}

.tracking-box {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tracking-box-title {
  font-size: 11px;
  font-weight: 600;
  color: theme.$gray_5;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.tracking-statuses {
  display: flex;
  gap: 6px;
}

.status-icon-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;

  &.enabled {
    background: rgba(theme.$status_green, 0.12);
    color: theme.$status_green;
  }

  &.disabled {
    background: theme.$gray_1;
    color: theme.$gray_4;
  }
}

.card-action-hint {
  margin-left: auto;
  font-size: 13px;
  font-weight: 500;
  color: theme.$gray_4;
  font-style: italic;
}

.repo-stats {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  font-size: 12px;
  color: theme.$gray_4;
  flex-wrap: wrap;

  .stat-item {
    white-space: nowrap;
  }
}

.repo-card-actions {
  display: flex;
  gap: 18px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid theme.$gray_2;
  flex-wrap: wrap;
}

.card-action-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: theme.$purple_3;
  text-decoration: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  .arrow {
    transition: transform 0.15s ease;
  }

  &:hover .arrow {
    transform: translateX(2px);
  }
}
</style>
