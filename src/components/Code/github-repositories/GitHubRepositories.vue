<template>
  <bf-stage>
    <bf-empty-page-state class="empty" v-if="!repos || repos.length === 0">
      <p>There are no github repositories yet</p>
    </bf-empty-page-state>
    <GitHubReposList v-else :repos="repos"></GitHubReposList>
  </bf-stage>
</template>

<script>
import BfEmptyPageState from '../../shared/bf-empty-page-state/BfEmptyPageState.vue';
import GitHubReposList from '../github-repos-list/gitHubReposList.vue';
import { mapState } from 'vuex';

export default {
  name: 'GitHubRepositories',
  beforeRouteEnter(to, from, next) {
    next(vm => {
      vm.$store.dispatch('releasesModule/fetchGitHubRepos');
    });
  },
  components: {
    GitHubReposList,
    BfEmptyPageState,
  },
  computed: {
    ...mapState('releasesModule', {
      repos: state => state.gitHubRepos,
    })
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
