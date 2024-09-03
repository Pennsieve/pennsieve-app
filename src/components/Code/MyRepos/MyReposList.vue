<template>
  <div id="gitHubReposList">
    <div class="pagination-container">
      <el-pagination
        :page-size="myReposPaginationParams.size"
        :current-page="2"
        layout="prev, pager, next"
        :total="myReposCount"
        @current-change="onPaginationPageChange"
      />
    </div>
    <RepoListItem
      :isTracked="false"
      v-for="repo in repos"
      :key="repo.id"
      :repo="repo"
    ></RepoListItem>
  </div>
</template>

<script>
import RepoListItem from "../RepoListItem.vue";
import { mapActions, mapGetters, mapState } from "vuex";

export default {
  name: "MyReposList",
  components: {
    RepoListItem,
  },
  props: {
    repos: {
      type: Array,
      required: true,
    },
  },
  data() {},
  computed: {
    ...mapState("codeReposModule", ["myReposCount", "myReposPaginationParams"]),
  },
  methods: {
    ...mapActions("codeReposModule", ["fetchMyRepos"]),
    /**
     * Update offset
     */
    onPaginationPageChange: async function (page) {
      console.log("onPaginationPageChange with page:", page);
      try {
        this.fetchMyRepos({
          page,
          size: this.myReposPaginationParams.size,
          count: this.myReposCount,
        });
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
</style>
