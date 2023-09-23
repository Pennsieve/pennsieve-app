<template>
  <bf-page>
    <bf-rafter
      slot="heading"
      title="My Settings"
      class="primary"
    />
    <router-view
      name="stage"
    />
  </bf-page>
</template>

<script>
export default {
  name: 'BfMySettings'
}
</script>
