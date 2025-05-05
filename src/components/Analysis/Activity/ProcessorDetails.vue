<template>
  <div class="model-details">
    <div v-if="!isEmpty" class="processor-details">
      <bf-button @click="handleLogsClick">View Logs</bf-button>
      <div class="processor-item">
        <span class="label">Name: </span>
        <span class="value">{{ selectedProcessor.name }}</span>
      </div>
      <div class="processor-item">
        <span class="label">Uuid: </span>
        <span class="value">{{ selectedProcessor.uuid }}</span>
      </div>
      <div class="processor-item">
        <span class="label">Description: </span>
        <span class="value">{{ selectedProcessor.description }}</span>
      </div>
      <div class="processor-item">
        <span class="label">Status: </span>
        <span class="value">{{ selectedProcessor.status }}</span>
      </div>
      <div class="processor-item">
        <span class="label">Parameters: </span>
        <span v-if="!hasParams" class="value">none</span>
      </div>
      <div class="table-container">
        <table v-if="hasParams">
          <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(value, key) in selectedProcessor.params" :key="key">
              <td>{{ key }}</td>
              <td>{{ value }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else>
      <div class="img-container">
        <img
          src="/src/assets/images/illustrations/illo-empty-file-types.svg"
          class="empty-image"
          alt="No processor selected"
        />
      </div>
      <div class="img-container">
        <p class="message">No processor selected</p>
      </div>
    </div>
  </div>
</template>

<script>
import { mapActions, mapState } from "vuex";

export default {
  name: "ProcessorDetails",
  components: {},
  mixins: [],

  emits: [],

  props: {},

  data: function () {
    return {};
  },

  computed: {
    ...mapState("analysisModule", [
      "workflowInstances",
      "selectedWorkflowActivity",
      ,
      "selectedProcessor",
    ]),
    isEmpty() {
      return Object.keys(this.selectedProcessor).length === 0;
    },
    formatParams() {
      return this.selectedProcessor.params;
    },
    hasParams() {
      return Object.keys(this.selectedProcessor.params).length;
    },
  },

  watch: {
    selectedProcessor: {
      immediate: true, // Run this watcher immediately on component load
      handler(newProcessor) {
        this.currentProcessor = { ...newProcessor }; // Update local data when `selectedProcessor` changes
      },
    },
  },

  methods: {
    ...mapActions("analysisModule", ["showActivityLogDialog"]),
    handleLogsClick() {
      this.showActivityLogDialog();
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../assets/_variables.scss";

.table-container {
  min-width: 400px;
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border: 1px solid $gray_2;
  padding: 10px;
  text-align: left;
}

th {
  background-color: $gray_2;
  font-weight: bold;
}

tr:nth-child(even) {
  background-color: $gray_2;
}

.model-details {
  margin: 30px;
}

.processor-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.label {
  font-weight: bold;
  color: $purple_3;
}

.value {
  color: $black;
  font-weight: normal;
}
.processor-item {
  font-weight: bold;
  color: $purple_3;
}

.processor-value {
  font-weight: normal;
  color: inherit;
}

li {
  align-items: center;
  display: flex;
  font-size: 12px;
  margin-bottom: 8px;
}
</style>
