<template>
  <div class="model-details">
    <div v-if="!isEmpty" class="processor-details">
      <bf-button @click="handleLogsClick">View Logs</bf-button>
      <div class="processor-item">
        <span class="label">Name: </span>
        <span class="value">{{ selectedProcessor.name }}</span>
      </div>
      <div class="processor-item">
        <span class="label">UUID: </span>
        <span class="value">{{ selectedProcessor.uuid }}</span>
      </div>
      <div class="processor-item">
        <span class="label">Description: </span>
        <span class="value">{{ selectedProcessor.description }}</span>
      </div>
      <div class="processor-item">
        <span class="label">Status: </span>
        <span class="value" :class="statusClass">{{
          selectedProcessor.status
        }}</span>
      </div>
      <div class="processor-item">
        <span class="label">Application Type: </span>
        <span class="value">{{ selectedProcessor.applicationType }}</span>
      </div>
      <div class="processor-item">
        <span class="label">Environment: </span>
        <span class="value">{{ selectedProcessor.environment }}</span>
      </div>
      <div class="processor-item">
        <span class="label">Created At: </span>
        <span class="value">{{ formatDate(selectedProcessor.createdAt) }}</span>
      </div>
      <div class="processor-item">
        <span class="label">Started At: </span>
        <span class="value">{{ formatDate(selectedProcessor.startedAt) }}</span>
      </div>
      <div class="processor-item">
        <span class="label">Completed At: </span>
        <span class="value">{{
          formatDate(selectedProcessor.completedAt)
        }}</span>
      </div>

      <!-- Parameters Section -->
      <div class="section-title">Parameters</div>
      <div v-if="!hasParams" class="processor-item">
        <span class="value">none</span>
      </div>
      <div class="table-container" v-if="hasParams">
        <table>
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

      <!-- Resources Section -->
      <div class="section-title">Resources</div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Resource</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>CPU</td>
              <td>{{ selectedProcessor.resources?.cpu || "N/A" }}</td>
            </tr>
            <tr>
              <td>Memory</td>
              <td>{{ formatMemory(selectedProcessor.resources?.memory) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Source Information -->
      <div class="section-title">Source Information</div>
      <div class="processor-item">
        <span class="label">Type: </span>
        <span class="value">{{ selectedProcessor.source?.type }}</span>
      </div>
      <div class="processor-item">
        <span class="label">URL: </span>
        <span class="value">
          <a
            v-if="selectedProcessor.source?.url"
            :href="formatGitHubUrl(selectedProcessor.source.url)"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ selectedProcessor.source.url }}
          </a>
          <span v-else>N/A</span>
        </span>
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
      "selectedProcessor",
    ]),
    isEmpty() {
      return (
        !this.selectedProcessor ||
        Object.keys(this.selectedProcessor).length === 0
      );
    },
    hasParams() {
      return (
        this.selectedProcessor.params &&
        Object.keys(this.selectedProcessor.params).length > 0
      );
    },
    statusClass() {
      if (!this.selectedProcessor.status) return "";
      const status = this.selectedProcessor.status.toLowerCase();
      return `status-${status}`;
    },
  },

  watch: {
    selectedProcessor: {
      immediate: true,
      handler(newProcessor) {
        this.currentProcessor = { ...newProcessor };
      },
    },
  },

  methods: {
    ...mapActions("analysisModule", ["showActivityLogDialog"]),
    handleLogsClick() {
      this.showActivityLogDialog();
    },
    formatDate(dateString) {
      if (!dateString) return "N/A";
      try {
        return new Date(dateString).toLocaleString();
      } catch (error) {
        return dateString;
      }
    },
    formatMemory(memory) {
      if (!memory) return "N/A";
      // Convert MB to GB for better readability if >= 1024 MB
      if (memory >= 1024) {
        return `${(memory / 1024).toFixed(1)} GB (${memory} MB)`;
      }
      return `${memory} MB`;
    },
    formatGitHubUrl(gitUrl) {
      if (!gitUrl) return "";
      // Convert git:// URLs to https:// for browser compatibility
      return gitUrl.replace("git://", "https://");
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/theme";

.table-container {
  min-width: 400px;
  overflow: hidden;
  margin-bottom: 1rem;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border: 1px solid theme.$gray_2;
  padding: 10px;
  text-align: left;
}

th {
  background-color: theme.$gray_2;
  font-weight: bold;
}

tr:nth-child(even) {
  background-color: theme.$gray_2;
}

.model-details {
  margin: 30px;
}

.processor-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section-title {
  font-weight: bold;
  font-size: 1.1em;
  color: theme.$purple_3;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  border-bottom: 2px solid theme.$purple_3;
  padding-bottom: 0.25rem;
}

.label {
  font-weight: bold;
  color: theme.$purple_3;
}

.value {
  color: theme.$black;
  font-weight: normal;

  a {
    color: theme.$purple_3;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.processor-item {
  font-weight: bold;
  color: theme.$purple_3;
}

.status-succeeded {
  color: #28a745;
  font-weight: bold;
}

.status-failed {
  color: #dc3545;
  font-weight: bold;
}

.status-running {
  color: #ffc107;
  font-weight: bold;
}

li {
  align-items: center;
  display: flex;
  font-size: 12px;
  margin-bottom: 8px;
}

.img-container {
  text-align: center;
  margin: 2rem 0;
}

.empty-image {
  max-width: 200px;
  opacity: 0.6;
}

.message {
  color: theme.$gray_4;
  font-style: italic;
  margin-top: 1rem;
}
</style>
