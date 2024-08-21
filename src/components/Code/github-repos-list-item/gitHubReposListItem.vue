<template>
  <div class="list-item">
    <el-row :gutter="20">
      <el-col id="name" :span="16"><h3>{{ repo.name }}</h3></el-col>
      <el-col id="status" class="align-content-center" :span="8">{{ repoBeingTracked ? 'Tracking Enabled' : 'Tracking Disabled' }}</el-col>
    </el-row>
    <el-row :gutter="20">
      <el-col id="description" :span="16"><p>{{ repo.description }}</p></el-col>
      <el-col id="actionCTA" class="align-content-center" :span="8"><bf-button>{{ repoBeingTracked ? 'Disable Tracking' : 'Enable Tracking' }}</bf-button></el-col>
    </el-row>
    <el-row :gutter="20">
      <el-col id="url" :span="16">
        <el-link :href="repo.html_url" target="_blank" :underline="false">
          GitHub URL<el-icon class="el-icon--right"><Link /></el-icon></el-link>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { Link } from '@element-plus/icons-vue'
export default {
  name: 'GitHubReposListItem',
  components: {
    Link
  },
  props: {
    repo: {
      type: Object,
      required: true
    },
    // currently repoBeingTracked value is not available from the repo object, integrate it when available
    repoBeingTracked: {
      type: Boolean,
      required: true,
      default: false
    }
  },
};
</script>

<style scoped lang="scss">
@import '../../../assets/_variables.scss';
  .list-item {
    margin-bottom: 24px;
    padding: 24px;
    border-bottom: 1px solid lightgray;
    box-shadow: --el-box-shadow-lighter;
  }
  .list-item:hover {
    background-color: $purple_tint;;
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