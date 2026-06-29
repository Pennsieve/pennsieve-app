<template>
  <bf-stage slot="stage">
  <div class="section">
    <div class="section-header">
      <p class="section-description">A list of workspaces that you have access to. You can have access to many datasets within a workspace.</p>
    </div>

    <div v-if="sharedWorkspaces.length === 0" class="empty-state">
      <div class="empty-state-content">
        <IconOrganization :width="48" :height="48" color="#71747c" />
        <h3>No shared workspaces</h3>
        <p>You haven't been invited to any workspaces yet.</p>
      </div>
    </div>

    <div v-else class="workspace-grid">
      <WorkspaceCard
        v-for="workspace in sharedWorkspaces"
        :key="workspace.organization.id"
        :workspace="workspace"
      />
    </div>
  </div>
  </bf-stage>
</template>

<script>
import { mapGetters } from 'vuex'
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import IconOrganization from '@/components/icons/IconOrganization.vue'
import WorkspaceCard from './WorkspaceCard.vue'

export default {
  name: 'SharedWorkspaces',

  components: {
    BfStage,
    IconOrganization,
    WorkspaceCard,
  },

  computed: {
    ...mapGetters([
      'organizations',
      'profile'
    ]),

    // Filter to show only workspaces where the user is a member (not a guest)
    sharedWorkspaces() {
      if (!this.organizations || !Array.isArray(this.organizations)) {
        return []
      }

      return this.organizations
        .filter(workspace => {
          const isGuest = workspace.isGuest || workspace.organization?.isGuest
          return !isGuest
        })
        .sort((a, b) => {
          const nameA = (a.organization?.name || '').toLowerCase()
          const nameB = (b.organization?.name || '').toLowerCase()
          return nameA.localeCompare(nameB)
        })
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.section {
  margin-bottom: 64px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-header {
  margin-bottom: 32px;

  .section-description {
    font-size: 14px;
    color: theme.$gray_4;
    margin: 0;
    max-width: 600px;
  }
}

.empty-state {
  padding: 16px 24px;

  .empty-state-content {
    text-align: center;

    h3 {
      font-size: 18px;
      font-weight: 300;
      color: theme.$gray_5;
      margin: 16px 0 8px 0;
    }

    p {
      font-size: 14px;
      color: theme.$gray_4;
      margin: 0;
    }
  }
}

.workspace-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
</style>
