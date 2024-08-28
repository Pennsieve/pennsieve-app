<template>
  <bf-stage>
    <bf-empty-page-state class="empty" v-if="!repos || repos.length === 0">
      <p>
        You have not linked your github account to Pennsieve yet. Please link
        your account to see your available repos.
      </p>
    </bf-empty-page-state>
    <MyReposList v-else :repos="repos"></MyReposList>
  </bf-stage>
</template>

<script>
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";
import MyReposList from "./MyReposList.vue";
import { mapState } from "vuex";

export default {
  name: "MyRepos",
  beforeRouteEnter(to, from, next) {
    next((vm) => {
      vm.$store.dispatch("releasesModule/fetchGitHubRepos");
    });
  },
  components: {
    MyReposList,
    BfEmptyPageState,
  },
  computed: {
    ...mapState("releasesModule", {
      repos: (state) => state.gitHubRepos,
    }),
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
