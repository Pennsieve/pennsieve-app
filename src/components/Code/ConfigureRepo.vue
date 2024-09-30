<template>
  <bf-stage>
    <bf-empty-page-state class="empty" v-if="showEmptyState">
      <p>Sorry! Something went wrong.</p>
    </bf-empty-page-state>
    <!-- (1) Automatic Publication check box goes here -->
    <div>(1) automatic publication check box goes here</div>
    <!-- (2) Name Input Select goes Here -->
    <div>(2) subtitle</div>
    <!-- (3) Subtitle text box goes here -->
    <div>(3) text box</div>
    <!-- (4) Tags Input Select goes here -->
    <div>(4) tags</div>
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
