<template>

  <router-view name="stage" />


</template>

<script>

export default {
  name: 'DatasetActivityView',

  props: {
    orgId: {
      type: String,
      default: ''
    }
  },
}
</script>
