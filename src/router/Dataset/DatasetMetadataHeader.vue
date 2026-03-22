<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import OrgBreadcrumb from "../../components/shared/OrgBreadcrumb/OrgBreadcrumb.vue";
import LockedBanner from "../../components/datasets/LockedBanner/LockedBanner.vue";

const route = useRoute();
const router = useRouter();
const store = useStore();

const props = defineProps({
  orgId: { type: String, default: '' },
  datasetId: { type: String, default: '' },
  instanceId: { type: String, default: '' },
});

const dataset = computed(() => store.state.dataset);
const datasetName = computed(() => dataset.value?.content?.name || 'Dataset');

const tabs = [
  { name: 'Models', to: 'models' },
  { name: 'Records', to: 'records-list', programmatic: true },
  { name: 'Explore', to: 'explore' },
];

function isTabActive(tab) {
  try {
    if (tab.to === 'records-list') {
      return route.path.includes('/metadata/records');
    }
    const resolved = router.resolve({ name: tab.to });
    return route.path.startsWith(resolved.path);
  } catch {
    return false;
  }
}

function navigateTab(tab) {
  router.push({ name: tab.to });
}

// Don't show tabs on record/instance detail pages
const hasTabs = computed(() => !props.instanceId);

const breadcrumbCrumbs = computed(() => {
  const routeName = route.name;

  // Top-level tab pages: title is the tab name
  const topLevel = {
    'models-list': 'Models',
    'records-list': 'Records',
    'records': 'Records',
    'model-records-search': 'Records',
    'explore': 'Explore',
    'relationships': 'Relationships',
  };
  if (topLevel[routeName]) {
    return [{ name: 'Metadata' }, { name: topLevel[routeName] }];
  }

  // Sub-pages under Models
  const modelSubPages = {
    'model-details': 'Model Details',
    'model-edit': 'Edit Model',
    'new-model': 'Create Model',
    'new-model-from-template': 'Template Gallery',
    'template-details': 'Template Details',
    'template-edit': 'Edit Template',
  };
  if (modelSubPages[routeName]) {
    return [
      { name: 'Metadata' },
      { name: 'Models', route: { name: 'models-list' } },
      { name: modelSubPages[routeName] },
    ];
  }

  // Sub-pages under Records
  const recordSubPages = {
    'record-details': 'Record Details',
    'create-record': 'Create Record',
    'update-record': 'Update Record',
    'metadata-record': 'Record',
    'metadata-record-edit': 'Edit Record',
  };
  if (recordSubPages[routeName]) {
    return [
      { name: 'Metadata' },
      { name: 'Records', route: { name: 'records-list' } },
      { name: recordSubPages[routeName] },
    ];
  }

  // Fallback
  return [{ name: 'Metadata' }];
});
</script>

<template>
  <div>
    <locked-banner slot="banner" />

    <bf-rafter slot="heading" class="primary" :hide-dataset-name="true">
      <template #breadcrumb>
        <org-breadcrumb
          :page-name="datasetName"
          :crumbs="breadcrumbCrumbs"
          :page-route="{ name: 'dataset-overview', params: { datasetId: datasetId } }"
        />
      </template>
    </bf-rafter>
    <div v-if="hasTabs" class="content-tabs">
      <ul class="tabs">
        <li v-for="tab in tabs" :key="tab.to">
          <a
            v-if="tab.programmatic"
            :class="{ active: isTabActive(tab) }"
            @click="navigateTab(tab)"
          >
            {{ tab.name }}
          </a>
          <router-link
            v-else
            :to="{ name: tab.to }"
            :class="{ active: isTabActive(tab) }"
          >
            {{ tab.name }}
          </router-link>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/theme';

.content-tabs {
  background: white;
  border-bottom: 1px solid theme.$gray_2;
  padding: 0 32px;
}

.tabs {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;

  li {
    margin-left: 32px;
    &:first-child {
      margin: 0;
    }
  }

  a {
    color: theme.$gray_5;
    display: inline-flex;
    padding: 12px 0;
    position: relative;
    text-decoration: none;
    font-size: 14px;
    cursor: pointer;

    &:hover,
    &:focus {
      color: theme.$purple_2;
      text-decoration: none;
    }

    &.router-link-active,
    &.active {
      color: theme.$purple_3;
      font-weight: 500;

      &:after {
        background: theme.$purple_3;
        bottom: -1px;
        content: '';
        left: 0;
        height: 2px;
        position: absolute;
        width: 100%;
        border-radius: 1px;
      }
    }
  }
}
</style>
