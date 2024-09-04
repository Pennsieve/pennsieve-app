<template>
  <div class="list-item">
    <el-row :gutter="40">
      <el-col :span="12" class="repo-banner-container">
        <div>
          <img src="../../assets/images/octocat.png" alt="Octocat" />
        </div>
        <div class="repo-info-container">
          <h2 class="margin">
            {{ repo.name }}
          </h2>
          <div class="margin">{{ repo.description }}</div>
        </div>
      </el-col>
      <el-col :span="5" class="status-container">
        <div v-if="workspaceRepos">
          <h2>Tracked</h2>
          <div>DOI or N/A</div>
        </div>
      </el-col>
      <el-col :span="7" class="actions-container">
        <button @click="handleTrackingClick" class="text-button">
          Start Tracking
        </button>
        <button @click="handleConfigureClick" class="text-button">
          Configure
        </button>
        <button @click="handlePublishLatestClick" class="text-button">
          Publish Latest Release
        </button>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { Link } from "@element-plus/icons-vue";
import { mapActions, mapGetters, mapState } from "vuex";

export default {
  name: "RepoListItem",
  components: {
    Link,
  },
  props: {
    repo: {
      type: Object,
      required: true,
    },
    // currently isTracked value is not available from the repo object, integrate it when available
    isTracked: {
      type: Boolean,
      required: true,
      default: false,
    },
    myRepos: {
      type: Boolean,
      default: false,
    },
    workspaceRepos: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    ...mapActions("codeReposModule", ["fetchMyRepos"]),
    handleTrackingClick: function () {
      console.log("tracking click");
    },
    handleConfigureClick: function () {
      console.log("configure click");
    },
    handlePublishLatestClick: function () {
      console.log("publish latest click");
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../assets/_variables.scss";
.margin {
  margin-left: 12px;
}

.text-button {
  margin: 5px;
  padding: 8px 12px; /* Add some padding for better visibility */
  background-color: transparent;
  border: 1px solid transparent;
  cursor: pointer; /* Change the cursor to a pointer */
  transition: background-color 0.3s ease, border-color 0.3s ease,
    color 0.3s ease; /* Smooth transition */

  &:hover {
    background-color: white; /* Change background color on hover */
    color: #011f5b; /* Change text color on hover */
  }

  &:focus {
    outline: none;
  }
}

.actions-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
}

.repo-banner-container {
  display: flex;
  flex-direction: row;
}

.repo-info-container {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.status-container {
  display: flex;
  flex-direction: column;
}
.column {
  padding: 20px;
  background-color: #f2f2f2;
  text-align: center;
  border: 1px solid #dcdcdc;
}
.list-item {
  padding: 24px;
  border-bottom: 1px solid lightgray;
  box-shadow: --el-box-shadow-lighter;
}
.list-item:hover {
  background-color: $purple_tint;
}
.el-row {
  min-height: 40px;
}
.el-col {
  border-radius: 4px;
}

.grid-content {
  border-radius: 4px;
  min-height: 36px;
}
.align-content-center {
  text-align: center;
}
h3 {
  font-size: 16px;
  font-weight: 400;
  line-height: 16px;
}
</style>
