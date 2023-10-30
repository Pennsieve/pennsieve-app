<template>
  <div
    class="bf-navigation primary"
    :class="[ primaryNavCondensed || pageNotFound || secondaryNavOpen ? 'condensed' : '' ]"
    :style="{ backgroundImage: `${workspaceBackgroundStyle}` }"
  >

    <div class="logo-wrap">
      <router-link
        v-if="!pageNotFound"
        tag="button"
        :to="logoRoute"
      >

        <component :is="MarkComponent"
          :is-visible="!primaryNavCondensed || secondaryNavOpen"
          :class="logoClass"
          color="currentColor"
          />
<!--        <pennsieve-mark-->
<!--          :is-visible="!primaryNavCondensed || secondaryNavOpen"-->
<!--          class="logo"-->
<!--          :width="24"-->
<!--          :height="24"-->
<!--          color="currentColor">-->
<!--        </pennsieve-mark>-->

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
        :styleColor="navStyleColor"
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
        :styleColor="navStyleColor"

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
        :styleColor="navStyleColor"
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
        :styleColor="navStyleColor"

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
        :styleColor="navStyleColor"

      >
        <template v-slot:icon>
          <IconTeam
            :width="20"
            :height="20"
          />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        v-if="!(pageNotFound || isWelcomeOrg) && !isWorkspaceGuest"
        id="nav-publishing"
        :link="{ name: 'publishing', params: {orgId: activeOrganizationId} }"
        label="Publishing"
        :condensed="primaryNavCondensed"
        :styleColor="navStyleColor"
      >
        <template v-slot:icon>
          <IconPublic
            :width="20"
            :height="20"
          />
        </template>
      </bf-navigation-item>

      <bf-navigation-item
        v-if="!(pageNotFound || isWelcomeOrg) && !isWorkspaceGuest"
        id="nav-integrations"
        :link="{ name: 'integrations', params: {orgId: activeOrganizationId} }"
        label="Integrations"
        :condensed="primaryNavCondensed"
        :styleColor="navStyleColor"

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
        :styleColor="navStyleColor"
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
    <bf-navigation-tertiary :bkColor="userMenuBackgroundColor"/>
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
  import IconPublic from "../icons/IconPublic.vue";
  import IconSPARCLogo from "../icons/IconSPARCLogo.vue";
  import IconI3HLogo from "../icons/IconI3HLogo.vue";
  import IconHealInitiative from "../icons/IconHealInitiative.vue";

  export default {
    name: 'BfNavigation',

    props: {
      orgId: {
        type: String,
        default: ''
      },
      datasetId: {
        ype: String,
        default: ''
      }
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
      IconHealInitiative
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
      logoClass: function() {
        // Use the orgID parameter passed by router for quick switching of theme instead of the activeOrganization that is defined later.
        if (this.orgId === 'N:organization:db5e88f3-9986-452f-aaab-b677f4fd9b80') {
          return "I3H-logo"
        } else {
          return "logo"
        }
      },
      MarkComponent: function() {
        // Use the orgID parameter passed by router for quick switching of theme instead of the activeOrganization that is defined later.
        let name = "PennsieveMark"
        if (this.orgId === 'N:organization:050fae39-4412-43ef-a514-703ed8e299d5') {
          name = "IconSPARCLogo"
        } else if (this.orgId === 'N:organization:db5e88f3-9986-452f-aaab-b677f4fd9b80') {
          name = "IconHealInitiative"
        }
        return name
      },
      hasCustomTheme: function() {
        return true
      },
      getThemeColors: function() {
        // TODO: Make this dynamic and not hardcoded...
        if (this.hasCustomTheme) {
          if (this.orgId === 'N:organization:db5e88f3-9986-452f-aaab-b677f4fd9b80') {
            return [ '#a33936','#532962']
            return [ '#C35A00','#82AFD3']
          } else if (this.orgId === 'N:organization:050fae39-4412-43ef-a514-703ed8e299d5') {
            // return [ '#a33936','#532962']
            return ['#011F5B', '#7516A5']
          } else {
            return []
          }
        }
        return []
      },
      navStyleColor: function() {
        if (this.hasCustomTheme) {
          return this.pSBC(0.1, this.getThemeColors[1])
        }
        return ''
      },
      workspaceBackgroundStyle: function() {
        if (this.hasCustomTheme) {
          const color1 = this.pSBC(-0.1, this.getThemeColors[0], this.getThemeColors[1], true)
          return `linear-gradient(to top, ${color1}, ${this.getThemeColors[1]})`
        }
        return ''
      },
      userMenuBackgroundColor: function() {
        if (this.hasCustomTheme) {
          return this.getThemeColors[0]  // color1
        }
        return ''
      },

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
          name: routeName, params: { orgId: this.orgId }
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
        console.log('condensing primary nav')
        this.condensePrimaryNav(!this.primaryNavCondensed)
      },

      /**
       * Collapses the primary nav menu
       */
      closeMenu: function() {
        this.togglePrimaryNav(false)
      },

      pSBC: function(p,c0,c1,l) {
        let r,g,b,P,f,t,h,i=parseInt,m=Math.round,a=typeof(c1)=="string";
        if(typeof(p)!="number"||p<-1||p>1||typeof(c0)!="string"||(c0[0]!='r'&&c0[0]!='#')||(c1&&!a))return null;
        this.pSBCr=(d)=>{
          let n=d.length,x={};
          if(n>9){
            [r,g,b,a]=d=d.split(","),n=d.length;
            if(n<3||n>4)return null;
            x.r=i(r[3]=="a"?r.slice(5):r.slice(4)),x.g=i(g),x.b=i(b),x.a=a?parseFloat(a):-1
          }else{
            if(n==8||n==6||n<4)return null;
            if(n<6)d="#"+d[1]+d[1]+d[2]+d[2]+d[3]+d[3]+(n>4?d[4]+d[4]:"");
            d=i(d.slice(1),16);
            if(n==9||n==5)x.r=d>>24&255,x.g=d>>16&255,x.b=d>>8&255,x.a=m((d&255)/0.255)/1000;
            else x.r=d>>16,x.g=d>>8&255,x.b=d&255,x.a=-1
          }return x};
        h=c0.length>9,h=a?c1.length>9?true:c1=="c"?!h:false:h,f=this.pSBCr(c0),P=p<0,t=c1&&c1!="c"?this.pSBCr(c1):P?{r:0,g:0,b:0,a:-1}:{r:255,g:255,b:255,a:-1},p=P?p*-1:p,P=1-p;
        if(!f||!t)return null;
        if(l)r=m(P*f.r+p*t.r),g=m(P*f.g+p*t.g),b=m(P*f.b+p*t.b);
        else r=m((P*f.r**2+p*t.r**2)**0.5),g=m((P*f.g**2+p*t.g**2)**0.5),b=m((P*f.b**2+p*t.b**2)**0.5);
        a=f.a,t=t.a,f=a>=0||t>=0,a=f?a<0?t:t<0?a:a*P+t*p:0;
        if(h)return"rgb"+(f?"a(":"(")+r+","+g+","+b+(f?","+m(a*1000)/1000:"")+")";
        else return"#"+(4294967296+r*16777216+g*65536+b*256+(f?m(a*255):0)).toString(16).slice(1,f?undefined:-2)
      },
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
  .I3H-logo {
    height:30px;

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
