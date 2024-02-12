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

import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";

export default {
  name: 'BfMySettings',

  components: {
    BfRafter
  }
}
</script>
