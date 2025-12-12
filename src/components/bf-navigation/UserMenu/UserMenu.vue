<template>
  <div class="user-menu-wrap">
    <el-popover
      style="--el-popover-padding: 102px"
      ref="userMenu"
      placement="right-end"
      width="260"
      transition=""
      :visible="menuOpen"
      :show-arrow="false"
      :disabled="pageNotFound"
    >
      <template #reference>
        <button
          v-if="!pageNotFound"
          class="user-menu bf-navigation-item"
          :class="{ active: menuOpen }"
          :disabled="!isDataLoaded"
          @focus="onUserMenuMouseenter"
          @blur="onUserMenuMouseleave"
          @mouseenter="onUserMenuMouseenter"
          @mouseleave="onUserMenuMouseleave"
        >
          <avatar v-if="isDataLoaded" />
          <div v-else class="avatar-circle loading-avatar">
            <span class="avatar-initials">...</span>
          </div>

          <div class="info">
            <span v-if="isDataLoaded" id="user-name">
              {{ displayName }}
            </span>
            <span v-else id="user-name" class="loading-text">&nbsp;</span>

            <span v-if="isDataLoaded" id="organization-name">
              {{ organizationName }}
            </span>
            <span v-else id="organization-name" class="loading-text"
              >&nbsp;</span
            >

            <span v-if="isWorkspaceGuest && isDataLoaded" id="workspace-guest">
              (workspace guest)
            </span>
          </div>

          <IconArrowRight
            slot="suffix"
            class="icon-caret"
            :height="10"
            :width="10"
          />
        </button>
        <button v-else class="user-menu">
          <a href="https://app.pennsieve.io">
            <div class="person-circle">
              <IconPerson :width="52" :height="20" />
            </div>
          </a>
        </button>
      </template>

      <div
        @mouseover="onUserMenuMouseover"
        @mouseenter="onUserMenuMouseenter"
        @mouseleave="onUserMenuMouseleave"
      >
        <div class="bf-menu">
          <div class="bf-menu scroll-menu">
            <ul>
              <li
                v-for="org in filteredOrganizations"
                :key="org.organization.id"
              >
                <a
                  href="#"
                  class="bf-menu-item"
                  @click.prevent="switchOrganization(org)"
                >
                  {{ org.organization.name }}
                  <IconCheck
                    v-if="org.organization.name === organizationName"
                    class="icon-check"
                    :width="20"
                    :height="20"
                    color="black"
                  />
                </a>
              </li>
            </ul>
          </div>
          <hr />
          <ul>
            <li>
              <a class="bf-menu-item" href="#" @click.prevent="onSignOutClick">
                Exit Workspace
              </a>
            </li>
          </ul>
        </div>
      </div>
    </el-popover>
  </div>
</template>

<script>
import { mapState, mapActions } from "vuex";
import { propOr, pathOr } from "ramda";

import BfNavigationItem from "../bf-navigation-item/BfNavigationItem.vue";
import Avatar from "../../shared/avatar/Avatar.vue";
import FilterInput from "../../shared/FilterInput/FilterInput.vue";
import FilterEmptyState from "../../shared/FilterEmptyState/FilterEmptyState.vue";

import EventBus from "../../../utils/event-bus";
import IconArrowRight from "../../icons/IconArrowRight.vue";
import IconCheck from "../../icons/IconCheck.vue";
import IconPerson from "../../icons/IconPerson.vue";

