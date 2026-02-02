<template>
  <div class="data-publishing-dashboard">



    <div v-if="$route.name === 'data-publishing'">
      <div class="info-section">
        <h2>Data Publishing</h2>
        <p>Submit your datasets to available repositories on the Pennsieve platform. Browse repositories to find the right home for your research data, then create and track proposals for dataset publication. If your proposal is accepted, you will be invited to a dataset for uploading and curation of the data which you can access through <router-link :to="{ name: 'shared-with-me' }" class="info-link">My Data</router-link>.</p>

        <div class="info-note">
          <strong>Note:</strong> If you already have access to the repository workspace as a collaborator, create your dataset directly in the workspace to bypass the submission approval process.
        </div>
      </div>

      <div  class="dashboard-grid">

        <user-dashboard-card
          title="Pennsieve Repositories"
          description="Explore the gallery of repositories supported by the platform"
          :route="{ name: 'open-repositories' }"
          icon="repository"
        />

        <user-dashboard-card
          title="Dataset Proposals"
          description="View and manage your active dataset proposals"
          :route="{ name: 'dataset-proposals' }"
          icon="proposals"
        />
      </div>
    </div>

    
    <!-- Render child routes when not at exact data-publishing route -->
    <router-view v-if="$route.name !== 'data-publishing'" name="stage" />
  </div>
</template>

<script>
import UserDashboardCard from '../dashboard/UserDashboardCard.vue'

export default {
  name: 'DataPublishingDashboard',

  components: {
    UserDashboardCard
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.data-publishing-dashboard {
  padding: 32px;
  max-width: 1200px;
  margin: 0;
}

.info-section {
  margin-bottom: 32px;

  h2 {
    font-size: 24px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 12px 0;
  }

  p {
    font-size: 14px;
    color: theme.$gray_4;
    line-height: 1.5;
    margin: 0 0 16px 0;
    max-width: 800px;
  }
}

.info-link {
  color: theme.$purple_2;
  text-decoration: none;
  font-weight: 500;
  
  &:hover {
    text-decoration: underline;
  }
}

.info-note {
  background: theme.$gray_1;
  border-left: 3px solid theme.$yellow_1;
  padding: 12px 16px;
  font-size: 13px;
  color: theme.$gray_5;
  line-height: 1.5;
  max-width: 800px;

  strong {
    color: theme.$gray_6;
    font-weight: 600;
  }
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  max-width: 800px;
  margin: 0;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}
</style>