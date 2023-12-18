<template>

  <router-view name="stage" />

</template>

<script>

import IconArrowLeft from "../../components/icons/IconArrowLeft.vue";

export default {
  name: 'DatasetMetadataModelsView',
  components: {IconArrowLeft},
  props: {
    orgId: {
      type: String,
      default: ''
    }
  },
}
</script>