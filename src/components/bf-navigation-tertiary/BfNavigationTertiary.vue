<template>
  <div class="bf-navigation-tertiary">

    <bf-navigation-item
      :link="{ name: 'user-overview', params: {orgId: activeOrganizationId} }"
      label="Dataset Proposals"
      :condensed="primaryNavCondensed"
      :styleColor="navStyleColor"
    >
      <template #icon>
        <PennsieveMark
          :width="20"
          :height="20"
          color="currentColor"
        />
      </template>


    </bf-navigation-item>

    <user-menu :style="{ backgroundColor: `${bkColor}` }"/>
  </div>
</template>

<script>
  import { mapGetters, mapState } from 'vuex'
  import {pathOr, propOr} from "ramda";
  import HelpMenu from '../bf-navigation/HelpMenu/HelpMenu.vue'
  import UserMenu from '../bf-navigation/UserMenu/UserMenu.vue'
  import CustomTheme from "../../mixins/custom-theme";
  import IconOrganization from "../icons/IconOrganization.vue";
  import BfNavigationItem from "../bf-navigation/bf-navigation-item/BfNavigationItem.vue";
  import PennsieveMark from "../icons/IconPennsieveMark.vue";

  // const SearchMenu = () => import('@/components/bf-navigation/SearchMenu/SearchMenu.vue')

  export default {
    name: 'BfNavigationTertiary',

    mixins: [
      CustomTheme
    ],

    props: {
      orgId: {
        type: String,
        default: ''
      },
      bkColor: {
        type: String,
        default: '#011F5B'
      }
    },

    components: {
      PennsieveMark,
      HelpMenu,
      UserMenu,
      IconOrganization,
      BfNavigationItem
      // SearchMenu
    },

    computed: {
      ...mapGetters([
        'hasFeature',
        'isWelcomeOrg'
      ]),

      ...mapState([
        'pageNotFound',
        'activeOrganization',
        'primaryNavCondensed',
      ]),
      /**
       * Compute active organization id
       * @returns {String}
       */
      activeOrganizationId: function() {
        return pathOr('Organization', ['organization', 'id'], this.activeOrganization)
      },
      hasCustomTheme: function() {
        return true
      },
      navStyleColor: function() {
        if (this.hasCustomTheme) {
          return this.pSBC(0.1, this.getThemeColors[1])
        }
        return ''
      },

      getThemeColors: function() {
        return this.getTheme(this.orgId)
      },

      isWorkspaceGuest: function() {
        const isGuest = propOr(false, 'isGuest', this.activeOrganization)
        return isGuest
      },
    }
  }
</script>

<style lang="scss">
  @use '../../styles/theme';

  .bf-navigation-tertiary {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    .bf-navigation-item {
      font-size: inherit;
      line-height: inherit;
      text-align: left;
      width: 100%;

      .avatar-circle {
        .condensed & {
          margin-left: -12px;
        }
      }

      .icon-main {
        color: #fff;
        flex-shrink: 0;
        .condensed & {
          margin-left: -8px;
        }
        .secondary & {
          color: theme.$gray_6;
        }
      }
    }
  }
</style>
