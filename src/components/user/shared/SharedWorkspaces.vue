<template>
  <bf-stage slot="stage">
  <div class="section">
    <p class="section-description">
      Workspaces are where your teams share datasets and run analyses.
    </p>

    <!-- None yet (or only Welcome): what a workspace is and how to get one,
         and what there is to do meanwhile -->
    <div v-if="workspaces.length === 0" class="empty-state">
      <img
        src="../../../assets/images/illustrations/illo-research-platform.svg"
        width="220"
        height="189"
        alt=""
      />
      <h3>You're not in a workspace yet</h3>
      <p>
        A workspace admin invites you with the email you sign in with. Until
        then, explore published data or work on your own.
      </p>
      <div class="empty-actions">
        <router-link :to="{ name: 'public-datasets' }" class="empty-link">Browse Public Datasets</router-link>
        <router-link :to="{ name: 'my-analysis' }" class="empty-link">Run an analysis</router-link>
      </div>
    </div>

    <div v-else class="workspace-grid">
      <WorkspaceCard
        v-for="workspace in workspaces"
        :key="workspace.organization.id"
        :workspace="workspace"
        :last-opened="workspaces.length > 1 && workspace.organization.id === lastOpenedId"
      />
    </div>
  </div>
  </bf-stage>
</template>

<script>
import { mapGetters } from 'vuex'
import Cookies from 'js-cookie'
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import WorkspaceCard from './WorkspaceCard.vue'
import { memberWorkspaces, sortWorkspaces } from './workspaceCards'

export default {
  name: 'SharedWorkspaces',

  components: {
    BfStage,
    WorkspaceCard,
  },

  computed: {
    ...mapGetters([
      'organizations',
      'profile'
    ]),

    // The workspace you last opened (kept when you open one).
    lastOpenedId() {
      return Cookies.get('preferred_org_id') || ''
    },

    // Your workspaces as a member, the one you last opened first.
    workspaces() {
      return sortWorkspaces(memberWorkspaces(this.organizations), this.lastOpenedId)
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.section-description {
  font-size: 16px;
  line-height: 1.6;
  color: theme.$gray_5;
  margin: 0 0 24px;
  max-width: 800px;
}

/* Cards 280-360px, as many to a row as fit: they don't stretch to fill
   it, so one or two workspaces (as most people have) stay card-sized. */
.workspace-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 360px));
  gap: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 460px;
  margin: 24px auto 0;
  text-align: center;

  img {
    margin-bottom: 16px;
  }

  h3 {
    font-size: 18px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px;
  }

  p {
    font-size: 14px;
    line-height: 1.5;
    color: theme.$gray_5;
    margin: 0 0 16px;
  }
}
.empty-actions {
  display: flex;
  gap: 24px;
}
.empty-link {
  font-size: 14px;
  font-weight: 500;
  color: theme.$link-color;
  text-decoration: none;

  &:hover {
    color: theme.$link-color-hover;
  }
}
</style>
