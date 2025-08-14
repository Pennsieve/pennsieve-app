<template>
  <div
    class="bf-navigation primary"
    :class="[
      primaryNavCondensed || pageNotFound || secondaryNavOpen
        ? 'condensed'
        : '',
    ]"
    :style="{ backgroundImage: `${workspaceBackgroundStyle}` }"
  >
    <div class="logo-wrap">
      <router-link v-if="!pageNotFound" tag="button" :to="logoRoute">
        <component
          :is="MarkComponent"
          v-show="!primaryNavCondensed || secondaryNavOpen"
          :class="logoClass"
          color="currentColor"
        />
      </router-link>
      <a v-else :href="logoLink">
        <pennsieve-mark
          v-show="!primaryNavCondensed || secondaryNavOpen"
          class="logo"
          :width="24"
          :height="24"
          color="currentColor"
        >
        </pennsieve-mark>
      </a>
      <button
        v-show="!secondaryNavOpen && !pageNotFound"
        class="btn-expand-collapse"
        name="Toggle Primary Menu"
        @click="toggleMenu"
      >
        <IconNavCollapse
          :is-visible="!primaryNavCondensed"
          :width="primaryNavCondensed ? 32 : 24"
          :height="primaryNavCondensed ? 32 : 24"
          color="#fff"
          class="collapse"
        >
        </IconNavCollapse>
        <IconNavExpand
          :is-visible="primaryNavCondensed"
          :width="primaryNavCondensed ? 32 : 24"
          :height="primaryNavCondensed ? 32 : 24"
          color="#fff"
          class="collapse"
        >
        </IconNavExpand>
      </button>
    </div>

    <div class="menu-wrap">
      <bf-navigation-item
        v-if="!(pageNotFound || isWelcomeOrg)"
        :link="{
          name: 'datasets-list',
          params: { orgId: activeOrganizationId },
        }"
        label="Datasets"
        :condensed="primaryNavCondensed"
        :styleColor="navStyleColor"
      >
        <template v-slot:icon>
          <IconDatasets :width="20" :height="20" color="currentColor" />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        v-if="!(pageNotFound || isWelcomeOrg) && !isWorkspaceGuest"
        id="nav-integrations"
        :link="{
          name: 'analysis',
          params: { orgId: activeOrganizationId },
        }"
        label="Analysis
        "
        :condensed="primaryNavCondensed"
        :styleColor="navStyleColor"
      >
        <template v-slot:icon>
          <IconIntegrations :width="20" :height="20" color="currentColor" />
        </template>
      </bf-navigation-item>

      <div>
        <!-- <bf-navigation-item
          v-if="!(pageNotFound || isWelcomeOrg) && !isWorkspaceGuest"
          :link="{
            name: 'code',
            params: { orgId: activeOrganizationId },
          }"
          label="Code"
          :condensed="primaryNavCondensed"
          :styleColor="navStyleColor"
        >
          <template v-slot:icon>
            <IconGitHub :width="20" :height="20" color="currentColor" />
          </template>
        </bf-navigation-item> -->
      </div>

      <bf-navigation-item
        v-if="!(pageNotFound || isWelcomeOrg) && !isWorkspaceGuest"
        :link="{ name: 'people-list', params: { orgId: activeOrganizationId } }"
        label="People"
        :condensed="primaryNavCondensed"
        :styleColor="navStyleColor"
      >
        <template v-slot:icon>
          <IconPerson :width="20" :height="20" color="currentColor" />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        v-if="!(pageNotFound || isWelcomeOrg) && !isWorkspaceGuest"
        :link="{ name: 'teams-list', params: { orgId: activeOrganizationId } }"
        label="Teams"
        :condensed="primaryNavCondensed"
        :styleColor="navStyleColor"
      >
        <template v-slot:icon>
          <IconTeam :width="20" :height="20" />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        v-if="!(pageNotFound || isWelcomeOrg) && !isWorkspaceGuest"
        id="nav-publishing"
        :link="{ name: 'publishing', params: { orgId: activeOrganizationId } }"
        label="Publishing"
        :condensed="primaryNavCondensed"
        :styleColor="navStyleColor"
      >
        <template v-slot:icon>
          <IconPublic :width="20" :height="20" />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        v-if="hasAdminRights && !pageNotFound && !isWorkspaceGuest"
        :link="{ name: 'settings', params: { orgId: activeOrganizationId } }"
        label="Settings"
        :condensed="primaryNavCondensed"
        :styleColor="navStyleColor"
      >
        <template v-slot:icon>
          <IconSettings :width="20" :height="20" color="currentColor" />
        </template>
      </bf-navigation-item>
    </div>
    <span
      v-if="!secondaryNavOpen && !pageNotFound"
      class="collapse-handle"
      @click="toggleMenu"
    />
    <bf-navigation-tertiary
      :bkColor="userMenuBackgroundColor"
      :org-id="orgId"
    />
  </div>
</template>

