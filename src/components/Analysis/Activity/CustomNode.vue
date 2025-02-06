<script setup>
import { Position, Handle } from '@vue-flow/core'
import { toRef, ref } from 'vue';

const props = defineProps(['nodeProps'])
const nodeProps = toRef(props,'nodeProps')
const type = ref(nodeProps.value.data.type)


</script>

<template>
  <div class="vue-flow__node-default" :class="{input:type==='input', output:type==='output'}">
    <Handle type="target" :position="Position.Top" />
    <div>{{ nodeProps.data.label }}</div>
    <button>View Logs</button>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>
<style scoped>
  .input{
    border-color: #0041d0;
  }
  .output{
    border-color: #ff0072;
  }
</style>