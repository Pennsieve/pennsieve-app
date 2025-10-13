<template>
  <div
    class="user-navigation primary"
    :class="[
      primaryNavCondensed || secondaryNavOpen ? 'condensed' : '',
    ]"
  >
    <div class="logo-wrap">
      <router-link tag="button" :to="{ name: 'home' }">
        <icon-pennsieve-mark
          v-show="!primaryNavCondensed || secondaryNavOpen"
          class="logo"
          :width="24"
          :height="24"
          color="currentColor"
        />
      </router-link>
      <button
        v-show="!secondaryNavOpen"
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
        />
        <IconNavExpand
          :is-visible="primaryNavCondensed"
          :width="primaryNavCondensed ? 32 : 24"
          :height="primaryNavCondensed ? 32 : 24"
          color="#fff"
          class="collapse"
        />
      </button>
    </div>

    <div class="menu-wrap">

      <user-navigation-item
        :link="{ name: 'shared-with-me' }"
        label="My Data"
        :condensed="primaryNavCondensed"
      >
        <template v-slot:icon>
          <IconShare :width="20" :height="20" color="currentColor" />
        </template>
      </user-navigation-item>



      <user-navigation-item
        :link="{ name: 'my-code' }"
        label="My Code"
        :condensed="primaryNavCondensed"
      >
        <template v-slot:icon>
          <IconGitHub :width="20" :height="20" color="currentColor" />
        </template>
      </user-navigation-item>


      <user-navigation-item
        :link="{ name: 'my-collections' }"
        label="My Collections"
        :condensed="primaryNavCondensed"
      >
        <template v-slot:icon>
          <IconCollection :width="20" :height="20" color="currentColor" />
        </template>
      </user-navigation-item>


      <user-navigation-item
        :link="{ name: 'my-analysis' }"
        label="My Analysis"
        :condensed="primaryNavCondensed"
      >
        <template v-slot:icon>
          <IconAnalysis :width="20" :height="20" color="currentColor" />
        </template>
      </user-navigation-item>


      <user-navigation-item
        :link="{ name: 'data-publishing' }"
        label="Submit Dataset"
        :condensed="primaryNavCondensed"
      >
        <template v-slot:icon>
          <IconUpload :width="20" :height="20" color="currentColor" />
        </template>
      </user-navigation-item>

    </div>

    <div class="menu-wrap bottom">
      <user-navigation-item
        :link="{ name: 'my-settings' }"
        label="Account Settings"
        :condensed="primaryNavCondensed"
      >
        <template v-slot:icon>
          <IconSettings :width="20" :height="20" color="currentColor" />
        </template>
      </user-navigation-item>
<!--      <user-navigation-item-->
<!--        v-if="userProfile && userProfile.email"-->
<!--        :link="{ name: 'user-profile' }"-->
<!--        :label="userDisplayName"-->
<!--        :subtitle="userProfile.email"-->
<!--        :condensed="primaryNavCondensed"-->
<!--      >-->
<!--        <template v-slot:icon>-->
<!--          <div class="user-avatar">-->
<!--            {{ userInitials }}-->
<!--          </div>-->
<!--        </template>-->
<!--      </user-navigation-item>-->
    </div>
    
    <bf-navigation-tertiary
      :bkColor="'#4d628c'"
      :org-id="null"
    />
  </div>
</template>

<script>
import { mapGetters, mapState, mapActions } from 'vuex'
import UserNavigationItem from './UserNavigationItem.vue'
import BfNavigationTertiary from '../bf-navigation-tertiary/BfNavigationTertiary.vue'
import IconPennsieveMark from '../icons/IconPennsieveMark.vue'
import IconNavCollapse from '../icons/IconNavCollapse.vue'
import IconNavExpand from '../icons/IconNavExpand.vue'
import IconUser from '../icons/IconUser.vue'
import IconUpload from '../icons/IconUpload.vue'
import IconAnalysis from '../icons/IconAnalysis.vue'
import IconGitHub from '../icons/IconGitHub.vue'
import IconShare from '../icons/IconShare.vue'
import IconSettings from "@/components/icons/IconSettings.vue";
import IconCollection from "@/components/icons/IconCollection.vue";

export default {
  name: 'UserNavigation',
  
  components: {
    IconSettings,
    IconCollection,
    UserNavigationItem,
    BfNavigationTertiary,
    IconPennsieveMark,
    IconNavCollapse,
    IconNavExpand,
    IconUser,
    IconUpload,
    IconAnalysis,
    IconGitHub,
    IconShare
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

.user-navigation {
  background: linear-gradient(to top, theme.$purple_2, theme.$purple_1);
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
    
    .logo-wrap {
      padding: 20px 12px;
      justify-content: center;
    }
  }

  .logo-wrap {
    padding: 20px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);

    .logo {
      color: #fff;
    }

    .btn-expand-collapse {
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      
      &:hover, &:focus {
        opacity: .75;
      }
    }
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