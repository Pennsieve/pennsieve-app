<template>
  <bf-stage v-loading="isLoadingRepos" element-loading-text="Loading...">
    <bf-empty-page-state class="empty" v-if="showEmptyState">
      <p>
        You have not linked your Github account to Pennsieve yet. Please link
        your account to see your available repos.
      </p>
    </bf-empty-page-state>
    <div class="pagination-container">
      <el-pagination
        v-if="myReposCount"
        :page-size="myReposPaginationParams.size"
        :current-page="myReposPaginationParams.currentPage"
        layout="prev, pager, next"
        :total="myReposCount"
        @current-change="onPaginationPageChange"
      />
    </div>
    <div>
      <RepoListItem
        myReposView
        :isTracked="repo.tracking"
        v-for="repo in myRepos"
        :key="repo.id"
        :repo="repo"
      ></RepoListItem>
    </div>
    <div class="pagination-container">
      <el-pagination
        v-if="myReposCount && myRepos.length > 5"
        :page-size="myReposPaginationParams.size"
        :current-page="myReposPaginationParams.currentPage"
        layout="prev, pager, next"
        :total="myReposCount"
        @current-change="onPaginationPageChange"
      />
    </div>
  </bf-stage>
</template>

<script>
import BfEmptyPageState from "../shared/bf-empty-page-state/BfEmptyPageState.vue";
import RepoListItem from "./RepoListItem.vue";
import { mapActions, mapState } from "vuex";

export default {
  name: "MyReposList",
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
      this.isLoadingRepos = true;
      await this.fetchMyRepos({
        page: this.myReposPaginationParams.page,
        size: this.myReposPaginationParams.size,
      });
    } catch (err) {
      console.error(err);
    } finally {
      this.isLoadingRepos = false;
    }
  },
  computed: {
    ...mapState("codeReposModule", [
      "myRepos",
      "myReposLoaded",
      "myReposPaginationParams",
      "myReposCount",
    ]),
    showEmptyState: function () {
      return this.myReposLoaded && !this.myRepos.length;
    },
  },
  methods: {
    ...mapActions("codeReposModule", ["fetchMyRepos"]),
    onPaginationPageChange: async function (page) {
      try {
        this.isLoadingRepos = true;
        await this.fetchMyRepos({
          page,
          size: this.myReposPaginationParams.size,
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
