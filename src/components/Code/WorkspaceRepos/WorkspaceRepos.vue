<template>
  <bf-stage element-loading-background="transparent">
    <bf-empty-page-state class="empty">
      <p>There are no Workspace Repositories yet</p>
    </bf-empty-page-state>
  </bf-stage>
</template>

<script>
import { mapGetters } from "vuex";
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";

export default {
  name: "WorkspaceRepos",

  components: {
    BfEmptyPageState,
  },

  computed: {
    ...mapGetters(["hasFeature"]),
  },

  watch: {},

  beforeRouteEnter(to, from, next) {
    next((vm) => {
      if (vm.hasFeature("sandbox_org_feature")) {
        vm.$router.push({ name: "create-org" });
      }
    });
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
