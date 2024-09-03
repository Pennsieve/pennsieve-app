<template>
  <bf-stage>
    <bf-empty-page-state class="empty" v-if="showEmptyState">
      <p>
        You have not linked your Github account to Pennsieve yet. Please link
        your account to see your available repos.
      </p>
    </bf-empty-page-state>
    <MyReposList v-else :repos="myRepos"></MyReposList>
  </bf-stage>
</template>

<script>
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";
import MyReposList from "./MyReposList.vue";
import { mapState, mapActions } from "vuex";

export default {
  name: "MyRepos",
  components: {
    MyReposList,
    BfEmptyPageState,
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
      console.log(this.myRepos);
      return this.myReposLoaded && !this.myRepos.length;
    },
  },
  methods: {
    ...mapActions("codeReposModule", ["fetchMyRepos"]),
  },
};
</script>

<style scoped lang="scss">
.empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}
</style>
