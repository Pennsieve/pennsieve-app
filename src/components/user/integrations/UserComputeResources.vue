<script setup>
import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import { useRouter } from 'vue-router'
import IconArrowRight from '@/components/icons/IconArrowRight.vue'
import IconApi from '@/components/icons/IconApi.vue'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import ConnectAwsAccountDialog from './ConnectAwsAccountDialog.vue'
import { connectionState, stackConsoleUrl } from './awsConnect'

const store = useStore()
const router = useRouter()
const computeResourcesStore = useComputeResourcesStore()

const computeResources = computed(() => computeResourcesStore.computeAccounts)
const isLoading = computed(() => computeResourcesStore.isLoadingComputeAccounts)

onMounted(async () => {
  await computeResourcesStore.fetchComputeAccounts()
})

function formatAccountId(accountId) {
  if (!accountId) return ''
  if (accountId.length === 12) {
    return `${accountId.slice(0, 4)}-${accountId.slice(4, 8)}-${accountId.slice(8)}`
  }
  return accountId
}

function getResourceTypeLabel(type) {
  switch (type) {
    case 'AWS': return 'Amazon Web Services'
    case 'GCP': return 'Google Cloud Platform'
    case 'AZURE': return 'Microsoft Azure'
    default: return type || 'Unknown'
  }
}

function getStatusLabel(resource) {
  return resource.status ? resource.status.charAt(0).toUpperCase() + resource.status.slice(1).toLowerCase() : 'Enabled'
}

// Connect a new account, or upgrade one an older agent registered.
const connectVisible = ref(false)
const upgrading = ref(null)
// Hidden for the session once this Pennsieve says it can't switch roles yet.
const upgradeAvailable = ref(true)
function openConnect() {
  upgrading.value = null
  connectVisible.value = true
}
function openUpgrade(resource) {
  upgrading.value = resource
  connectVisible.value = true
}
// The account's own role details are the owner's (blanked for others), so an
// account without a role name isn't one this user can upgrade.
const canUpgrade = (resource) =>
  upgradeAvailable.value && !!resource.roleName && connectionState(resource)?.kind === 'legacy'

function navigateToDetail(resource) {
  router.push({ name: 'user-compute-resource-detail', params: { accountId: resource.uuid } })
}
</script>

<template>
  <div class="compute-resources-container">
    <div class="resources-content">
      <!-- Setup Information Section -->
      <div class="info-section">
        <div class="info-card">
          <h3>Setting Up Compute Resources</h3>
          <p>
            Compute resources are your own cloud accounts (AWS) that Pennsieve runs compute nodes in.
            As their owner, you choose which workspaces can create compute nodes on them.
          </p>
          <div class="connect-row">
            <bf-button @click="openConnect">Connect AWS account</bf-button>
          </div>
          <div class="documentation-link">
            <a href="https://docs.pennsieve.io/docs/registering-a-compute-resource" target="_blank" class="doc-link">
              View Full Documentation
              <IconArrowRight :width="14" :height="14" style="margin-left: 4px;" />
            </a>
          </div>
        </div>
      </div>

      <!-- Resources List -->
      <div class="resources-section" v-loading="isLoading">
        <h3>Your Compute Resources</h3>

        <div v-if="computeResources.length === 0 && !isLoading" class="empty-state">
          <div class="empty-icon">
            <IconApi :width="48" :height="48" />
          </div>
          <h3>No Compute Resources Found</h3>
          <p>
            You haven't connected a cloud account yet. Connect your AWS account to run compute nodes in it.
          </p>
          <bf-button class="empty-connect" @click="openConnect">Connect AWS account</bf-button>
        </div>

        <div v-else class="resources-grid">
          <div
            v-for="resource in computeResources"
            :key="resource.uuid"
            class="resource-card"
            @click="navigateToDetail(resource)"
          >
            <div class="resource-info">
              <h3>
                <span v-if="resource.name">{{ resource.name }}</span>
                <span v-else>{{ getResourceTypeLabel(resource.accountType) }} Account</span>
              </h3>
              <div class="resource-subtitle" v-if="resource.name">
                {{ getResourceTypeLabel(resource.accountType) }} Account
              </div>
              <div class="resource-description" v-if="resource.description">
                {{ resource.description }}
              </div>
              <div class="resource-account">
                <strong>Account ID:</strong> {{ formatAccountId(resource.accountId) }}
              </div>
            </div>
            <div class="resource-card-right">
              <template v-if="connectionState(resource)?.kind === 'legacy' && resource.roleName">
                <span class="connection-badge">Older connection</span>
                <bf-button v-if="canUpgrade(resource)" class="secondary compact flex" @click.stop="openUpgrade(resource)">
                  Upgrade
                </bf-button>
              </template>
              <a
                v-else-if="connectionState(resource)?.kind === 'outdated'"
                class="connection-badge connection-badge--update"
                :href="stackConsoleUrl(resource.roleName)"
                target="_blank"
                rel="noopener"
                title="A newer version of Pennsieve's role template is out: update the stack in your AWS console"
                @click.stop
              >Update available</a>
              <span :class="['status-badge', getStatusLabel(resource).toLowerCase()]">
                {{ getStatusLabel(resource) }}
              </span>
              <IconArrowRight :width="20" :height="20" class="arrow-icon" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConnectAwsAccountDialog
      v-model="connectVisible"
      :account="upgrading"
      @upgrade-unavailable="upgradeAvailable = false"
    />
  </div>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.compute-resources-container {
  max-width: 1000px;
  margin: 16px;
}

