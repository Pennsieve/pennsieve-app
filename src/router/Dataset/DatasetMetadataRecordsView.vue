<script setup>

const props = defineProps({
  orgId: {
    type: String,
    default: ''
  }
})

</script>


<template>
  <div class="dataset-metadata-view">
    <router-view name="stage" />
  </div>
</template>

