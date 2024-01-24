<template>
  <div>
    {{file.name}}
  </div>
</template>

<script lang=ts setup>

import { reactive } from 'vue'



const props = defineProps({
  file: Object,
})

</script>



<style scoped lang="scss">
@import '../../assets/_variables.scss';

</style>
