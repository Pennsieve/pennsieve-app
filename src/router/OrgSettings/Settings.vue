<template>
  <bf-page>
    <bf-rafter
      slot="heading"
      title="Organization Settings"
      class="primary"
    />
    <router-view name="stage" />
  </bf-page>

</template>

<script>
export default {
  name: 'BfSettings'
}
</script>
