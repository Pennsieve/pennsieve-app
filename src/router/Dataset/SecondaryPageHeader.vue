<template >
  <bf-rafter slot="heading">
    <template #banner>
      <locked-banner slot="banner" />

    </template>
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
        />{{pageName}}
      </h1>
    </template>
  </bf-rafter>
</template>



<script>
import {mapGetters, mapState} from "vuex";
import {useRoute} from 'vue-router'


export default {
  name: 'SecondaryPageHeader',
  computed: {
    ...mapGetters([
      'datasetLocked'
    ]),
    pageName: function() {
      const r = useRoute()

      switch (r.name) {
        case "dataset-settings":
          return "Dataset Settings"
        case "dataset-files":
          return "Files"

      }
      return "Unknown"
    }
  },
  components: {
  },

}
</script>
