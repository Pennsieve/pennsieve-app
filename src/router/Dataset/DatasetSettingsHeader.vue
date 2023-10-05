<template >
  <bf-rafter slot="heading">
    <template #heading>
      <h1
        class="flex-heading"
      >
        <IconLockFilled
          v-if="datasetLocked"
          class="mr-8"
          color="#71747C"
          :height="24"
          :width="24"
        />Dataset Settings
      </h1>
    </template>
  </bf-rafter>
</template>



<script>
import {mapGetters, mapState} from "vuex";

export default {
  name: 'DatasetSettingsHeader',
  computed: {
    ...mapGetters([
      'datasetLocked'
    ]),
  },
  components: {
  },
}
</script>
