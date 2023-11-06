<template>

  <router-view name="stage" />


</template>

<script>

export default {
  name: 'DatasetPermissionsView',

  props: {
    orgId: {
      type: String,
      default: ''
    }
  },
}
</script>
