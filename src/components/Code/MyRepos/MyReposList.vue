<template>
  <bf-stage>
    <bf-empty-page-state class="empty" v-if="showEmptyState">
      <p>
        You have not linked your Github account to Pennsieve yet. Please link
        your account to see your available repos.
      </p>
    </bf-empty-page-state>
    <div class="pagination-container">
      <el-pagination
        :page-size="myReposPaginationParams.size"
        :current-page="myReposPaginationParams.currentPage"
        layout="prev, pager, next"
        :total="myReposCount"
        @current-change="onPaginationPageChange"
      />
    </div>
    <div v-loading="isLoadingRepos">
      <RepoListItem
        myReposView
        :isTracked="repo.tracking"
        v-for="repo in myRepos"
        :key="repo.id"
        :repo="repo"
      ></RepoListItem>
    </div>
  </bf-stage>
</template>

<script>
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";
import RepoListItem from "../RepoListItem.vue";
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
      this.fetchMyRepos({
        page: this.myReposPaginationParams.page,
        size: this.myReposPaginationParams.size,
        count: this.myReposCount,
      });
    } catch (err) {
      console.error(err);
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
      console.log("onPaginationPageChange with page:", page);
      try {
        this.isLoadingRepos = true;
        await this.fetchMyRepos({
          page,
          size: this.myReposPaginationParams.size,
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
@import "../../../assets/_variables.scss";

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
