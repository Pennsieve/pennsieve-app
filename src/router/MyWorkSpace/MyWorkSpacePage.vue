<template>
  <bf-page>
    <bf-rafter slot="heading" class="primary">
      <template #breadcrumb>
        <org-breadcrumb
          :page-name="currentSectionName"
          :crumbs="breadcrumbCrumbs"
          :page-route="sectionRoute"
          workspace-label="My Workspace"
          :workspace-route="{ name: 'my-workspace' }"
        />
      </template>
    </bf-rafter>
    <div v-if="showTabs" class="content-tabs">
      <router-tabs :tabs="tabs" />
    </div>
    <router-view name="stage" />
  </bf-page>
</template>

<script>
import BfRafter from "@/components/shared/bf-rafter/BfRafter.vue";
import RouterTabs from "@/components/shared/routerTabs/routerTabs.vue";
import OrgBreadcrumb from "@/components/shared/OrgBreadcrumb/OrgBreadcrumb.vue";

export default {
  name: 'MyWorkSpacePage',

  components: {
    BfRafter,
    RouterTabs,
    OrgBreadcrumb
  },

  mounted() {
    this.$store.commit('UPDATE_ACTIVE_ORGANIZATION', {})
  },

  computed: {
    routeName() {
      return this.$route.name;
    },

    // Determine which top-level section we're in
    currentSectionName() {
      if (this.isSettingsSection) return 'Settings';
      if (this.isPublishingSection) return 'Data Publishing';
      if (this.isCollectionsSection) return 'Collections';

      // Top-level pages
      const topLevel = {
        'shared-with-me': 'My Data',
        'my-code': 'My Code',
        'my-analysis': 'My Analysis',
      };
      return topLevel[this.routeName] || 'My Workspace';
    },

    sectionRoute() {
      if (this.isSettingsSection) return { name: 'my-settings' };
      if (this.isPublishingSection) return { name: 'data-publishing' };
      if (this.isCollectionsSection) return { name: 'collections-list' };
      return null;
    },

    breadcrumbCrumbs() {
      const routeName = this.routeName;

      // Settings sub-pages
      if (this.isSettingsSection) {
        if (routeName === 'my-settings') {
          return [];
        }

        // Tab-level pages
        const settingsPages = {
          'user-profile': 'Profile',
          'user-integrations': 'Platform Integrations',
          'user-security': 'Security',
          'user-compute-resource': 'Compute Resources',
          'user-support': 'Support',
        };
        if (settingsPages[routeName]) {
          return [{ name: settingsPages[routeName] }];
        }

        // Integration child pages
        const integrationChildren = {
          'user-orcid': 'ORCID',
          'user-github': 'GitHub',
          'user-api': 'API Keys',
        };
        if (integrationChildren[routeName]) {
          return [
            { name: 'Platform Integrations', route: { name: 'user-integrations' } },
            { name: integrationChildren[routeName] },
          ];
        }
      }

      // Publishing sub-pages
      if (this.isPublishingSection) {
        if (routeName === 'open-repositories') {
          return [{ name: 'Repositories' }];
        }
        if (routeName === 'dataset-proposals') {
          return [{ name: 'Proposals' }];
        }
        return [];
      }

      // Collections sub-pages
      if (this.isCollectionsSection) {
        if (routeName === 'collection-details') {
          return [{ name: 'Collection Details' }];
        }
        return [];
      }

      return [];
    },

    isSettingsSection() {
      const settingsPages = [
        'my-settings', 'user-profile', 'user-orcid', 'user-github',
        'user-api', 'user-compute-resource', 'user-integrations',
        'user-security', 'user-support'
      ];
      return settingsPages.includes(this.routeName);
    },

    isPublishingSection() {
      const publishingPages = ['data-publishing', 'open-repositories', 'dataset-proposals'];
      return publishingPages.includes(this.routeName);
    },

    isCollectionsSection() {
      const collectionsPages = ['my-collections', 'collections-list', 'collection-details'];
      return collectionsPages.includes(this.routeName);
    },

    showTabs() {
      return false;
    },

    tabs() {
      return [];
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../styles/theme';

.content-tabs {
  background: white;
  border-bottom: 1px solid theme.$gray_2;
  padding: 0 32px;
  margin-bottom: 8px;
}
</style>
