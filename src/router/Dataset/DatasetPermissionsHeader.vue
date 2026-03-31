<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "vuex";
import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import OrgBreadcrumb from "../../components/shared/OrgBreadcrumb/OrgBreadcrumb.vue";
import LockedBanner from "../../components/datasets/LockedBanner/LockedBanner.vue";
import RouterTabs from "../../components/shared/routerTabs/routerTabs.vue";

const route = useRoute();
const store = useStore();

const dataset = computed(() => store.state.dataset);
const datasetName = computed(() => dataset.value?.content?.name || 'Dataset');
const datasetId = computed(() => route.params.datasetId);

const tabs = [
  { to: 'user-permissions', name: 'User Permissions' },
  { to: 'embargo-permissions', name: 'Embargo Permissions' },
];

const currentTabName = computed(() => {
  const routeToTab = {
    'user-permissions': 'User Permissions',
    'embargo-permissions': 'Embargo Permissions',
  };
  return routeToTab[route.name] || 'Permissions';
});
</script>

<template>
  <div>
    <locked-banner slot="banner" />

    <bf-rafter slot="heading" class="primary" :hide-dataset-name="true">
      <template #breadcrumb>
        <org-breadcrumb
          :page-name="datasetName"
          :crumbs="[{ name: 'Permissions' }, { name: currentTabName }]"
          :page-route="{ name: 'dataset-overview', params: { datasetId: datasetId } }"
        />
      </template>
    </bf-rafter>
    <div class="content-tabs">
      <router-tabs :tabs="tabs" />
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
</style>
