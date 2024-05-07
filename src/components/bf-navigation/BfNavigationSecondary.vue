<template>
  <div
    class="bf-navigation secondary"
    :class="[secondaryNavCondensed ? 'condensed' : '']"
  >
    <div class="menu-wrap">
      <div
        class="heading-wrap"
        :style="{ backgroundColor: `${secNavHeaderCollapsedStyle}` }"
      >
        <template v-if="!secondaryNavCondensed">
          <div>
            <el-dropdown
              class="dataset-status-dropdown"
              trigger="click"
              placement="bottom-start"
              @command="updateDatasetStatus"
              @visible-change="datasetFilterOpen = $event"
            >
              <button
                class="dataset-filter-dropdown el-dropdown-link"
                :disabled="!getPermission('manager')"
              >
                <span class="dataset-info">
                  <div
                    :style="{ 'background-color': checkStatusColor }"
                    class="dot main-status"
                  />
                  <div class="dataset-status">
                    {{ formatDatasetStatus }}
                  </div>
                </span>
                <IconArrowUp
                  v-if="getPermission('manager')"
                  :class="[datasetFilterArrowDir === 'down' ? 'svg-flip' : '']"
                  :height="7"
                  :width="7"
                  color="#000000"
                />
              </button>
              <template #dropdown>
                <el-dropdown-menu
                  class="bf-menu auto-height"
                  :offset="14"
                  :arrow-offset="150"
                >
                  <el-dropdown-item
                    v-for="status in filterOrgStatusList"
                    :key="status.id"
                    class="status-item"
                    :command="getStatusCommand(status)"
                  >
                    <span class="status-dot" :style="getDotColor(status)" />
                    {{ status.displayName }}
                    <IconCheck
                      v-if="formatDatasetStatus === `${status.displayName}`"
                      class="dataset-filter-status-check"
                      :width="20"
                      :height="20"
                    />
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div>
            <button
              class="btn-expand-collapse"
              name="Collapse Secondary Menu"
              @click="toggleMenu"
            >
              <IconNavCollapse color="#71747C" />
            </button>
          </div>
        </template>
        <template v-else>
          <button
            class="btn-expand-collapse"
            name="Expand Secondary Menu"
            @click="toggleMenu"
          >
            <IconNavExpand color="#ffF" :height="32" :width="32" />
          </button>
        </template>
      </div>

      <template v-if="getPermission('editor')">
        <create-button :condensed="secondaryNavCondensed" />
        <hr />
      </template>

      <bf-navigation-item
        :link="{ name: 'dataset-overview' }"
        label="Overview"
        :condensed="secondaryNavCondensed"
        :secondary="true"
        :style-color="getThemeColors[0]"
        :org-id="orgId"
      >
        <template #icon>
          <IconOverview color="currentColor" :height="20" :width="20" />
        </template>
      </bf-navigation-item>

      <!--      <bf-navigation-item-->
      <!--        :link="{ name: 'metadata' }"-->
      <!--        icon="icon-explore-dataset"-->
      <!--        label="Records"-->
      <!--        class="secondary"-->
      <!--        :condensed="secondaryNavCondensed"-->

      <!--      />-->

      <bf-navigation-item
        :link="{ name: 'dataset-files' }"
        label="Files"
        :condensed="secondaryNavCondensed"
        :secondary="true"
        :style-color="getThemeColors[0]"
        :org-id="orgId"
      >
        <template #icon>
          <IconFiles color="currentColor" :height="20" :width="20" />
        </template>

        <bf-waiting-icon v-if="uploading" slot="suffix" />
      </bf-navigation-item>

      <bf-navigation-item
        v-if="getPermission('manager')"
        :link="{ name: 'metadata' }"
        label="Metadata"
        class="secondary"
        :condensed="secondaryNavCondensed"
        :secondary="true"
        :style-color="getThemeColors[0]"
        :org-id="orgId"
      >
        <template #icon>
          <IconGraph color="currentColor" :height="20" :width="20" />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        :link="{ name: 'dataset-activity' }"
        label="Activity"
        :secondary="true"
        :condensed="secondaryNavCondensed"
        :style-color="getThemeColors[0]"
        :org-id="orgId"
      >
        <template #icon>
          <IconActivity color="currentColor" :height="20" :width="20" />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        :link="{ name: 'integrations-settings' }"
        label="Applications"
        :condensed="secondaryNavCondensed"
        :secondary="true"
        :style-color="getThemeColors[0]"
        :org-id="orgId"
      >
        <template #icon>
          <IconIntegrations color="currentColor" :height="20" :width="20" />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        :link="{ name: 'publishing-settings' }"
        label="Publishing"
        class="secondary"
        :condensed="secondaryNavCondensed"
        :secondary="true"
        :style-color="getThemeColors[0]"
        :org-id="orgId"
      >
        <template #icon>
          <IconGlobeCheck color="currentColor" :height="20" :width="20" />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        :link="{ name: 'dataset-permissions' }"
        label="Permissions"
        class="secondary"
        :secondary="true"
        :condensed="secondaryNavCondensed"
        :style-color="getThemeColors[0]"
        :org-id="orgId"
      >
        <template #icon>
          <IconCollaborators color="currentColor" :height="20" :width="20" />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        v-if="getPermission('manager')"
        :link="{ name: 'dataset-settings' }"
        label="Settings"
        :secondary="true"
        :condensed="secondaryNavCondensed"
        :style-color="getThemeColors[0]"
        :org-id="orgId"
      >
        <template #icon>
          <IconDatasetSettings color="currentColor" :height="20" :width="20" />
        </template>
      </bf-navigation-item>
    </div>

    <span class="collapse-handle" @click="toggleMenu" />
    <bf-navigation-tertiary
      v-if="secondaryNavCondensed"
      :bk-color="tertiaryNavColor"
    />
  </div>
