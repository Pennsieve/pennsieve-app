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
const currentFileName = computed(() => store.state.currentFileName);
const currentFolder = computed(() => store.state.currentFolder);

const isFileRecord = computed(() => route.name === 'file-record');
const isTrash = computed(() => currentFolder.value?.isTrash === true);

const breadcrumbCrumbs = computed(() => {
  if (isFileRecord.value) {
    return [
      { name: 'Files', route: { name: 'dataset-files', params: { datasetId: datasetId.value } } },
      { name: currentFileName.value || 'File Details' },
    ];
  }
  if (isTrash.value) {
    return [{ name: 'Trash' }];
  }
  return [{ name: 'Files' }];
});
</script>

<template>
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
</template>
