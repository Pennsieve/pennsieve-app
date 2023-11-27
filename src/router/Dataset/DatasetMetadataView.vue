<template>

  <router-view name="stage" />


</template>

<script>

export default {
  name: 'DatasetMetadataView',

  props: {
    orgId: {
      type: String,
      default: ''
    }
  },
}
</script>
