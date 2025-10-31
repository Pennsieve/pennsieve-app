<template>
  <div class="user-dashboard">
<!--    <div class="dashboard-header">-->
<!--      <h1>User Settings</h1>-->
<!--      <p class="subtitle">Manage your account settings and integrations</p>-->
<!--    </div>-->

    <!-- Show child route content if a child route is active -->
    <router-view name="stage" v-if="hasChildRoute" />
    
    <!-- Show dashboard cards if no child route is active -->
    <div class="dashboard-grid" v-else>
      <user-dashboard-card
        title="Profile"
        description="Manage your personal information and account details"
        :route="{ name: 'user-profile' }"
        icon="profile"
      />

      <user-dashboard-card
        title="Integrations"
        description="Connect your account to external platforms"
        :route="{ name: 'user-integrations' }"
        icon="integrations"
      />

      <user-dashboard-card
        title="Security"
        description="Password and two-factor authentication settings"
        :route="{ name: 'user-security' }"
        icon="security"
      />

<!--      <user-dashboard-card-->
<!--        title="Notifications"-->
<!--        description="Configure email and in-app notification preferences"-->
<!--        :route="{ name: 'user-notifications' }"-->
<!--        icon="notifications"-->
<!--        :coming-soon="true"-->
<!--      />-->

      <user-dashboard-card
        title="Privacy and Compliance"
        description="Control data sharing and privacy settings"
        :route="{ name: 'user-privacy' }"
        icon="security"
        :coming-soon="true"
      />

<!--      <user-dashboard-card-->
<!--        title="Billing"-->
<!--        description="View usage and manage billing information"-->
<!--        :route="{ name: 'user-billing' }"-->
<!--        icon="billing"-->
<!--        :coming-soon="true"-->
<!--      />-->

      <user-dashboard-card
        title="Support"
        description="Get help and contact customer support"
        :route="{ name: 'user-support' }"
        icon="support"
      />
    </div>
  </div>
</template>

<script>
import UserDashboardCard from './UserDashboardCard.vue'

export default {
  name: 'UserDashboard',

  components: {
    UserDashboardCard
  },

  computed: {
    hasChildRoute() {
      // Check if current route is not the main settings route (meaning a child route is active)
      return this.$route.name !== 'my-settings';
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.user-dashboard {
  max-width: 1200px;
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
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin: 32px;
  
  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}
</style>