</template>

<script>
import BfNavigationItem from "./bf-navigation-item/BfNavigationItem.vue";
import BfNavigationTertiary from "../bf-navigation-tertiary/BfNavigationTertiary.vue";
import BfWaitingIcon from "../shared/bf-waiting-icon/bf-waiting-icon.vue";
import CreateButton from "./create-button/CreateButton.vue";

import { mapGetters, mapActions, mapState } from "vuex";
import { path, pathOr } from "ramda";
import EventBus from "../../utils/event-bus";

import Request from "../../mixins/request/index";
import IconArrowUp from "../icons/IconArrowUp.vue";
import IconNavCollapse from "../icons/IconNavCollapse.vue";
import IconNavExpand from "../icons/IconNavExpand.vue";
import IconOverview from "../icons/IconOverview.vue";
import IconDatasetSettings from "../icons/IconDatasetSettings.vue";
import IconFiles from "../icons/IconFiles.vue";
import IconGlobeCheck from "../icons/IconGlobeCheck.vue";
import IconActivity from "../icons/IconActivity.vue";
import IconCollaborators from "../icons/IconCollaborators.vue";
import IconGraph from "../icons/IconGraph.vue";
import CustomTheme from "../../mixins/custom-theme";

export default {
  name: "BfNavigationSecondary",

  components: {
    IconGraph,
    IconCollaborators,
    IconActivity,
    IconGlobeCheck,
    IconFiles,
    IconDatasetSettings,
    IconOverview,
    IconNavExpand,
    IconNavCollapse,
    IconArrowUp,
    BfNavigationItem,
    BfNavigationTertiary,
    BfWaitingIcon,
    CreateButton,
  },

  mixins: [Request, CustomTheme],
  props: {
    orgId: {
      type: String,
      default: "",
    },
    datasetId: {
      ype: String,
      default: "",
    },
  },

  data: function () {
    return {
      datasetNameTruncated: false,
      // @NOTE - static data for now. Remove once data dynamic and in vuex
      datasetFilterOpen: false,
      statusDropdownDisabled: false,
    };
  },

  computed: {
    ...mapState(["dataset", "secondaryNavCondensed", "orgDatasetStatuses"]),

    ...mapGetters([
      "activeOrganization",
      "primaryNavOpen",
      "uploading",
      "hasFeature",
      "getPermission",
      "userToken",
      "config",
    ]),
    getThemeColors: function () {
      return this.getTheme(this.orgId);
    },
    secNavHeaderCollapsedStyle: function () {
      if (this.secondaryNavCondensed) {
        const themeColors = this.getThemeColors;
        const color1 = themeColors[1];
        return `${color1}`;
      } else {
        return "";
      }
    },
    workspaceBackgroundStyle: function () {
      const color1 = this.pSBC(0.8, this.getThemeColors[1]);
      return `${color1}`;
    },
    tertiaryNavColor: function () {
      if (this.secondaryNavCondensed) {
        const themeColors = this.getThemeColors;
        const color1 = themeColors[0];
        return `${color1}`;
      } else {
        return "";
      }
    },

    /**
     * Filters empty status names from orgDatasetStatuses
     * @returns {Array}
     */
    filterOrgStatusList: function () {
      return this.orgDatasetStatuses.filter((status) => {
        return status.displayName !== "";
      });
    },

    /**
     * Active organization id
     * @returns {String}
     */
    activeOrgId: function () {
      return pathOr("", ["organization", "id"], this.activeOrganization);
    },

    /**
     * Compute full dataset name
     * @returns {String}
     */
    datasetName: function () {
      return pathOr("", ["content", "name"], this.dataset);
    },

    /**
     * Check if status dropdown is disabled based on user permission
     * @returns {Boolean}
     */
    checkStatusPermission: function () {
      return !this.getPermission("owner") || !this.getPermission("manager")
        ? true
        : false;
    },

    /**
     * Returns the dataset status displayName
     * @returns {String}
     */
    formatDatasetStatus: function () {
      return pathOr("", ["status", "displayName"], this.dataset);
    },

    /**
     * Returns dataset filter arrow direction
     * @returns {String}
     */
    datasetFilterArrowDir: function () {
      return this.datasetFilterOpen ? "up" : "down";
    },

    /**
     * Returns color for dataset status
     * @returns {String}
     */
    checkStatusColor: function () {
      return pathOr("", ["status", "color"], this.dataset);
    },

    /**
     * Compute dataset display name
     * Truncates after 20 characters
     * @returns {String}
     */
    datasetNameDisplay: function () {
      const name = this.datasetName;

      if (name.length > 20) {
        this.datasetNameTruncated = true;
        return `${name.slice(0, 17)}...`;
      } else {
        this.datasetNameTruncated = false;
      }
      return name;
    },

    getDatasetUpdateUrl: function () {
      const url = pathOr("", ["config", "apiUrl"])(this);
      const datasetId = path(["content", "id"], this.dataset);

      if (!url) {
        return "";
      }

      return `${url}/datasets/${datasetId}?api_key=${this.userToken}`;
    },
  },

  watch: {
    /**
     * Watcher for dataset status url
     */
    getDatasetStatusUrl: {
      handler: function (val) {
        if (val && this.activeOrgId) {
          this.getAllDatasetStatuses();
        }
      },
      immediate: true,
    },
  },

  mounted() {
    this.toggleSecondaryNav(true);
  },

  beforeUnmount() {
    this.toggleSecondaryNav(false);
  },

  methods: {
    ...mapActions([
      "toggleSecondaryNav",
      "togglePrimaryNav",
      "condenseSecondaryNav",
      "updateDataset",
      "setDataset",
    ]),

    /**
     * Returns dataset status name based on command selection in menu
     * @returns {String}
     */
    getStatusCommand: function (status) {
      return status.displayName;
    },

    /**
     * Returns dataset status dot styling based on status color
     * @returns {Object}
     */
    getDotColor: function (status) {
      const obj = {
        backgroundColor: `${status.color}`,
      };

      return obj;
    },

    toggleMenu: function () {
      this.togglePrimaryNav(!this.primaryNavOpen);
      this.condenseSecondaryNav(!this.secondaryNavCondensed);
    },

    /**
     * Updates a dataset's status based on
     * status menu selection
     * @param {String}
     */
    updateDatasetStatus: function (command) {
      const status = this.orgDatasetStatuses.find((status) => {
        return status.displayName === command;
      });

      if (!this.getDatasetUpdateUrl) {
        return;
      }

      // API request to update the status
      this.sendXhr(this.getDatasetUpdateUrl, {
        method: "PUT",
        body: {
          status: status.name,
        },
      })
        .then((response) => {
          EventBus.$emit("toast", {
            detail: {
              msg: "Your status has been saved",
            },
          });

          this.updateDataset(response);
          this.setDataset(response);
        })
        .catch(this.handleXhrError.bind(this));
    },
  },
};
</script>

