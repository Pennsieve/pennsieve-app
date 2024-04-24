<template>
  <bf-stage element-loading-background="transparent">
    <div v-if="accounts.length > 0" class="accounts-list">
      <accounts-list-item
        v-for="account in accounts"
        :key="account.accountId"
        :account="account"
      />
    </div>

    <bf-empty-page-state v-else class="empty">
      <img
        src="../../../assets/images/illustrations/illo-collaboration.svg"
        height="240"
        width="247"
        alt="Teams illustration"
      />
      <div v-if="hasAdminRights" class="copy">
        <h2>There are no accounts registered for {{ orgName }} yet.</h2>
        <p>
          Accounts are registered for the organization and contain Compute
          Nodes, which users can select to run their data analysis applications
          and workflows. Contact Pennsieve Support to get started.
        </p>
      </div>
      <div v-if="!hasAdminRights" class="copy">
        <h2>{{ orgName }} doesn't have any integrations yet.</h2>
        <p>
          Contact your administrator to get started working with Integrations.
        </p>
      </div>
    </bf-empty-page-state>
  </bf-stage>
</template>

<script>
import { mapGetters, mapActions, mapState } from "vuex";

import BfRafter from "../../shared/bf-rafter/BfRafter.vue";
import BfButton from "../../shared/bf-button/BfButton.vue";
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";

import AccountsListItem from "../AccountsListItem/AccountsListItem.vue";

import { pathOr, propOr } from "ramda";

export default {
  name: "AccountsList",

  components: {
    BfEmptyPageState,
    BfRafter,
    BfButton,
    AccountsListItem,
  },

  props: {
    accounts: {
      type: Array,
      default: () => [],
    },
  },

  data() {
    return {};
  },

  computed: {
    ...mapGetters(["activeOrganization", "userToken", "config", "hasFeature"]),

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

  methods: {
    ...mapActions(),
    ...mapState([]),
  },
};
</script>

<style scoped lang="scss">
@import "../../../assets/variables";

.addIntegrationContainer {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-end;
}

.empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.accounts-list {
  display: flex;
  flex-direction: column;
  flex-flow: wrap;
  margin: 16px 0;
}

.description {
  max-width: 500px;
}

.reg-button {
  align-self: flex-start;
}

.copy {
  h2 {
    font-size: 16px;
    font-weight: 600;
    line-height: 16px;
    text-align: center;
  }

  p {
    color: #71747c;
    font-size: 14px;
    line-height: 16px;
    text-align: center;
    margin-bottom: 16px;
  }
}
</style>
