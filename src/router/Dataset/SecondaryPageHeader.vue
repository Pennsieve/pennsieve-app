<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "vuex";
import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import OrgBreadcrumb from "../../components/shared/OrgBreadcrumb/OrgBreadcrumb.vue";
import LockedBanner from "../../components/datasets/LockedBanner/LockedBanner.vue";

const route = useRoute();
const store = useStore();

const dataset = computed(() => store.state.dataset);
const datasetName = computed(() => dataset.value?.content?.name || 'Dataset');
const datasetId = computed(() => route.params.datasetId);

const pageName = computed(() => {
  const routeNames = {
    'dataset-settings': 'Settings',
    'publishing-settings': 'Publishing Settings',
    'integrations-settings': 'Integrations',
  };
  return routeNames[route.name] || 'Settings';
});
</script>

<template>
  <div>
    <locked-banner slot="banner" />

    <bf-rafter slot="heading" class="primary" :hide-dataset-name="true">
      <template #breadcrumb>
        <org-breadcrumb
          :page-name="datasetName"
          :sub-page-name="pageName"
          :page-route="{ name: 'dataset-overview', params: { datasetId: datasetId } }"
        />
      </template>
    </bf-rafter>
  </div>
</template>
