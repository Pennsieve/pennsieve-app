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
      <router-link v-if="!pageNotFound && !isWorkspaceGuest" tag="button" :to="logoRoute">
        <workspace-logo
          v-if="hasUploadedLogo"
          :fit="isRailCondensed ? 'square' : 'natural'"
          :size="isRailCondensed ? 28 : 30"
          :max-width="navLogoMaxWidth"
          :initials-only="isRailCondensed"
          plain-initials
        />
        <!-- Referenced by its import identifier, not as <pennsieve-mark>.
             Two components declare name: "PennsieveMark" - the real mark in
             IconPennsieveMark.vue and an unused placeholder shield in
             PennsieveMark.vue - and the kebab-case tag resolved to the
             placeholder despite the local registration pointing here. -->
        <IconPennsieveMark
          v-else
          v-show="!primaryNavCondensed || secondaryNavOpen"
          class="logo-fallback-mark"
          :width="24"
          :height="24"
          color="currentColor"
        />
      </router-link>
      <button v-else-if="!pageNotFound && isWorkspaceGuest" @click.prevent>
        <workspace-logo
          v-if="hasUploadedLogo"
          :fit="isRailCondensed ? 'square' : 'natural'"
          :size="isRailCondensed ? 28 : 30"
          :max-width="navLogoMaxWidth"
          :initials-only="isRailCondensed"
          plain-initials
        />
        <!-- Referenced by its import identifier, not as <pennsieve-mark>.
             Two components declare name: "PennsieveMark" - the real mark in
             IconPennsieveMark.vue and an unused placeholder shield in
             PennsieveMark.vue - and the kebab-case tag resolved to the
             placeholder despite the local registration pointing here. -->
        <IconPennsieveMark
          v-else
          v-show="!primaryNavCondensed || secondaryNavOpen"
          class="logo-fallback-mark"
          :width="24"
          :height="24"
          color="currentColor"
        />
      </button>
      <a v-else :href="logoLink">
        <IconPennsieveMark
          v-show="!primaryNavCondensed || secondaryNavOpen"
          class="logo-fallback-mark"
          :width="24"
          :height="24"
          color="currentColor"
        />
      </a>
    </div>

    <div class="menu-wrap">
      <bf-navigation-item
        v-if="!(pageNotFound || isWelcomeOrg)"
        :link="isWorkspaceGuest ? { name: null } : datasetsNavigationLink"
        label="Datasets"
        :condensed="primaryNavCondensed"
        :styleColor="navStyleColor"
        @click.native="isWorkspaceGuest ? $event.preventDefault() : null"
      >
        <template v-slot:icon>
          <IconDatasets :width="20" :height="20" color="currentColor" />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        v-if="!(pageNotFound || isWelcomeOrg) && !isWorkspaceGuest && hasFeature('compute_node_chat')"
        :link="{ name: 'workspace-insights', params: { orgId: orgId } }"
        label="Insights"
        :condensed="primaryNavCondensed"
        :styleColor="navStyleColor"
      >
        <template v-slot:icon>
          <IconResearch :width="20" :height="20" color="currentColor" />
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
        v-if="!(pageNotFound || isWelcomeOrg) && !isWorkspaceGuest"
        id="nav-resources"
        :link="{ name: 'workspace-resources', params: { orgId: activeOrganizationId } }"
        label="Resources"
        :condensed="primaryNavCondensed"
        :styleColor="navStyleColor"
      >
        <template v-slot:icon>
          <IconCollection :width="20" :height="20" color="currentColor" />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        v-if="hasAdminRights && !pageNotFound && !isWorkspaceGuest"
        :link="{ name: 'workspace-settings-overview', params: { orgId: activeOrganizationId } }"
        label="Settings"
        :condensed="primaryNavCondensed"
        :styleColor="navStyleColor"
      >
        <template v-slot:icon>
          <IconSettings :width="20" :height="20" color="currentColor" />
        </template>
      </bf-navigation-item>
    </div>
    <button
      v-if="!secondaryNavOpen && !pageNotFound"
      type="button"
      class="collapse-handle"
      :aria-label="primaryNavCondensed ? 'Expand navigation' : 'Collapse navigation'"
      :aria-expanded="!primaryNavCondensed"
      @click="toggleMenu"
    >
      <!-- One icon rotated, never two swapped: IconArrowLeft is a 6x10
           viewBox and IconArrowRight a 24x24, so the same width/height
           rendered them at visibly different sizes. Rotating keeps the
           geometry identical by construction. 6x10 matches the viewBox
           ratio, so the chevron is not stretched. -->
      <IconArrowLeft
        class="collapse-chevron"
        :class="{ 'is-flipped': primaryNavCondensed }"
        :width="6"
        :height="10"
        color="currentColor"
      />
    </button>
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
import IconPennsieveMark from "../icons/IconPennsieveMark.vue";
import IconDatasets from "../icons/IconDatasets.vue";
import IconOverview from "../icons/IconOverview.vue";
import IconResearch from "../icons/IconResearch.vue";
import IconPerson from "../icons/IconPerson.vue";
import IconTeam from "../icons/IconTeam.vue";
import IconSettings from "../icons/IconSettings.vue";
import IconIntegrations from "../icons/IconIntegrations.vue";
import IconOrganization from "../icons/IconOrganization.vue";
import IconDocument from "../icons/IconDocument.vue";
import IconPublic from "../icons/IconPublic.vue";
import IconArrowLeft from "../icons/IconArrowLeft.vue";
import WorkspaceLogo from "../shared/WorkspaceLogo/WorkspaceLogo.vue";
import IconCollection from "../icons/IconCollection.vue";
import CustomTheme from "../../mixins/custom-theme";

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
    WorkspaceLogo,
    IconArrowLeft,
    IconPublic,
    IconDocument,
    IconOrganization,
    IconSettings,
    IconPerson,
    IconPennsieveMark,
    BfNavigationItem,
    BfNavigationTertiary,
    IconDatasets,
    IconOverview,
    IconResearch,
    IconTeam,
    IconIntegrations,
    IconCollection,
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

    ...mapGetters("workspaceLogoModule", ["activeWorkspaceLogo"]),

    activeOrgId: function () {
      return pathOr(null, ["organization", "id"], this.activeOrganization);
    },

    // Drives whether the uploaded logo replaces the Pennsieve mark.
    hasUploadedLogo: function () {
      return Boolean(this.activeWorkspaceLogo);
    },

    // The expanded rail is 230px and .logo-wrap pads 20px each side, leaving
    // 190px. A wordmark is only legible if it can use that width — held to a
    // 24px square it renders a few pixels tall.
    // The rail is condensed unless the secondary nav is holding it open.
    isRailCondensed: function () {
      return this.primaryNavCondensed && !this.secondaryNavOpen;
    },

    navLogoMaxWidth: function () {
      return this.isRailCondensed ? 28 : 190;
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
        // Darken theme colors for better white text contrast
        const darkened0 = this.pSBC(-0.25, this.getThemeColors[0]) || this.getThemeColors[0];
        const darkened1 = this.pSBC(-0.25, this.getThemeColors[1]) || this.getThemeColors[1];
        const color1 = this.pSBC(-0.1, darkened0, darkened1, true);
        return `linear-gradient(to top, ${color1}, ${darkened1})`;
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
      // If user is a guest, redirect to shared-with-me page
      if (this.isWorkspaceGuest) {
        return { name: 'shared-with-me' };
      }
      
      let routeName = "datasets-list";
      return {
        name: routeName,
        params: { orgId: this.orgId },
      };
    },
    
    /**
     * Compute datasets navigation link based on guest status
     * @returns {Object}
     */
    datasetsNavigationLink: function () {
      // If user is a guest, redirect to shared-with-me page
      if (this.isWorkspaceGuest) {
        return { name: 'shared-with-me' };
      }
      
      return {
        name: 'datasets-list',
        params: { orgId: this.activeOrganizationId },
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
      // Check both at root level and within organization object
      const isGuestRoot = propOr(false, "isGuest", this.activeOrganization);
      const isGuestOrg = pathOr(false, ["organization", "isGuest"], this.activeOrganization);
      return isGuestRoot || isGuestOrg;
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

  watch: {
    // The nav has to fetch this itself. It renders WorkspaceLogo only when a
    // logo exists, but WorkspaceLogo is what dispatches the fetch - so gating
    // on the store while relying on the component to populate it meant the
    // nav could never discover a logo, and fell back forever. It only appeared
    // to work on the datasets list, where the rafter's copy renders
    // unconditionally and populated the store as a side effect.
    activeOrgId: {
      handler(orgId) {
        if (orgId) {
          this.fetchLogo({ orgId });
        }
      },
      immediate: true,
    },
  },

  methods: {
    ...mapActions(["togglePrimaryNav", "condensePrimaryNav"]),
    ...mapActions("workspaceLogoModule", ["fetchLogo"]),

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
@use "../../styles/theme";
@use "../../styles/navigation";

.logo-fallback-mark {
  // White via currentColor. Deliberately not .logo, whose fill is the dark
  // app primary colour and would override the svg's fill="currentColor",
  // leaving the mark near-invisible against the rail.
  color: theme.$white;
  display: block;
  height: 24px;
  width: 24px;
}

.logo {
  color: theme.$purple_1;
  display: block;
  fill: theme.$app-primary-color;
  height: 24px;
  width: 24px;
  span {
    display: block;
    height: 100%;
    width: 100%;
  }
}

.logo-wrap {
  align-items: center;
  display: flex;
  // min-height, not a fixed 20px: that was sized for the old 20px mark, and a
  // 30px logo overflowed it, quietly eating into the margins below. Letting
  // the row size to its content makes the spacing mean what it says.
  min-height: 30px;
  flex-direction: row;
  padding: 4px 20px;
  // Centred: this row is branding only now that the collapse control lives on
  // the rail's edge handle, so the logo is not competing with an icon.
  justify-content: center;

  .condensed & {
    justify-content: center;
    // Keep the vertical breathing room; only the horizontal gutter goes.
    padding: 4px 0;
  }
}


.logo-arrow {
  color: theme.$app-primary-color;
  margin-left: 8px;
}



.menu-divider {
  margin: 8px;
  color: theme.$gray_6;
}

.bf-navigation {
  color: theme.$white;
  z-index: 99;
  background-image: linear-gradient(to top, theme.$purple_2, theme.$purple_1);
}
.active-org {
  align-items: center;
  color: theme.$white;
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
  color: theme.$white;
  fill: theme.$white;
}
.logo-wrap {
  margin: 20px 0;
}
.logo-arrow {
  color: theme.$white;
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