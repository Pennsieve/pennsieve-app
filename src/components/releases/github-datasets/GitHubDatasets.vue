<template>
  <bf-stage element-loading-background="transparent">

    <bf-empty-page-state class="empty">
      <p>There are no github datasets yet</p>
    </bf-empty-page-state>
  </bf-stage>
</template>

<script>
import { mapGetters, mapActions, mapState } from "vuex";
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";

import { pathOr, propOr } from "ramda";

export default {
  name: "GitHubDatasets",

  components: {
    BfEmptyPageState,
  },

  computed: {
    ...mapGetters(["activeOrganization", "userToken", "config", "hasFeature"]),

    filteredApplications: function () {
      let filteredArray = this.integrations.filter(
        (x) => x.customTargets && x.customTargets.length > 0
      );
      return filteredArray;
    },

    hasAdminRights: function () {
      if (this.activeOrganization) {
        const isAdmin = propOr(false, "isAdmin", this.activeOrganization);
        const isOwner = propOr(false, "isOwner", this.activeOrganization);
        return isAdmin || isOwner;
      } else {
        return null;
      }
    },
    orgName: function () {
      return pathOr("", ["organization", "name"], this.activeOrganization);
    },
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
