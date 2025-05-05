<template>
  <bf-page>
    <bf-rafter
      slot="heading"
      title="Workspace Configuration"
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
