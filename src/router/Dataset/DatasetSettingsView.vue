<template>
  <router-view name="stage" />
</template>

<script>
export default {
  name: 'DatasetSettingsView',

  props: {
    orgId: {
      type: String,
      default: ''
    }
  },
}
</script>