<style scoped lang="scss">
@import "bf-navigation";
@import "../../assets/_variables.scss";
@import "../../assets/components/_dataset-status.scss";

.bf-navigation {
  background: $gray_1;
  box-shadow: -1px 0 0 rgba(64, 69, 84, 0.2) inset;
  padding-right: 1px;
  z-index: 99;
}

hr {
  background-color: $gray_2;
  height: 1px;
  border: 0;
  margin: 0 24px;
  .condensed & {
    margin: 0;
  }
}

.menu-wrap {
  margin-top: 0 !important;
}

.heading-wrap {
  box-sizing: border-box;
  color: $gray_6;
  padding: 21px 24px 0px;

  //background-color: $gray_2;
  //border-bottom: 1px solid $gray_2;
  display: flex;
  justify-content: space-between;
  white-space: nowrap;
  font-size: 14px;
  align-items: baseline;

  .condensed & {
    background: $purple_1;
    height: 56px;
    padding: 10px;
  }

  .btn-expand-collapse {
    margin-right: -4px;
    margin-bottom: 10px;
  }

  .svg-icon {
    width: 24px;
    height: 24px;
  }
}

.dataset-info {
  display: flex;
  align-items: center;
  .dataset {
    color: $gray_4;
    font-size: 12px;
  }

  .dataset-status {
    color: $gray_4;
    font-size: 14px;
    font-weight: normal;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
    margin-right: 5px;
    margin-left: 4px;
  }

  .dataset-name {
    font-weight: bold;
    font-size: 12px;
    color: $gray_6;
    margin-left: 4px;
  }
}

.dot {
  height: 12px;
  width: 12px;
  margin-right: 4px;
  border-radius: 50%;
  display: inline-block;

  &.main-status {
    margin-right: 2px;
  }
}

.wip-item {
  .dot {
    background-color: $purple_1;
  }
}

.dataset-filter-status-check {
  margin: -2px 0;
  float: right;
}

.dataset-filter-dropdown {
  display: flex;
  align-items: center;
}

.el-popper[x-placement^="bottom"] {
  margin-top: 5px;
  margin-left: -13px;
}

.status-wrap {
  display: flex;
  flex-direction: row;
}
</style>
