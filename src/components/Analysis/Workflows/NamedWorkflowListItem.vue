<template>
  <div class="workflows-list-item">
    <el-row class="info">
      <el-col :span="24" class="workflow-title">
        <span>{{ workflow.name }}</span>
      </el-col>
    </el-row>
    <el-row class="workflow-body">
      <p class="workflow-description">
        {{ workflow.description || "No description provided" }}
      </p>
      <div class="workflow-metadata">
        <div class="metadata-item">
          <span class="metadata-label">Created:</span>
          <span class="metadata-value">{{ formatCreatedDate }}</span>
        </div>
        <div
          v-if="workflow.processors && workflow.processors.length"
          class="metadata-item processors-section"
        >
          <span class="metadata-label"
            >Processors ({{ workflow.processors.length }}):</span
          >
          <div class="processors-list">
            <a
              v-for="(processor, index) in workflow.processors"
              :key="index"
              :href="convertGitToHttps(processor?.sourceUrl)"
              target="_blank"
              rel="noopener noreferrer"
              class="processor-link"
            >
              {{ extractRepoName(processor?.sourceUrl) }}
            </a>
          </div>
        </div>
      </div>
    </el-row>
  </div>
</template>

<script>
import { mapState } from "vuex";
import FormatDate from "../../../mixins/format-date";

export default {
  name: "NamedWorkflowListItem",
  mixins: [FormatDate],
  props: {
    workflow: {
      type: Object,
      default: () => ({}),
    },
  },

  computed: {
    ...mapState(["activeOrganization"]),
    formatCreatedDate: function () {
      if (!this.workflow.createdAt) return "Unknown";
      const date = new Date(this.workflow.createdAt);
      return this.formatDate(date.toISOString());
    },
  },

  methods: {
    convertGitToHttps(gitUrl) {
      if (!gitUrl) return "#";
      // Convert git://github.com/user/repo to https://github.com/user/repo
      return gitUrl.replace("git://", "https://");
    },
    extractRepoName(gitUrl) {
      if (!gitUrl) return "";
      // Extract the repository name from the URL
      const parts = gitUrl.split("/");
      return parts[parts.length - 1] || gitUrl;
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/theme";

.workflows-list-item {
  width: 230px;
  height: 300px;
  border: 1px solid theme.$gray_3;
  margin: 0 8px 16px 8px;
  background-color: white;
  display: flex;
  flex-direction: column;
}

.workflow-title {
  display: flex;
  font-size: 16px;
  font-weight: 600;
  color: black;
  align-items: center;
}

.info {
  background: theme.$purple_tint;
  padding: 16px;
}

.workflow-body {
  padding: 16px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.workflow-description {
  font-size: 14px;
  color: theme.$gray_5;
  margin: 0 0 16px 0;
  overflow-wrap: break-word;
  line-height: 1.4;
}

.workflow-metadata {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 13px;
}

.metadata-item {
  display: flex;
  align-items: flex-start;

  &.processors-section {
    flex-direction: column;
    gap: 8px;
  }
}

.metadata-label {
  font-weight: 600;
  color: theme.$gray_6;
  margin-right: 8px;
  flex-shrink: 0;
}

.metadata-value {
  color: theme.$gray_5;
}

.processors-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 4px;
}

.processor-link {
  color: theme.$gray_6;
  text-decoration: none;
  font-size: 12px;
  transition: color 0.2s;

  &:hover {
    color: darken(theme.$gray_6, 10%);
    text-decoration: underline;
  }
}
</style>
