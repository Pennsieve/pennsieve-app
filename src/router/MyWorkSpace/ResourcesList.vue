<template>
  <div class="resources-dashboard">
    <div class="info-section">
      <p>
        Shared catalogs of standardized, reusable metadata you can browse and apply across your
        datasets.
      </p>
    </div>

    <div class="dashboard-grid">
      <user-dashboard-card
        title="CDE Catalog"
        description="Browse common data elements and bundles indexed from the NLM CDE Repository"
        :route="{ name: 'cde-catalog' }"
        icon="cde-catalog"
      />

      <user-dashboard-card
        title="Model Templates"
        description="Browse reusable model templates"
        :route="{ name: 'resources' }"
        icon="model-templates"
        :coming-soon="true"
      />
    </div>
  </div>
</template>

<script>
import UserDashboardCard from "@/components/user/dashboard/UserDashboardCard.vue";

export default {
  name: "ResourcesList",
  components: { UserDashboardCard }
};
</script>

<style scoped lang="scss">
@use '@/styles/theme';

.resources-dashboard {
  padding: 32px;
  max-width: 1200px;
}

.info-section {
  margin-bottom: 24px;

  p {
    color: theme.$gray_5;
    max-width: 800px;
    line-height: 1.5;
    margin: 0;
  }
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  max-width: 800px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}
</style>
