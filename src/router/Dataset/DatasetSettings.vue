<template>
  <bf-page>

    <template #banner>
      <locked-banner/>
    </template>

    <template #stage>
      <BfDatasetSettings/>
    </template>

  </bf-page>
</template>



<script>
import BfPage from '../../components/layout/BfPage/BfPage.vue'
import LockedBanner from '../../components/datasets/LockedBanner/LockedBanner.vue';
import BfDatasetSettings from "../../components/datasets/settings/BfDatasetSettings.vue";

export default {
  name: 'DatasetSettingsView',
  components: {
    BfDatasetSettings,
    BfPage,
    LockedBanner
  },
}
</script>