h2 {
  font-weight: 300;
  font-size: 24px;
  color: theme.$gray_6;
  margin-bottom: 8px;
}

.info-section {
  margin-bottom: 24px;
}

.info-card {
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  padding: 24px;

  h3 {
    font-size: 16px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 12px 0;
  }

  p {
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.6;
    margin: 0 0 12px 0;
  }
}

.connect-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin: 16px 0 4px;
}
.connection-badge {
  display: inline-block;
  padding: 4px 8px;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  background: theme.$white;
  font-size: 11px;
  font-weight: 500;
  color: theme.$gray_5;
  text-decoration: none;

  &--update {
    border-color: theme.$orange_1;
    color: theme.$orange_2;
  }
}
.empty-connect {
  margin-top: 16px;
}
.setup-steps {
  margin: 16px 0;

  h4 {
    font-size: 14px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  ol {
    margin: 0;
    padding-left: 20px;
    color: theme.$gray_5;
    font-size: 14px;
    line-height: 1.8;
  }
}

.documentation-link {
  margin-top: 16px;

  .doc-link {
    display: inline-flex;
    align-items: center;
    font-size: 14px;
    color: theme.$purple_3;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.resources-section {
  h3 {
    font-size: 16px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 16px 0;
  }
}

.resources-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.resource-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  border: 1px solid theme.$gray_2;
  padding: 20px 24px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$gray_3;
    background: theme.$gray_1;

    .arrow-icon {
      transform: translateX(4px);
    }
  }
}

.resource-info {
  flex: 1;

  h3 {
    font-size: 16px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 4px 0;
  }
}

.resource-subtitle {
  font-size: 13px;
  color: theme.$gray_5;
  margin-bottom: 4px;
}

.resource-description {
  font-size: 14px;
  color: theme.$gray_5;
  margin: 4px 0;
}

.resource-account {
  font-size: 13px;
  color: theme.$gray_5;
  margin-top: 4px;

  strong {
    color: theme.$gray_6;
    font-weight: 500;
  }
}

.resource-card-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.arrow-icon {
  color: theme.$gray_4;
  transition: transform 0.2s ease;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: 3px;

  &.enabled {
    background: rgba(#10B981, 0.1);
    color: #059669;
  }

  &.paused {
    background: rgba(#F59E0B, 0.1);
    color: #D97706;
  }
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;

  .empty-icon {
    margin-bottom: 16px;
    color: theme.$gray_4;
  }

  h3 {
    font-size: 18px;
    color: theme.$gray_6;
    margin-bottom: 8px;
  }

  p {
    font-size: 14px;
    color: theme.$gray_5;
    max-width: 480px;
    margin: 0 auto;
    line-height: 1.5;
  }
}
</style>
