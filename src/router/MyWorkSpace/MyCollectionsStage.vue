<template>
  <router-view name="stage" />
</template>

<script>
import BfRafter from "@/components/shared/bf-rafter/BfRafter.vue";

export default {
  name: "MyWorkSpacePage",
  components: {
    BfRafter
  },
  props: {
    title: {
      type: String,
      default: "My Workspace"
    },
    description: {
      type: String,
      default: "Manage your personal workspace and user settings."
    }
  },
  computed: {
    pageTitle() {
      return this.title;
    },
    pageDescription() {
      return this.description;
    },
    showBreadcrumb() {
      // Show breadcrumb on all child pages of my-workspace
      return this.$route.name !== 'my-workspace';
    },
    isSettingsSubPage() {
      // Check if current route is a child of settings
      const settingsSubPages = ['user-profile', 'user-orcid', 'user-github', 'user-api'];
      return settingsSubPages.includes(this.$route.name);
    }
  }
};
</script>

<style scoped lang="scss">
@use '@/styles/theme';

.breadcrumb-nav {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 300;

  .breadcrumb-link {
    color: theme.$gray_4;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .breadcrumb-separator {
    margin: 0 8px;
    color: theme.$gray_4;
  }

  .breadcrumb-current {
    color: theme.$gray_4;
  }
}
</style>