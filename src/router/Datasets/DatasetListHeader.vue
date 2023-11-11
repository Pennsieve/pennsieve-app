<template >
  <bf-rafter
    title="Datasets"
    class="primary"
  >
    <template #description>
      <p>
        Datasets are used to store files and metadata and are the primary component of the Pennsieve platform.
      </p>
    </template>
  </bf-rafter>
</template>



<script>

import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import IconLockFilled from "../../components/icons/IconLockFilled.vue";

export default {
  name: 'DatasetListHeader',
  components: {
    IconLockFilled,
    BfRafter
  },
}
</script>
