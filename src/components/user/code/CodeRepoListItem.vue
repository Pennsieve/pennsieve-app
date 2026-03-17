<template>
  <div class="repo-list-item">
    <div class="repo-content">
      <!-- Header with title and status -->
      <div class="repo-header">
        <div class="repo-title-section">
          <a
            :href="repo.url || repo.html_url"
            target="_blank"
            class="repo-name-link"
            :title="`View ${repo.full_name || repo.name} on GitHub`"
          >
            <IconGitHub/>
            <h3 class="repo-name">{{ repo.full_name || repo.name }}</h3>
          </a>
          <div class="repo-badges">
            <span v-if="repo.private" class="privacy-badge private">Private</span>
            <span class="repo-language" v-if="repo.language">{{ repo.language }}</span>
          </div>
        </div>
        <div class="publishing-box">
          <div class="publishing-box-header">
            <span class="publishing-box-title">Publishing Settings</span>
            <button
              class="settings-button"
              @click="handleManageSettings"
              title="Edit publishing settings"
            >
              <IconSettings :width="24" :height="24" />
            </button>
          </div>
          <div class="publishing-box-rows">
            <div class="status-icon-row discover" :class="repo.publishing_to_discover ? 'enabled' : 'disabled'">
              <span class="status-icon-label">Discover</span>
              <span class="status-icon-state">{{ repo.publishing_to_discover ? 'On' : 'Off' }}</span>
            </div>
            <div class="status-icon-row appstore" :class="repo.publishing_to_appstore ? 'enabled' : 'disabled'">
              <span class="status-icon-label">App Store</span>
              <span class="status-icon-state">{{ repo.publishing_to_appstore ? 'On' : 'Off' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Description and stats -->
      <div class="repo-details">
        <p class="repo-description" v-if="repo.description">
          {{ repo.description }}
        </p>

        <div class="repo-stats">
          <span class="stat-item" v-if="repo.stargazers_count !== undefined">
            ⭐ {{ repo.stargazers_count }}
          </span>
          <span class="stat-item" v-if="repo.forks_count !== undefined">
            🍴 {{ repo.forks_count }}
          </span>
          <span class="stat-item" v-if="repo.updated_at">
            Updated {{ formatDate(repo.updated_at) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import IconSettings from '@/components/icons/IconSettings.vue'
import IconGitHub from "@/components/icons/IconGitHub.vue";

export default {
  name: 'CodeRepoListItem',

  components: {
    IconGitHub,
    BfButton,
    IconSettings
  },

  props: {
    repo: {
      type: Object,
      default: () => ({})
    }
  },

  computed: {
    hasPublishingInfo() {
      return this.repo.publishing_to_discover || this.repo.publishing_to_appstore
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

.repo-list-item {
  background: white;
  border: 1px solid theme.$gray_2;
  //border-radius: 4px;
  //margin-bottom: 8px;
  transition: all 0.2s ease;
  overflow: hidden;
  max-width: 1200px;

  &:hover {
    border-color: theme.$gray_3;
    background: theme.$gray_1;
    //box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
}

.repo-content {
  padding: 24px;
}

// Header section with title, badges, status, and action
.repo-header {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 16px;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 12px;
  }
}

.repo-title-section {
  flex: 1;
  min-width: 0;
}

.repo-name-link {
  text-decoration: none;
  color: inherit;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  &:hover {
    text-decoration: none;

    .repo-name {
      color: theme.$purple_2;
    }
  }
}

.repo-name {
  font-size: 20px;
  font-weight: 400;
  color: theme.$purple_2;
  margin: 0;
  line-height: 1.3;
  transition: color 0.2s ease;
}

.repo-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.privacy-badge {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;

  &.private {
    background: lighten(theme.$red_1, 35%);
    color: theme.$red_1;
  }
}

.repo-language {
  font-size: 12px;
  color: theme.$gray_5;
  background: theme.$gray_1;
  padding: 3px 8px;
  border-radius: 12px;
  font-weight: 500;
}

// Publishing settings box
.publishing-box {
  flex-shrink: 0;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  padding: 16px 20px;
  min-width: 240px;

  @media (max-width: 768px) {
    width: 100%;
  }
}

.publishing-box-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.publishing-box-title {
  font-size: 11px;
  font-weight: 600;
  color: theme.$gray_5;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.publishing-box-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-icon-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;

  .status-icon-label {
    font-weight: 600;
  }

  .status-icon-state {
    font-weight: 600;
    margin-left: auto;
  }

  &.enabled {
    background: lighten(theme.$status_green, 40%);
    color: theme.$status_green;
  }

  &.disabled {
    background: lighten(theme.$gray_4, 25%);
    color: theme.$gray_4;
  }
}

.settings-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: theme.$gray_4;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: theme.$gray_5;
    background: theme.$gray_2;
  }

  &:focus {
    outline: none;
    color: theme.$purple_2;
  }
}

// Details section
.repo-details {
  .repo-description {
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;
    margin: 0 0 16px 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .repo-stats {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;

    .stat-item {
      font-size: 13px;
      color: theme.$gray_4;
      display: flex;
      align-items: center;
      gap: 5px;
      font-weight: 500;
    }
  }
}

// Button overrides
:deep(.bf-button) {
  &.small {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    min-width: auto;
    white-space: nowrap;
  }
}
</style>
