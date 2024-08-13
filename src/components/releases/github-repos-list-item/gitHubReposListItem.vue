<template>
  <div id="gitHubReposListItem">
    <el-row :gutter="20">
      <el-col id="name" :span="16">{{ repo.name }}</el-col>
      <el-col id="status" :span="8">disabled</el-col>
    </el-row>
    <el-row :gutter="20">
      <el-col id="description" :span="16">{{ repo.description }}</el-col>
      <el-col id="actionCTA" :span="8"><button>Enable</button></el-col>
    </el-row>
    <el-row :gutter="20">
      <el-col id="url" :span="16">{{ repo.html_url }}</el-col>
    </el-row>
  </div>
</template>

<script>
export default {
  name: 'GitHubReposListItem',
  props: {
    repo: {
      type: Object,
      required: true
    },
  },
};
</script>

<style scoped>
  .el-row {
    margin-bottom: 20px;
  }
  .el-row:last-child {
    margin-bottom: 0;
  }
  .el-col {
    border-radius: 4px;
  }

  .grid-content {
    border-radius: 4px;
    min-height: 36px;
  }
</style>