<template>
  <div
    class="bf-navigation primary"
    :class="[ primaryNavCondensed || pageNotFound || secondaryNavOpen ? 'condensed' : '' ]"
  >
    <div class="logo-wrap">
      <router-link
        v-if="!pageNotFound"
        tag="button"
        :to="logoRoute"
      >
        <pennsieve-mark
          :is-visible="!primaryNavCondensed || secondaryNavOpen"
          class="logo"
          :width="24"
          :height="24"
          color="currentColor">
        </pennsieve-mark>

      </router-link>
      <a
        v-else
        :href="logoLink"
      >
        <pennsieve-mark
            :is-visible="!primaryNavCondensed || secondaryNavOpen"
            class="logo"
            :width="24"
            :height="24"
            color="currentColor">
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
          class="collapse">
        </IconNavCollapse>
        <IconNavExpand
          :is-visible="primaryNavCondensed"
          :width="primaryNavCondensed ? 32 : 24"
          :height="primaryNavCondensed ? 32 : 24"
          color="#fff"
          class="collapse">
        </IconNavExpand>

      </button>
    </div>

    <div class="menu-wrap">
      <bf-navigation-item
        :link="{ name: 'welcome', params: {orgId: activeOrganizationId} }"
        label="Welcome"
        icon="icon-organization"
        :condensed="primaryNavCondensed"
      >
        <template v-slot:icon>
          <IconOrganization
            :width="20"
            :height="20"
            color="currentColor"
          />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        :link="{ name: 'submit', params: {orgId: activeOrganizationId} }"
        label="Submit Datasets"
        icon="icon-document"
        :condensed="primaryNavCondensed"

      >
        <template v-slot:icon>
          <IconDocument
            :width="20"
            :height="20"
            color="currentColor"
          />
        </template>
      </bf-navigation-item>


<!--      <bf-navigation-item-->
<!--        v-if="!(pageNotFound) && isWelcomeOrg"-->
<!--        :link="{ name: 'info', params: {orgId: activeOrganizationId} }"-->
<!--        label="More Information"-->
<!--        icon="icon-help"-->
<!--        :condensed="primaryNavCondensed"-->

<!--      />-->

      <bf-navigation-item
        v-if="!(pageNotFound || isWelcomeOrg)"
        :link="{ name: 'datasets-list', params: {orgId: activeOrganizationId} }"
        label="Datasets"
        :condensed="primaryNavCondensed"
      >
        <template v-slot:icon>
          <IconDatasets
              :width="20"
              :height="20"
              color="currentColor"
          />
          </template>
        </bf-navigation-item>


      <bf-navigation-item
        v-if="!(pageNotFound || isWelcomeOrg) && !isWorkspaceGuest"
        :link="{ name: 'people-list', params: {orgId: activeOrganizationId} }"
        label="People"
        :condensed="primaryNavCondensed"

      >
        <template v-slot:icon>
          <IconPerson
              :width="20"
              :height="20"
              color="currentColor"
          />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        v-if="!(pageNotFound || isWelcomeOrg) && !isWorkspaceGuest"
        :link="{ name: 'teams-list', params: {orgId: activeOrganizationId} }"
        label="Teams"
        :condensed="primaryNavCondensed"

      >
        <template v-slot:icon>
          <IconTeam
            :width="20"
            :height="20"
          />
        </template>
      </bf-navigation-item>

<!--      <bf-navigation-item-->
<!--        v-if="!(pageNotFound || isWelcomeOrg) && !isWorkspaceGuest"-->
<!--        id="nav-publishing"-->
<!--        :link="{ name: 'publishing', params: {orgId: activeOrganizationId} }"-->
<!--        label="Publishing"-->
<!--        icon="icon-public"-->
<!--        :condensed="primaryNavCondensed"-->

