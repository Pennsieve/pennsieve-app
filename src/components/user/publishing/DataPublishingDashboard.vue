<template>
  <div class="data-publishing-dashboard">
    <!-- Show dashboard grid only when at exact data-publishing route -->
    <div v-if="$route.name === 'data-publishing'" class="dashboard-grid">
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

.dashboard-header {
  text-align: center;
  margin-bottom: 48px;

  h1 {
    font-size: 32px;
    font-weight: 300;
    color: theme.$gray_6;
    margin: 0 0 12px 0;
  }

  .subtitle {
    font-size: 16px;
    color: theme.$gray_4;
    margin: 0;
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