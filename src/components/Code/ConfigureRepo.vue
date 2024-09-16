<template>
  <bf-stage>
    <bf-empty-page-state class="empty" v-if="showEmptyState">
      <p>Sorry! Something went wrong.</p>
    </bf-empty-page-state>
    <div>
      <!-- Configure Repo View goes here -->
      This is the view for {{ $route.params.repoName }}
    </div>
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
    console.log("this.$route:", this.$route.params.repoName); // you have the repoId here passed in through route props. Access it like this.
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