<script>
import BfNavigationItem from "./bf-navigation-item/BfNavigationItem.vue";
import BfNavigationTertiary from "../bf-navigation-tertiary/BfNavigationTertiary.vue";
import { mapActions, mapGetters, mapState } from "vuex";
import { pathOr, propOr } from "ramda";
import { PublicationTabs } from "../../utils/constants";
import PennsieveMark from "../icons/IconPennsieveMark.vue";
import IconNavCollapse from "../icons/IconNavCollapse.vue";
import IconNavExpand from "../icons/IconNavExpand.vue";
import IconDatasets from "../icons/IconDatasets.vue";
import IconPerson from "../icons/IconPerson.vue";
import IconTeam from "../icons/IconTeam.vue";
import IconSettings from "../icons/IconSettings.vue";
import IconIntegrations from "../icons/IconIntegrations.vue";
import IconOrganization from "../icons/IconOrganization.vue";
import IconDocument from "../icons/IconDocument.vue";
import IconPublic from "../icons/IconPublic.vue";
import IconSPARCLogo from "../icons/IconSPARCLogo.vue";
import IconI3HLogo from "../icons/IconI3HLogo.vue";
import IconHealInitiative from "../icons/IconHealInitiative.vue";
import CustomTheme from "../../mixins/custom-theme";
import {
  isEnabledForTestOrgs,
  isEnabledForAllDevOrgs,
  isEnabledForSpecificOrgs,
} from "../../utils/feature-flags";

