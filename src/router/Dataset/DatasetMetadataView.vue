<script setup>

import {onMounted} from "vue";
import {useStore} from "vuex";

const props = defineProps({
  orgId: {
    type: String,
    default: ''
  }
})

const store = useStore()


// Always load the models when in this scenario
onMounted(async () => {
  try {
    store.dispatch('metadataModule/fetchModels')
  } catch (err) {
    console.error(err);
  }
})

</script>


<template>

  <router-view name="stage" />


</template>

