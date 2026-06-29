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
      if (this.isCodeSection) return 'My Code';
      if (this.myDataSection) return this.myDataSection.name;

      // Top-level pages
      const topLevel = {
        'my-code': 'My Code',
        'my-analysis': 'My Analysis',
      };
      return topLevel[this.routeName] || 'My Workspace';
    },

    sectionRoute() {
      if (this.isSettingsSection) return { name: 'my-settings' };
      if (this.isPublishingSection) return { name: 'data-publishing' };
      if (this.isCollectionsSection) return { name: 'collections-list' };
      if (this.isCodeSection) return { name: 'my-code' };
      if (this.myDataSection) return this.myDataSection.route;
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

        // Compute resource detail page
        if (routeName === 'user-compute-resource-detail') {
          return [
            { name: 'Compute Resources', route: { name: 'user-compute-resource' } },
            { name: 'Account Details' }
          ];
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

      // My Code sub-pages
      if (this.isCodeSection) {
        if (routeName === 'published-app-details') {
          return [{ name: 'Application Details' }];
        }
        return [];
      }

      return [];
    },

    isCodeSection() {
      return this.routeName === 'published-app-details';
    },

    // The "My Data" routes are now separate primary-nav entries; each shows
    // its own breadcrumb name and links back to its own route.
    myDataSection() {
      const names = {
        'shared-with-me': 'Shared Workspaces',
        'shared-workspaces': 'Shared Workspaces',
        'shared-datasets': 'Shared With Me',
        'public-datasets': 'Public Datasets',
      };
      if (names[this.routeName]) {
        return { name: names[this.routeName], route: { name: this.routeName } };
      }
      // public-dataset detail (overview/files) → belongs to Public Datasets
      if (
        typeof this.routeName === 'string' &&
        this.routeName.startsWith('public-dataset') &&
        this.routeName !== 'public-datasets'
      ) {
        return { name: 'Public Datasets', route: { name: 'public-datasets' } };
      }
      return null;
    },

    isSettingsSection() {
      const settingsPages = [
        'my-settings', 'user-profile', 'user-orcid', 'user-github',
        'user-api', 'user-compute-resource', 'user-compute-resource-detail',
        'user-integrations', 'user-security', 'user-support'
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
}
</style>
