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
      <el-col :span="6" class="status-container">
        <h2>Tracked/ Untracked</h2>
        <div>DOI or N/A</div>
      </el-col>
      <el-col :span="6" class="actions-container">
        <div>Start/ Stop Tracking</div>
        <div>Configure</div>
        <div>Publish Latest Release</div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { Link } from "@element-plus/icons-vue";
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
  },
};
</script>

<style scoped lang="scss">
@import "../../assets/_variables.scss";
.margin {
  margin-left: 12px;
}

.actions-container {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
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
  margin-bottom: 24px;
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
