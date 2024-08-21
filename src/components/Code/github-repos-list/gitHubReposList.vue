<template>
  <div id="gitHubReposList">
      <GitHubReposListItem
        v-for="repo in repos"
        :key="repo.id"
        :repo="repo"
      ></GitHubReposListItem>
  </div>
</template>

<script>
import GitHubReposListItem from '../github-repos-list-item/gitHubReposListItem.vue';

export default {
  name: 'GitHubReposList',
  components: {
    GitHubReposListItem,
  },
  props: {
    repos: {
      type: Array,
      required: true,
    },
  },

};
</script>