export default {
  name: "BfNavigation",

  props: {
    orgId: {
      type: String,
      default: "",
    },
    datasetId: {
      type: String,
      default: "",
    },
  },

  components: {
    IconSPARCLogo,
    IconI3HLogo,
    IconPublic,
    IconDocument,
    IconOrganization,
    IconSettings,
    IconPerson,
    IconNavExpand,
    IconNavCollapse,
    PennsieveMark,
    BfNavigationItem,
    BfNavigationTertiary,
    IconDatasets,
    IconTeam,
    IconIntegrations,
    IconHealInitiative,
  },
  mixins: [CustomTheme],

  computed: {
    ...mapGetters([
      "activeOrganization",
      "hasFeature",
      "isUserPublisher",
      "isWelcomeOrg",
    ]),

    ...mapState([
      "config",
      "secondaryNavOpen",
      "primaryNavCondensed",
      "pageNotFound",
    ]),
    logoClass: function () {
      // Use the orgID parameter passed by router for quick switching of theme instead of the activeOrganization that is defined later.
      if (
        this.orgId === "N:organization:db5e88f3-9986-452f-aaab-b677f4fd9b80"
      ) {
        return "I3H-logo";
      } else {
        return "logo";
      }
    },
    MarkComponent: function () {
      // Use the orgID parameter passed by router for quick switching of theme instead of the activeOrganization that is defined later.
      let name = "PennsieveMark";
      if (
        this.orgId === "N:organization:050fae39-4412-43ef-a514-703ed8e299d5" ||
        this.orgId === "N:organization:618e8dd9-f8d2-4dc4-9abb-c6aaab2e78a0"
      ) {
        name = "IconSPARCLogo";
      } else if (
        this.orgId === "N:organization:db5e88f3-9986-452f-aaab-b677f4fd9b80" ||
        this.orgId === "N:organization:aab5058e-25a4-43f9-bdb1-18396b6920f2"
      ) {
        name = "IconHealInitiative";
      }
      return name;
    },
    hasCustomTheme: function () {
      return true;
    },
    getThemeColors: function () {
      let colorTheme = this.getTheme(this.orgId)

      for (const [key, value] of Object.entries(pathOr({}, ['organization', 'colorTheme'], this.activeOrganization))) {
          colorTheme = [key, value]
        }

      return colorTheme
    },
    navStyleColor: function () {
      if (this.hasCustomTheme) {
        return this.pSBC(0.1, this.getThemeColors[1]);
      }
      return "";
    },
    workspaceBackgroundStyle: function () {
      if (this.hasCustomTheme) {
        const color1 = this.pSBC(
          -0.1,
          this.getThemeColors[0],
          this.getThemeColors[1],
          true
        );
        return `linear-gradient(to top, ${color1}, ${this.getThemeColors[1]})`;
      }
      return "";
    },
    userMenuBackgroundColor: function () {
      if (this.hasCustomTheme) {
        return this.getThemeColors[0]; // color1
      }
      return "";
    },

    PublicationTabs: function () {
      return PublicationTabs;
    },

    /**
     * Compute what route the logo should
     * take the user based on their organization
     * @returns {Object}
     */
    logoClass: function () {
      // Use the orgID parameter passed by router for quick switching of theme instead of the activeOrganization that is defined later.
      if (
        this.orgId === "N:organization:db5e88f3-9986-452f-aaab-b677f4fd9b80"
      ) {
        return "I3H-logo";
      } else {
        return "logo";
      }
    },
    MarkComponent: function () {
      // Use the orgID parameter passed by router for quick switching of theme instead of the activeOrganization that is defined later.
      let name = "PennsieveMark";
      if (
        this.orgId === "N:organization:050fae39-4412-43ef-a514-703ed8e299d5" ||
        this.orgId === "N:organization:618e8dd9-f8d2-4dc4-9abb-c6aaab2e78a0"
      ) {
        name = "IconSPARCLogo";
      } else if (
        this.orgId === "N:organization:db5e88f3-9986-452f-aaab-b677f4fd9b80" ||
        this.orgId === "N:organization:aab5058e-25a4-43f9-bdb1-18396b6920f2"
      ) {
        name = "IconI3HLogo";
      } else if (
        this.orgId === "N:organization:98d6e84c-9a27-48f8-974f-93c0cca15aae" ||
        this.orgId === "N:organization:f08e188e-2316-4668-ae2c-8a20dc88502f"
      ) {
        name = "IconHealInitiative";
      }
      return name;
    },
    hasCustomTheme: function () {
      return true;
    },
    getThemeColors: function () {
      let colorTheme = this.getTheme(this.orgId)

      for (const [key, value] of Object.entries(pathOr({}, ['organization', 'colorTheme'], this.activeOrganization))) {
          colorTheme = [key, value]
        }

      return colorTheme
    },
    navStyleColor: function () {
      if (this.hasCustomTheme) {
        return this.pSBC(0.1, this.getThemeColors[1]);
      }
      return "";
    },
    workspaceBackgroundStyle: function () {
      if (this.hasCustomTheme) {
        const color1 = this.pSBC(
          -0.1,
          this.getThemeColors[0],
          this.getThemeColors[1],
          true
        );
        return `linear-gradient(to top, ${color1}, ${this.getThemeColors[1]})`;
      }
      return "";
    },
    userMenuBackgroundColor: function () {
      if (this.hasCustomTheme) {
        return this.getThemeColors[0]; // color1
      }
      return "";
    },

    PublicationTabs: function () {
      return PublicationTabs;
    },

    /**
     * Compute what route the logo should
     * take the user based on their organization
     * @returns {Object}
     */
    logoRoute: function () {
      let routeName = "datasets-list";

      return {
        name: routeName,
        params: { orgId: this.orgId },
      };
    },

    /**
     * Dynamic link to generate home page, based on environment
     * @returns {String}
     */
    logoLink: function () {
      return this.config.environment === "prod"
        ? "https://app.pennsieve.io"
        : "https://app.pennsieve.net";
    },

    /**
     * Computes whether or not user has administratrive rights for the organization
     */
    hasAdminRights: function () {
      const isAdmin = propOr(false, "isAdmin", this.activeOrganization);
      const isOwner = propOr(false, "isOwner", this.activeOrganization);
      return isAdmin || isOwner;
    },

    isWorkspaceGuest: function () {
      const isGuest = propOr(false, "isGuest", this.activeOrganization);
      return isGuest;
    },

    /**
     * Compute active organization name
     * @returns {String}
     */
    activeOrganizationName: function () {
      return pathOr(
        "Organization",
        ["organization", "name"],
        this.activeOrganization
      );
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
  },

  methods: {
    ...mapActions(["togglePrimaryNav", "condensePrimaryNav"]),

    /**
     * Toggles primary nav open and closed
     */
    toggleMenu: function () {
      this.condensePrimaryNav(!this.primaryNavCondensed);
    },

    /**
     * Collapses the primary nav menu
     */
    closeMenu: function () {
      this.togglePrimaryNav(false);
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../assets/_variables.scss";
@import "./bf-navigation.scss";
@import "./logo.scss";

.menu-divider {
  margin: 8px;
  color: $gray_6;
}

.bf-navigation {
  color: $white;
  z-index: 99;
  background-image: linear-gradient(to top, $purple_2, $purple_1);
}
.active-org {
  align-items: center;
  color: $white;
  display: flex;
  font-size: 12px;
  font-weight: 500;
  margin: 0;
  text-decoration: none;
  .svg-icon {
    margin-left: 8px;
  }
}
.active-org-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
.logo {
  color: $white;
  fill: $white;
}
.I3H-logo {
  height: 30px;

  .condensed & {
    width: 24px;
    height: auto;
  }
}
.logo-wrap {
  margin: 18px 0;
}
.logo-arrow {
  color: $white;
}
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s ease-out;
}
.slide-enter-to {
  transform: translate3d(0, 0, 0);
}
.slide-enter,
.slide-leave-to {
  transform: translate3d(-100%, 0, 0);
}
</style>
<style>
#nav-publishing .icon-main {
  height: 30px !important;
  margin: 0 20px 0 -6px;
  width: 30px !important;
}
#nav-integrations .icon-main {
  height: 26px !important;
  margin: 0 20px 0 -3px;
  width: 26px !important;
}
</style>
