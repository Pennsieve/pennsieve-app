<template>
  <div class="custom-node" :class="statusClass">
    <slot />
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useVueFlow } from "@vue-flow/core";

const props = defineProps(["id", "data"]);
const { findNode } = useVueFlow();
const node = computed(() => findNode(props.id));

const statusClass = computed(() => {
  switch (node.value?.data?.status) {
    case "NOT_STARTED":
      return "gray-node";
    case "STARTED":
      return "blue-node";
    case "SUCCEEDED":
      return "green-node";
    case "FAILED":
      return "red-node";
    default:
      return "gray-node";
  }
});
</script>

<style scoped>
.custom-node {
  padding: 10px;
  border-radius: 6px;
  text-align: center;
  font-weight: bold;
  width: 100px;
}

.gray-node {
  background-color: gray;
}
.green-node {
  background-color: green;
}
.red-node {
  background-color: red;
}

.blue-node {
  background-color: blue;
  animation: pulse 1s infinite alternate;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0.5;
  }
}
</style>