export default {
  name: "UserMenu",

  components: {
    IconPerson,
    IconCheck,
    IconArrowRight,
    BfNavigationItem,
    Avatar,
    FilterInput,
    FilterEmptyState,
  },

  data() {
    return {
      menuOpen: false,
      orgMenuOpen: false,
      orgFilterName: "",
      userMenuMouseover: false,
      isCreateOrgDialogVisible: false,
    };
  },

  computed: {
    ...mapState(["profile", "activeOrganization", "organizations"]),

    /**
     * Check if profile and organization data is loaded
     * @returns {Boolean}
     */
    isDataLoaded: function () {
      return Object.keys(this.profile).length > 0;
    },

    /**
     * Checks if route is a 404 page
     * @returns {Boolean}
     */
    pageNotFound: function () {
      return this.$route.name === "page-not-found";
    },

    /**
     * Compute active organization id
     * @returns {String}
     */
    activeOrganizationId: function () {
      return pathOr(
        "Organization",
        ["organization", "id"],
        this.activeOrganization
      );
    },

    /**
     * Compute organizations based off of filter
     * @return {Array}
     */
    filteredOrganizations: function () {
      if (this.organizations.length) {
        // // Update the org menu's position when the list changes
        // this.$nextTick(() => {
        //   this.$refs.orgMenu.updatePopper()
        // })

        return this.organizations
          .filter((organization) => {
            return (
              organization.organization.name
                .toLowerCase()
                .indexOf(this.orgFilterName.toLowerCase()) > -1 &&
              organization.organization.name != "Welcome"
            );
          })
          .sort((a, b) => {
            const nameA = a.organization.name.toLowerCase();
            const nameB = b.organization.name.toLowerCase();
            return nameA.localeCompare(nameB);
          });
      }

      return [];
    },
    welcomeOrganization: function () {
      if (this.organizations.length) {
        let welcomeOrgs = this.organizations.filter((org) => {
          return org.organization.name == "Welcome";
        });
        return welcomeOrgs[0];
      }
    },

    /**
     * Computes user's display name
     * @returns {String}
     */
    displayName: function () {
      const firstName = propOr("", "firstName", this.profile);
      const lastName = propOr("", "lastName", this.profile);
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName || "";
    },

    /**
     * Compute active organization name or user email for my-workspace
     * @returns {String}
     */
    organizationName: function () {
      // Check if we're in my-workspace (no active organization)
      const orgId = pathOr("", ["organization", "id"], this.activeOrganization);
      if (!orgId || orgId === "") {
        // Return user email when in my-workspace
        return propOr("", "email", this.profile);
      }
      // Return organization name when in an organization
      return pathOr("----", ["organization", "name"], this.activeOrganization);
    },

    isWorkspaceGuest: function () {
      const isGuest = propOr(false, "isGuest", this.activeOrganization);
      return isGuest;
    },

    /**
     * Compute if the filter should be shown
     * @returns {Boolean}
     */
    showOrgFilter: function () {
      return this.organizations.length >= 20;
    },
  },

  methods: {
    /**
     * Close all menus
     */
    closeMenus: function () {
      this.orgMenuOpen = false;
      this.menuOpen = false;
    },

    /**
     * Switch organization
     * @param {Object} org
     */
    switchOrganization: function (org) {
      this.closeMenus();

      EventBus.$emit("switch-organization", org);
    },

    /**
     * Callback for when the org menu is shown
     */
    onOrgMenuShow: function () {
      this.$nextTick(() => {
        this.$refs.inputFilterName.focus();
      });
    },

    /**
     * Callback for when the org menu is hidden
     * Use `setTimeout` rather than nextTick to ensure
     * the menu is hidden before resetting
     */
    onOrgMenuHide: function () {
      window.setTimeout(() => {
        this.orgFilterName = "";
      }, 100);
    },

    /**
     * Callback for mouseleave
     * Hide org menu
     */
    onOrgMenuMouseleave: function () {
      clearTimeout(this._timerOrgMenu);
      this._timerOrgMenu = setTimeout(() => {
        this.orgMenuOpen = false;

        // Close user menu if the user is not over it
        if (this.userMenuMouseover === false) {
          this.menuOpen = false;
        }
      }, 200);
    },

    /**
     * Callback for mouseenter on org menu
     * Show org menu
     */
    onOrgMenuMouseenter: function () {
      clearTimeout(this._timerOrgMenu);
      this._timerOrgMenu = setTimeout(() => {
        this.orgMenuOpen = true;
      }, 100);
    },

    /**
     * Callback for mouseover on user menu
     */
    onUserMenuMouseover: function () {
      this.userMenuMouseover = true;
    },

    /**
     * Callback for mouseleave on user menu
     * Hide user menu
     */
    onUserMenuMouseleave: function () {
      this.userMenuMouseover = false;
      clearTimeout(this._timerUserMenu);

      if (this.orgMenuOpen || this.userMenuMouseover) {
        return;
      }

      this._timerUserMenu = setTimeout(() => {
        this.menuOpen = false;
      }, 200);
    },

    /**
     * Callback for mouseenter on user menu
     * Show user menu
     */
    onUserMenuMouseenter: function () {
      if (!this.pageNotFound) {
        clearTimeout(this._timerUserMenu);
        this._timerUserMenu = setTimeout(() => {
          this.menuOpen = true;
        }, 200);
      }
    },

    /**
     * Callback for sign out menu option click
     * Dispatch event to log the user out
     */
    onSignOutClick: function () {
      this.closeMenus();

      EventBus.$emit("logout");
    },
  },
};
</script>

<style lang="scss" scoped>
@use "../../../styles/theme";
@use "../../../styles/element/dropdown";
@use "../../../styles/element/select";
@use "../../../styles/bfmenu";
@use "../../../styles/element/popover";

.user-menu-wrap {
  --el-popover-padding: 0;
  --el-popover-bg-color: theme.$purple_2;
}

.person-circle {
  margin-left: 11px;
  position: relative;
  align-items: center;
  background: transparent;
  border: solid 2px #fff;
  border-radius: 50%;
  box-sizing: border-box;
  color: theme.$white;
  display: inline-flex;
  font-weight: 600;
  height: 32px;
  overflow: hidden;
  width: 32px;
}
.user-menu-wrap {
  background: theme.$purple_3;
  .secondary & {
    background: theme.$gray_2;
  }
}
.user-menu {
  cursor: pointer;
  height: 74px;
  &:disabled {
    cursor: default;
    pointer-events: none;
  }
}

#user-name {
  font-weight: 500;
}
#organization-name {
  font-size: 12px;
}
#workspace-guest {
  font-size: 10px;
  color: #999999;
}
.info {
  flex: 1;
  margin: 0 8px 0 12px;
  overflow: hidden;
  white-space: nowrap;
  .condensed & {
    margin-left: 16px;
  }
  span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
.filter-input {
  border-bottom: none;
  border-top: 1px solid theme.$gray_2;
}

.user-menu-org-menu {
  margin-left: 0 !important;
}
.user-menu-popover {
  margin-left: 16px !important;
}
.icon-check {
  margin-top: -4px;
  float: right;
  color: theme.$gray_4;
}

.loading-avatar {
  background: theme.$gray_3;
  border: 2px solid #fff;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: theme.$gray_4;
}

.loading-text {
  display: block;
  background: theme.$gray_3;
  border-radius: 4px;
  height: 1em;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
