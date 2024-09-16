<template>
  <bf-stage>
    <bf-empty-page-state class="empty" v-if="showEmptyState">
      <p>Sorry! Something went wrong.</p>
    </bf-empty-page-state>
    <!-- (1) Automatic Publication check box goes here -->
    <div>(1) automatic publication check box goes here</div>
    <!-- (2) Repo Name Greyed out input select goes here -->
    <div>(2) repo name</div>
    <!-- (3) Name Input Select goes Here -->
    <div>(3) input select</div>
    <!-- (4) Subtitle text box goes here -->
    <div>(4) text box</div>
    <!-- (5) Tags Input Select goes here -->
    <div>(5) tags</div>
  </bf-stage>
</template>

<script>
import BfEmptyPageState from "../shared/bf-empty-page-state/BfEmptyPageState.vue";
import RepoListItem from "./RepoListItem.vue";
import { mapActions, mapState } from "vuex";

export default {
  name: "ConfigureRepo",
  components: {
    RepoListItem,
    BfEmptyPageState,
  },
  data() {
    return {};
  },
  async mounted() {
    console.log("this.$route.params.repoName:", this.$route.params.repoName); // you have the repoId here passed in through route props. Access it like this.
    try {
    } catch (err) {
      console.error(err);
    }
  },
  computed: {
    ...mapState("codeReposModule", []),
    showEmptyState: function () {
      return false; //TODO: add real condition
    },
  },
  methods: {
    ...mapActions("codeReposModule", []),
  },
};
</script>

<style scoped lang="scss">
@import "../../assets/_variables.scss";

.empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}
</style>