<!--      />-->

      <bf-navigation-item
        v-if="!(pageNotFound || isWelcomeOrg) && !isWorkspaceGuest"
        id="nav-integrations"
        :link="{ name: 'integrations', params: {orgId: activeOrganizationId} }"
        label="Integrations"
        :condensed="primaryNavCondensed"

      >
        <template v-slot:icon>
          <IconIntegrations
            :width="20"
            :height="20"
            color="currentColor"
          />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        v-if="hasAdminRights && !pageNotFound && !isWorkspaceGuest"
        :link="{ name: 'settings', params: {orgId: activeOrganizationId} }"
        label="Settings"
        :condensed="primaryNavCondensed"
      >
        <template v-slot:icon>
          <IconSettings
            :width="20"
            :height="20"
            color="currentColor"
          />
        </template>
      </bf-navigation-item>
    </div>
    <span
      v-if="!secondaryNavOpen && !pageNotFound"
      class="collapse-handle"
      @click="toggleMenu"
    />
    <bf-navigation-tertiary />
  </div>
</template>

<script>
  import BfNavigationItem from './bf-navigation-item/BfNavigationItem.vue'
  import BfNavigationTertiary from '../bf-navigation-tertiary/BfNavigationTertiary.vue'
  import { mapActions, mapGetters, mapState } from 'vuex'
  import { pathOr, propOr } from 'ramda'
  import { PublicationTabs } from '../../utils/constants';
  import PennsieveMark from '../icons/IconPennsieveMark.vue';
  import IconNavCollapse from "../icons/IconNavCollapse.vue";
  import IconNavExpand from "../icons/IconNavExpand.vue";
  import IconDatasets from "../icons/IconDatasets.vue"
  import IconPerson from "../icons/IconPerson.vue";
  import IconTeam from "../icons/IconTeam.vue";
  import IconSettings from "../icons/IconSettings.vue";
  import IconIntegrations from "../icons/IconIntegrations.vue";
  import IconOrganization from "../icons/IconOrganization.vue";
  import IconDocument from "../icons/IconDocument.vue";

  export default {
    name: 'BfNavigation',

    components: {
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
      IconIntegrations
    },

    computed: {
      ...mapGetters([
        'activeOrganization',
        'hasFeature',
        'isUserPublisher',
        'isWelcomeOrg'
      ]),

      ...mapState([
        'config',
        'secondaryNavOpen',
        'primaryNavCondensed',
        'pageNotFound',

      ]),

      PublicationTabs: function() {
        return PublicationTabs
      },

      /**
       * Compute what route the logo should
       * take the user based on their organization
       * @returns {Object}
       */
      logoRoute: function() {
        let routeName = 'datasets-list'

        return {
          name: routeName, params: { orgId: this.activeOrganizationId }
        }
      },

    /**
     * Dynamic link to generate home page, based on environment
     * @returns {String}
     */
    logoLink: function() {
      return this.config.environment === 'prod' ? 'https://app.pennsieve.io' : 'https://app.pennsieve.net'
    },

      /**
       * Computes whether or not user has administratrive rights for the organization
       */
      hasAdminRights: function() {
        const isAdmin = propOr(false, 'isAdmin', this.activeOrganization)
        const isOwner = propOr(false, 'isOwner', this.activeOrganization)
        return isAdmin || isOwner
      },

      isWorkspaceGuest: function() {
        const isGuest = propOr(false, 'isGuest', this.activeOrganization)
        return isGuest
      },

      /**
       * Compute active organization name
       * @returns {String}
       */
      activeOrganizationName: function() {
        return pathOr('Organization', ['organization', 'name'], this.activeOrganization)
      },

      /**
       * Compute active organization id
       * @returns {String}
       */
      activeOrganizationId: function() {
        return pathOr('Organization', ['organization', 'id'], this.activeOrganization)
      },
    },

    methods: {
      ...mapActions([
        'togglePrimaryNav',
        'condensePrimaryNav'
      ]),

      /**
       * Toggles primary nav open and closed
       */
      toggleMenu: function() {
        this.condensePrimaryNav(!this.primaryNavCondensed)
      },

      /**
       * Collapses the primary nav menu
       */
      closeMenu: function() {
        this.togglePrimaryNav(false)
      }
    }
  }
</script>

<style scoped lang="scss">
  @import '../../assets/_variables.scss';
  @import './bf-navigation.scss';
  @import './logo.scss';

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
  .logo-wrap {
    margin: 18px 0;
  }
  .logo-arrow {
    color: $white;
  }
  .slide-enter-active, .slide-leave-active {
    transition: transform .20s ease-out
  }
  .slide-enter-to {
    transform: translate3d(0, 0, 0);
  }
  .slide-enter, .slide-leave-to {
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
