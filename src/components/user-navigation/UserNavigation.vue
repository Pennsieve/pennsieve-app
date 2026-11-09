<template>
  <div
    class="user-navigation primary"
    :class="[
      primaryNavCondensed || secondaryNavOpen ? 'condensed' : '',
    ]"
  >
    <!-- Where you are, and the way to your workspaces (Shared Workspaces
         is its "All shared workspaces") -->
    <workspace-switcher
      :condensed="primaryNavCondensed || secondaryNavOpen"
      :active="$route.name === 'shared-workspaces'"
    />

    <!-- Same control as the workspace nav: a hover-revealed chevron on the
         rail seam rather than a button sharing the logo row. -->
    <button
      v-show="!secondaryNavOpen"
      type="button"
      class="collapse-handle"
      :aria-label="primaryNavCondensed ? 'Expand navigation' : 'Collapse navigation'"
      :aria-expanded="!primaryNavCondensed"
      @click="toggleMenu"
    >
      <IconArrowLeft
        class="collapse-chevron"
        :class="{ 'is-flipped': primaryNavCondensed }"
        :width="6"
        :height="10"
        color="currentColor"
      />
    </button>

    <div class="menu-wrap">

      <user-navigation-item
        :link="{ name: 'shared-datasets' }"
        label="Shared With Me"
        :condensed="primaryNavCondensed"
      >
        <template v-slot:icon>
          <IconShare :width="20" :height="20" color="currentColor" />
        </template>
      </user-navigation-item>

      <user-navigation-item
        :link="{ name: 'public-datasets' }"
        label="Public Datasets"
        :condensed="primaryNavCondensed"
        :active-for-routes="['public-dataset']"
      >
        <template v-slot:icon>
          <IconGlobeCheck :width="20" :height="20" color="currentColor" />
        </template>
      </user-navigation-item>

      <div class="nav-divider" />

      <user-navigation-item
        :link="{ name: 'my-code' }"
        label="Code"
        :condensed="primaryNavCondensed"
      >
        <template v-slot:icon>
          <IconGitHub :width="20" :height="20" color="currentColor" />
        </template>
      </user-navigation-item>


      <user-navigation-item
        :link="{ name: 'my-collections' }"
        label="Collections"
        :condensed="primaryNavCondensed"
      >
        <template v-slot:icon>
          <IconCollection :width="20" :height="20" color="currentColor" />
        </template>
      </user-navigation-item>


      <user-navigation-item
        :link="{ name: 'my-analysis' }"
        label="Analysis"
        :condensed="primaryNavCondensed"
        :active-for-routes="['my-analysis']"
      >
        <template v-slot:icon>
          <IconAnalysis :width="20" :height="20" color="currentColor" />
        </template>
      </user-navigation-item>

      <div class="nav-divider" />

      <user-navigation-item
        :link="{ name: 'resources' }"
        label="Resources"
        :condensed="primaryNavCondensed"
      >
        <template v-slot:icon>
          <IconDocumentation :width="20" :height="20" color="currentColor" />
        </template>
      </user-navigation-item>

      <user-navigation-item
        :link="{ name: 'data-publishing' }"
        label="Data Publishing"
        :condensed="primaryNavCondensed"
      >
        <template v-slot:icon>
          <IconUpload :width="20" :height="20" color="currentColor" />
        </template>
      </user-navigation-item>

    </div>

    <div class="menu-wrap bottom">

    </div>
    
    <bf-navigation-tertiary
      :bkColor="'#011F5B'"
      :org-id="null"
    />
  </div>
</template>

<script>
import { mapGetters, mapState, mapActions } from 'vuex'
import UserNavigationItem from './UserNavigationItem.vue'
import BfNavigationTertiary from '../bf-navigation-tertiary/BfNavigationTertiary.vue'
import IconArrowLeft from '../icons/IconArrowLeft.vue'
import IconUser from '../icons/IconUser.vue'
import IconUpload from '../icons/IconUpload.vue'
import IconAnalysis from '../icons/IconAnalysis.vue'
import IconGitHub from '../icons/IconGitHub.vue'
import IconShare from '../icons/IconShare.vue'
import IconCollection from "@/components/icons/IconCollection.vue";
import IconGlobeCheck from "@/components/icons/IconGlobeCheck.vue";
import IconDocumentation from "@/components/icons/IconDocumentation.vue";
import WorkspaceSwitcher from "./WorkspaceSwitcher.vue";

export default {
  name: 'UserNavigation',
  
  components: {
    IconCollection,
    UserNavigationItem,
    BfNavigationTertiary,
    IconArrowLeft,
    IconUser,
    IconUpload,
    IconAnalysis,
    IconGitHub,
    IconShare,
    IconGlobeCheck,
    IconDocumentation,
    WorkspaceSwitcher
  },

  computed: {
    ...mapState([
      'primaryNavCondensed',
      'secondaryNavOpen',
    ]),
    
    ...mapGetters([
      'profile'
    ]),

    userProfile() {
      return this.profile || {}
    },

    userDisplayName() {
      if (this.userProfile.firstName || this.userProfile.lastName) {
        return `${this.userProfile.firstName || ''} ${this.userProfile.lastName || ''}`.trim()
      }
      return this.userProfile.email || 'User'
    },

    userInitials() {
      const firstName = this.userProfile.firstName || ''
      const lastName = this.userProfile.lastName || ''
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U'
    }
  },

  methods: {
    ...mapActions([
      'togglePrimaryNav',
      'condensePrimaryNav'
    ]),

    toggleMenu() {
      if (!this.primaryNavCondensed) {
        this.condensePrimaryNav(true)
      } else {
        this.condensePrimaryNav(false)
      }
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../styles/_theme.scss';
@use '../../styles/collapse-handle';

.collapse-handle {
  @include collapse-handle.collapse-handle(".user-navigation");
}


.user-navigation {
  background: linear-gradient(160deg, theme.$purple_2 0%, theme.$purple_3 100%);
  box-sizing: border-box;
  color: theme.$white;
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 230px;
  transition: width .2s ease-out;
  position: relative;
  z-index: 30;

  &.condensed {
    width: 56px;
    .menu-wrap {
      margin: 0 0 16px -6px;
    }

    .nav-divider {
      margin: 8px 12px;
    }
  }

  .nav-divider {
    height: 1px;
    margin: 8px 24px;
    background: rgba(255, 255, 255, 0.12);
  }

  .menu-wrap {
    flex: 1;

    &.bottom {
      flex: 0;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      margin-top: auto;
    }
  }

  .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 500;
  }
}
</style>