<script setup>
// Importing functions from Vue
import { ref, computed, onMounted } from "vue";
import { useStore } from "vuex";

// Access the Vuex store
const store = useStore();

// Gobal State from Vuex Store
const workflowInstances = computed(
  () => store.getters["analysisModule/workflowInstances"]
);

const workflowInstance = computed(
  () => store.getters["analysisModule/workflowInstance"]
);

const workflowLogs = computed(
  () => store.getters["analysisModule/workflowLogs"]
);

// Local State
const isLoading = ref(false);

// Methods
const isRunning = (workflow) => {
  // if the workflow does not contain a completedAt property, it is active
  return !workflow.completedAt ? "Active" : "Completed";
};

// Lifecycle Hook
onMounted(async () => {
  // fetch all workflow instances
  try {
    isLoading.value = true;
    await store.dispatch("analysisModule/fetchWorkflowInstances");
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
    // console.log("workflowInstances", workflowInstances.value);
  }
  // fetch one workflow instance
  try {
    isLoading.value = true;
    await store.dispatch(
      "analysisModule/fetchWorkflowInstance",
      workflowInstances.value[0].uuid
    );
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
    // console.log(workflowInstance.value);
  }

  // fetch logs for one workflow instance
  try {
    isLoading.value = true;
    await store.dispatch(
      "analysisModule/fetchWorkflowLogs",
      workflowInstances.value[3]
    );
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
    console.log("workflowFlow Logs", workflowLogs.value);
  }
});
</script>

<template>
  <!-- Show loading indicator -->
  <div v-if="isLoading">Loading...</div>

  <!-- Display API data -->
  <div v-else>
    <ul>
      <li v-for="(workflow, index) in workflowInstances" :key="index">
        {{
          `Workflow Uuid: ${workflow.uuid}, Workflow Running: ${isRunning(
            workflow
          )}`
        }}
      </li>
    </ul>
  </div>
</template>
