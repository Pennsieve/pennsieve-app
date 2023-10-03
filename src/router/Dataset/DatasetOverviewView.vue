<template>
  <bf-page>

    <template #banner>
      <locked-banner/>
    </template>

    <template #stage>
      <DatasetOverview/>
    </template>

  </bf-page>
</template>



<script>
  import DatasetOverview from "../../components/datasets/DatasetOverview/DatasetOverview.vue";
  import BfPage from '../../components/layout/BfPage/BfPage.vue'
  import LockedBanner from '../../components/datasets/LockedBanner/LockedBanner.vue';

  export default {
    name: 'DatasetOverviewView',
    components: {
      DatasetOverview,
      BfPage,
      LockedBanner
    },
  }
</script>
