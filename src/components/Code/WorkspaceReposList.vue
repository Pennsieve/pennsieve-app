<template>
  <bf-stage element-loading-background="transparent">
    <bf-empty-page-state class="empty" v-if="showEmptyState">
      <p>
        This Workspace has no tracked repositories yet. Track a Repository to
        create a Workspace Repository.
      </p>
    </bf-empty-page-state>
    <div class="pagination-container">
      <el-pagination
        :page-size="workspaceReposPaginationParams.limit"
        :current-page="workspaceReposPaginationParams.currentPage"
        layout="prev, pager, next"
        :total="workspaceReposCount"
        @current-change="onPaginationPageChange"
      />
    </div>
    <div v-loading="isLoadingRepos">
      <RepoListItem
        workspaceReposView
        :isTracked="repo.tracking"
        v-for="repo in workspaceRepos"
        :key="repo.id"
        :repo="repo"
      ></RepoListItem>
    </div>
  </bf-stage>
</template>

<script>
import { mapState, mapActions } from "vuex";
import RepoListItem from "./RepoListItem.vue";
import BfEmptyPageState from "../shared/bf-empty-page-state/BfEmptyPageState.vue";

export default {
  name: "WorkspaceRepos",

  components: {
    RepoListItem,
    BfEmptyPageState,
  },

  data() {
    return {
      isLoadingRepos: false,
    };
  },

  async mounted() {
    try {
      this.fetchWorkspaceRepos({
        limit: this.workspaceReposPaginationParams.limit,
        offset: this.workspaceReposPaginationParams.offset,
      });
    } catch (err) {
      console.error(err);
    }
  },

  computed: {
    ...mapState("codeReposModule", [
      "workspaceRepos",
      "workspaceReposLoaded",
      "workspaceReposPaginationParams",
      "workspaceReposCount",
    ]),
    showEmptyState: function () {
      return this.workspaceReposLoaded && !this.workspaceRepos?.length;
    },
  },

  methods: {
    ...mapActions("codeReposModule", [
      "fetchWorkspaceRepos",
      "updateWorkspaceRepoOffset",
    ]),
    onPaginationPageChange: async function (page) {
      const offset = (page - 1) * this.workspaceReposPaginationParams.limit;
      this.updateWorkspaceRepoOffset(offset);
      try {
        this.isLoadingRepos = true;
        await this.fetchWorkspaceRepos({
          limit: this.workspaceReposPaginationParams.limit,
          offset: this.workspaceReposPaginationParams.offset,
          count: this.myReposCount,
        });
        this.isLoadingRepos = false;
      } catch (err) {
        console.error(err);
      }
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../assets/_variables.scss";

.pagination-container {
  display: flex;
  justify-content: flex-end;
}

.empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}
</style>
