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
        <div class="repo-status-and-actions">
          <div class="status-tag" :class="publishingStatusClass">
            {{ publishingStatusText }}
          </div>
          <button 
            class="settings-button"
            @click="handleManageSettings"
            title="Edit publishing settings"
          >
            <IconSettings :width="16" :height="16" />
          </button>
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

    publishingStatus() {
      const { publishing_to_discover: discover, publishing_to_appstore: appstore } = this.repo
      
      if (discover && !appstore) {
        return 'discover'
      }
      
      if (!discover && appstore) {
        return 'appstore'
      }
      
      if (discover && appstore) {
        return 'both'
      }
      
      return 'none'
    },

    publishingStatusText() {
      const { publishing_to_discover: discover, publishing_to_appstore: appstore } = this.repo
      
      // If both properties exist but are false, it's paused
      if ((discover === false && appstore === false) && 
          (discover !== undefined && appstore !== undefined)) {
        return 'Paused'
      }
      
      // If both are true
      if (discover === true && appstore === true) {
        return 'Discover, App'
      }
      
      // If only discover is true
      if (discover === true && !appstore) {
        return 'Discover'
      }
      
      // If only appstore is true
      if (!discover && appstore === true) {
        return 'App'
      }
      
      // If properties don't exist or are undefined/false, it's unpublished
      return 'Unpublished'
    },

    publishingStatusClass() {
      const { publishing_to_discover: discover, publishing_to_appstore: appstore } = this.repo
      
      // If both properties exist but are false, it's paused
      if ((discover === false && appstore === false) && 
          (discover !== undefined && appstore !== undefined)) {
        return 'status-paused'
      }
      
      // If both are true
      if (discover === true && appstore === true) {
        return 'status-both'
      }
      
      // If only discover is true
      if (discover === true && !appstore) {
        return 'status-discover'
      }
      
      // If only appstore is true
      if (!discover && appstore === true) {
        return 'status-app'
      }
      
      // If properties don't exist or are undefined/false, it's unpublished
      return 'status-unpublished'
    }
  },

  mounted() {
    console.log('CodeRepoListItem repo:', this.repo)
    console.log('Publishing status text:', this.publishingStatusText)
    console.log('Publishing status class:', this.publishingStatusClass)
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
@import '../../../styles/_theme.scss';

.repo-list-item {
  background: white;
  border: 1px solid $gray_2;
  border-radius: 4px;
  margin-bottom: 8px;
  transition: all 0.2s ease;
  overflow: hidden;

  &:hover {
    border-color: $gray_3;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
}

.repo-content {
  padding: 24px;
}

// Header section with title, badges, status, and action
.repo-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
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
      color: $purple_2;
    }
  }
}

.repo-name {
  font-size: 20px;
  font-weight: 400;
  color: $purple_2;
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
    background: lighten($red_1, 35%);
    color: $red_1;
  }
}

.repo-language {
  font-size: 12px;
  color: $gray_5;
  background: $gray_1;
  padding: 3px 8px;
  border-radius: 12px;
  font-weight: 500;
}

// Status and actions section
.repo-status-and-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    justify-content: space-between;
    width: 100%;
  }
}

.status-tag {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;

  &.status-unpublished {
    background: lighten($gray_4, 25%);
    color: $gray_4;
  }

  &.status-app {
    background: $purple_1;
    color: $purple_tint;
  }

  &.status-discover {
    background: $orange_1;
    color: $orange_tint;
  }

  &.status-both {
    background: lighten($status_green, 40%);
    color: $status_green;
  }

  &.status-paused {
    background: lighten($status_orange, 40%);
    color: $status_orange;
  }
}

.settings-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid $gray_3;
  border-radius: 6px;
  background: white;
  color: $gray_4;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: $gray_4;
    color: $gray_5;
    background: $gray_1;
  }
  
  &:focus {
    outline: none;
    border-color: $purple_2;
    color: $purple_2;
  }
}

// Details section
.repo-details {
  .repo-description {
    font-size: 14px;
    color: $gray_5;
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
      color: $gray_4;
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