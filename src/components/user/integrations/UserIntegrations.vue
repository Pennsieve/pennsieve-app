<template>
  <div class="user-integrations-container">
    <div class="integrations-content">
      <!-- Show integrations grid only when at exact integrations route -->
      <div v-if="$route.name === 'user-integrations'" class="integrations-grid">
        <!-- ORCID Integration -->
        <IntegrationCard
          title="ORCID"
          description="Connect your ORCID identifier for research attribution"
          :icon-src="orcidImage"
          :icon-width="32"
          :icon-height="32"
          icon-class="orcid"
          :status="hasOrcid ? 'connected' : 'disconnected'"
          :status-text="hasOrcid ? 'Connected' : 'Not Connected'"
          :status-detail="hasOrcid ? orcidId : ''"
          :route="{ name: 'user-orcid' }"
          :action-text="hasOrcid ? 'Manage ORCID' : 'Connect ORCID'"
        />

        <!-- GitHub Integration -->
        <IntegrationCard
          title="GitHub"
          description="Link your GitHub account for code repository integration"
          icon="IconGitHub"
          icon-class="github"
          :status="hasGithub ? 'connected' : 'disconnected'"
          :status-text="hasGithub ? 'Connected' : 'Not Connected'"
          :status-detail="hasGithub ? githubUsername : ''"
          :route="{ name: 'user-github' }"
          :action-text="hasGithub ? 'Manage GitHub' : 'Connect GitHub'"
        >
          <template #actions v-if="hasGithub">
            <router-link :to="{ name: 'user-github' }" class="btn-configure">
              Manage GitHub
            </router-link>
            <bf-button @click="updateGithubIntegration" class="secondary">
              Update Integration
            </bf-button>
          </template>
        </IntegrationCard>

        <!-- API Keys Integration -->
        <IntegrationCard
          title="API Keys"
          description="Generate and manage API keys for programmatic access"
          icon="IconApi"
          icon-class="api"
          status="info"
          status-text=""
          :route="{ name: 'user-api' }"
          action-text="Manage API Keys"
        />

        <!-- Future Integrations Placeholder -->
<!--        <div class="integration-card coming-soon">-->
<!--          <div class="integration-header">-->
<!--            <div class="integration-icon future">-->
<!--              <IconIntegrations :width="32" :height="32" />-->
<!--            </div>-->
<!--            <div class="integration-info">-->
<!--              <h3>More Integrations</h3>-->
<!--              <p>Additional platform integrations coming soon</p>-->
<!--            </div>-->
<!--          </div>-->
<!--          -->
<!--          <div class="integration-status">-->
<!--            <div class="status coming-soon">-->
<!--              <span class="status-indicator coming-soon"></span>-->
<!--              <span>Coming Soon</span>-->
<!--            </div>-->
<!--          </div>-->

<!--          <div class="integration-actions">-->
<!--            <button class="btn-configure disabled" disabled>-->
<!--              Coming Soon-->
<!--            </button>-->
<!--          </div>-->
<!--        </div>-->
      </div>
      
      <!-- Render child routes when not at exact integrations route -->
      <router-view v-if="$route.name !== 'user-integrations'" name="stage" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { useGithubOAuth } from '@/composables/useGithubOAuth'
import IntegrationCard from './IntegrationCard.vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import orcidImage from '@/assets/images/orcid_24x24.png'

const store = useStore()

const profile = computed(() => store.state.profile)

const hasOrcid = computed(() => {
  return profile.value?.orcid && profile.value.orcid.orcid
})

const orcidId = computed(() => {
  return profile.value?.orcid?.orcid || ''
})

const hasGithub = computed(() => {
  return profile.value?.githubProfile && profile.value.githubProfile.login
})

const githubUsername = computed(() => {
  return profile.value?.githubProfile?.login || ''
})

const { openGithubOAuth: updateGithubIntegration, fetchGithubProfile } = useGithubOAuth({
  successMessage: 'Your GitHub integration has been updated!',
  errorMessage: 'Failed to update GitHub integration. Please try again.',
  refreshRepos: true,
})

onMounted(async () => {
  // Only fetch GitHub profile if we don't already have it
  if (!profile.value?.githubProfile) {
    await fetchGithubProfile()
  }
})
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.user-integrations-container {
  padding: 40px;
  max-width: 1000px;
  margin: 0;
}

.integrations-content {
  h2 {
    font-weight: 300;
    font-size: 20px;
    margin-top: 0;
    color: theme.$gray_6;
    margin-bottom: 8px;
  }
}

.integrations-note {
  background: #e3f2fd;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 32px;
  font-weight: 300;
  line-height: 21px;
  color: theme.$gray_5;
  border-left: 4px solid #2196f3;
}

.integrations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
}

// Custom actions styling for GitHub integration
:deep(.integration-actions) {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;

  .btn-configure {
    display: inline-block;
    padding: 12px 16px;
    background: theme.$purple_2;
    color: white;
    text-decoration: none;
    border-radius: 3px;
    font-size: 14px;
    line-height: 1;
    outline: none;
    font-weight: 500;
    border: 1px solid theme.$purple_2;
    cursor: pointer;
    transition: background 0.2s ease;
    align-content: center;

    &:hover:not(.disabled) {
      &:hover,
      &:focus {
        background: theme.$purple_3;
      }
      &:hover {
        box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.25);
      }
      &:active {
        box-shadow: none;
      }
    }

    &.secondary {
      background: theme.$gray_3;
      color: theme.$gray_6;

      &:hover {
        background: theme.$gray_4;
        color: white;
      }
    }

    &.disabled {
      background: theme.$gray_3;
      color: theme.$gray_4;
      cursor: not-allowed;
    }
  }
}
</style>