<template>
  <div class="integration-list-item">
    <div class="flex-row">
      <div class="compute-node-title">
        {{ computeNode.name }}
      </div>
      <div class="compute-node-account-info">
        ({{ computeNode.account.accountType }}) #{{
          computeNode.account.accountId
        }}
      </div>
    </div>
    <div class="margin-10">
      <div>
        <div class="margin-10">
          {{
            computeNode.environment.charAt(0).toUpperCase() +
            computeNode.environment.slice(1)
          }}
          Node
        </div>
        <div class="margin-10">
          Created Date: {{ this.formatDateFNS(computeNode.createdAt) }}
        </div>
        <div class="margin-10">
          {{ computeNode.description }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import { mapActions, mapState } from "vuex";
import FormatDate from "../../../mixins/format-date";
import { pathOr } from "ramda";

export default {
  name: "ComputeNodesListItem",

  components: {},

  props: {
    computeNode: {
      type: Object,
      default: () => ({}),
    },
  },

  mixins: [FormatDate, Request],

  computed: {
    ...mapState(["orgMembers", "profile"]),
    ...mapGetters(["activeOrganization",  "config"]),
    /**
     * Active organization name
     * @returns {String}
     */
    activeOrgName: function () {
      return pathOr("", ["organization", "name"], this.activeOrganization);
    },
  },

  data: function () {
    return {};
  },
  methods: {
    ...mapActions(["updateDataset"]),
  },
};
</script>

<style scoped lang="scss">
@import "../../../assets/_variables.scss";

.margin-10 {
  margin: 10px;
}

.flex-row {
  display: flex;
  justify-content: space-between;
  background: $purple_tint;
  padding: 8px 16px;
  height: 64px;
  align-items: center;
}

.integration-menu {
  width: 24px;
}

.integration-list-item {
  width: 90%;
  height: 175px;
  border: 1px solid $gray_3;
  //margin: 0 0 16px 0;
  margin: 0 8px 16px 8px;
  //padding:  16px 24px 8px 24px;
  background-color: white;
  display: flex;
  flex-direction: column;
}

.integration-title {
  font-size: 16px;
  margin: 16px 4px;
  color: black;
  text-align: center;
}

.compute-node-title {
  color: $gray_5;
  font-weight: 500;
  font-size: 18px;
  margin: 20px 0px;
}

.compute-node-account-info {
  color: $gray_4;
  font-weight: 500;
  font-size: 18px;
}

.activeSwitch {
  text-align: end;
}

.integration-description {
  font-size: 14px;
  color: $gray_5;
  min-height: 3em;
  max-width: 500px;
  margin: 0 8px;
  overflow-wrap: break-word;
}

.list-item-col-spacer {
  padding-top: 32px;
}

.options-icon {
  float: right;
}

.userIcon {
  /* bottom: 0; */
  height: 100%;
  /* right: 0; */
  /* place-self: flex-end; */
  align-self: self-end;
  /* flex-direction: column; */
  display: flex;
  flex-direction: column-reverse;
  margin: 8px;
}
</style>
