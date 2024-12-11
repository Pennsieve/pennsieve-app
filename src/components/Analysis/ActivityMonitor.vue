<script setup>
// Importing functions from Vue
import { ref, computed, onMounted } from "vue";
import { useStore } from "vuex";

// Access the Vuex store
const store = useStore();

// Data from Vuex store

const workflowInstances = computed(
  () => store.getters["analysisModule/workflowInstances"]
);

// Reactive state using `ref`
const isLoading = ref(false);

// Methods
const increment = () => {
  count.value++;
};

// Lifecycle Hook
onMounted(() => {
  store.dispatch("analysisModule/fetchWorkflowInstances");

  console.log("workflowInstances", workflowInstances.value);
});
</script>

<template>
  <!-- Show loading indicator -->
  <div v-if="isLoading">Loading...</div>

  <!-- Display API data -->
  <div v-else>
    <div>template</div>
  </div>
</template>
