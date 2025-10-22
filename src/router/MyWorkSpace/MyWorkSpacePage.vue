<template>
  <bf-page>
    <bf-rafter slot="heading" :title="pageTitle" class="primary">
      <template #breadcrumb>
        <div class="breadcrumb-nav" v-if="showBreadcrumb">
          <!-- Root workspace link -->
          <router-link :to="{ name: 'my-workspace' }" class="breadcrumb-link">
            My Workspace
          </router-link>
          
          <!-- Dynamic intermediate breadcrumbs -->
          <template v-for="item in breadcrumbItems" :key="item.name">
            <span class="breadcrumb-separator">/</span>
            <router-link :to="{ name: item.name }" class="breadcrumb-link">
              {{ item.label }}
            </router-link>
          </template>
          
          <!-- Current page (non-clickable) -->
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-current">{{ currentPageTitle }}</span>
        </div>
      </template>
      <template #description>
        <p>{{ pageDescription }}</p>
      </template>
    </bf-rafter>
    <router-view
      name="stage"
    />
  </bf-page>

</template>

<script>


import BfRafter from "@/components/shared/bf-rafter/BfRafter.vue";
import { mapActions } from 'vuex';

export default {
  name: 'MyCollectionsStage',

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
  
  mounted() {
    // Clear active organization when in my-workspace routes
    this.$store.commit('UPDATE_ACTIVE_ORGANIZATION', {})
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
    currentPageTitle() {
      // Get the current page title from the route meta or use the route name
      const routeMeta = this.$route.meta;
      const routeName = this.$route.name;
      
      // Map route names to display titles
      const routeTitles = {
        'user-profile': 'Profile',
        'user-orcid': 'ORCID Integration',
        'user-github': 'GitHub Integration',
        'user-api': 'API Keys',
        'user-integrations': 'Platform Integrations',
        'user-security': 'Security Settings',
        'user-support': 'Support & Help',
        'my-settings': 'Settings',
        'data-publishing': 'Data Publishing',
        'shared-with-me': 'My Data',
        'open-repositories': 'Pennsieve Repositories',
        'dataset-proposals': 'Dataset Proposals',
        'my-repositories': 'My Repositories',
        'my-analysis': 'My Analysis',
        'collections-list': 'Collections List',
        'collection-details': 'Collection Details',
        'my-collections': 'My Collections'
      };
      
      return routeMeta?.title || routeTitles[routeName] || this.title;
    },
    breadcrumbItems() {
      const items = [];
      const routeName = this.$route.name;
      
      // Settings section breadcrumbs
      if (this.isSettingsSubPage) {
        items.push({ name: 'my-settings', label: 'Settings' });
        
        // For integration children (ORCID, GitHub, API Keys), add Platform Integrations as intermediate
        if (this.isIntegrationChildPage) {
          items.push({ name: 'user-integrations', label: 'Platform Integrations' });
        }
      }
      
      // Publishing section breadcrumbs
      else if (this.isPublishingSubPage) {
        items.push({ name: 'data-publishing', label: 'Data Publishing' });
      }
      
      // Collections section breadcrumbs
      else if (routeName === 'collection-details') {
        // For collection details, show My Collections > Collections List as clickable parents
        items.push({ name: 'my-collections', label: 'My Collections' });
        items.push({ name: 'collections-list', label: 'Collections List' });
      }
      else if (routeName === 'collections-list') {
        // For collections list, just show My Collections as parent
        items.push({ name: 'my-collections', label: 'My Collections' });
      }
      
      // For all other top-level pages, no intermediate breadcrumbs needed
      // The current page title will be shown as non-clickable text
      
      return items;
    },
    isSettingsSubPage() {
      // Check if current route is a child of settings
      const settingsSubPages = [
        'user-profile', 'user-orcid', 'user-github', 'user-api', 
        'user-integrations', 'user-security', 'user-support'
      ];
      return settingsSubPages.includes(this.$route.name);
    },
    isIntegrationChildPage() {
      // Check if current route is a child of integrations (needs Platform Integrations in breadcrumb)
      const integrationChildPages = ['user-orcid', 'user-github', 'user-api'];
      return integrationChildPages.includes(this.$route.name);
    },
    isCollectionsSubPage() {
      // Check if current route is part of collections
      const collectionsSubPages = ['collections-list', 'collection-details'];
      return collectionsSubPages.includes(this.$route.name);
    },
    isPublishingSubPage() {
      // Check if current route is a child of data-publishing
      const publishingSubPages = ['open-repositories', 'dataset-proposals'];
      return publishingSubPages.includes(this.$route.name);
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../styles/theme';

.breadcrumb-nav {
  display: flex;
  align-items: center;
  font-size: 14px;
  
  .breadcrumb-link {
    color: theme.$gray_4;
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
  
  .breadcrumb-separator {
    margin: 0 8px;
    color: #71767C;
  }
  
  .breadcrumb-current {
    color: #000;
    font-weight: 500;
  }
}
</style>
