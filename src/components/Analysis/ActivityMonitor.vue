<script setup>
// Importing functions from Vue
import { ref, computed, onMounted } from "vue";
import { useStore } from "vuex";

// Access the Vuex store
const store = useStore();

// Reactive state using `ref`
const count = ref(0); // Local reactive count (if you want to use local state)
const isLoading = ref(false);
const data = ref(null); // Reactive variable to store API response
const error = ref(null); // Reactive variable to store error

// Computed Properties
const doubleCountFromState = computed(() => count.value * 2); // Local state computation
const countFromState = computed(() => store.state.count); // From Vuex store state
const doubleCount = computed(() => store.getters.doubleCount); // From Vuex store getter

// Methods
const increment = () => {
  count.value++;
};

const fetchData = async () => {
  isLoading.value = true;
  try {
    const response = await fetch("https://api.example.com/data");
    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }
    data.value = await response.json();
  } catch (err) {
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
};

// Lifecycle Hook
onMounted(() => {
  console.log("Component has been mounted");
  fetchData(); // Fetch data on component mount
});
</script>

<template>
  <!-- Show loading indicator -->
  <div v-if="isLoading">Loading...</div>

  <!-- Show error message if an error occurs -->
  <div v-else-if="error">Error: {{ error }}</div>

  <!-- Display API data -->
  <div v-else>
    <pre>{{ data }}</pre>
  </div>

  <!-- Display Vuex and local count -->
  <div>
    <p>Count (Local State): {{ count }}</p>
    <p>Double Count (Local State): {{ doubleCountFromState }}</p>

    <p>Count (Vuex State): {{ countFromState }}</p>
    <p>Double Count (Vuex Getter): {{ doubleCount }}</p>

    <!-- Buttons for interaction -->
    <button @click="increment">Increment Local Count</button>
  </div>
</template>
