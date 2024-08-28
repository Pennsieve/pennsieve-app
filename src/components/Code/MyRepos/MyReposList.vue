<template>
  <div id="gitHubReposList">
    <MyReposListItem
      :isTracked="false"
      v-for="repo in repos"
      :key="repo.id"
      :repo="repo"
    ></MyReposListItem>
  </div>
</template>

<script>
import MyReposListItem from "./MyReposListItem.vue";

export default {
  name: "MyReposList",
  components: {
    MyReposListItem,
  },
  props: {
    repos: {
      type: Array,
      required: true,
    },
  },
};
</script>
