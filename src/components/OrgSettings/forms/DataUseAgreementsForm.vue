<template>
  <div class="data-use-agreements-form">
    <org-settings-data-use-agreements />
  </div>
</template>

<script>
import OrgSettingsDataUseAgreements from '../OrgSettingsDataUseAgreements/OrgSettingsDataUseAgreements.vue'

export default {
  name: 'DataUseAgreementsForm',

  components: {
    OrgSettingsDataUseAgreements
  }
}
</script>

<style scoped lang="scss">
.data-use-agreements-form {
  max-width: 800px;
}
</style>