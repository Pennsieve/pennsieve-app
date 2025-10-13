<template>
  <div
    class="user-navigation secondary"
    :class="[secondaryNavCondensed ? 'condensed' : '']"
  >
    <div class="menu-wrap">
      <div class="heading-wrap">
        <template v-if="!secondaryNavCondensed">
          <div class="user-section-title">
            <span class="title-text">User Settings</span>
          </div>
        </template>
        
        <button
          class="btn-expand-collapse"
          name="Toggle Secondary Menu"
          @click="toggleSecondaryMenu"
        >
          <IconNavCollapse
            :is-visible="!secondaryNavCondensed"
            :width="secondaryNavCondensed ? 32 : 24"
            :height="secondaryNavCondensed ? 32 : 24"
            color="#404040"
            class="collapse"
          />
          <IconNavExpand
            :is-visible="secondaryNavCondensed"
            :width="secondaryNavCondensed ? 32 : 24"
            :height="secondaryNavCondensed ? 32 : 24"
            color="#404040"
            class="collapse"
          />
        </button>
      </div>

      <div class="nav-items">
        <user-navigation-secondary-item
          :link="{ name: 'user-orcid' }"
          label="ORCID"
          :condensed="secondaryNavCondensed"
        >
          <template v-slot:icon>
            <IconOrcid :width="20" :height="20" color="currentColor" />
          </template>
        </user-navigation-secondary-item>

        <user-navigation-secondary-item
          :link="{ name: 'user-github' }"
          label="GitHub"
          :condensed="secondaryNavCondensed"
        >
          <template v-slot:icon>
            <IconGitHub :width="20" :height="20" color="currentColor" />
          </template>
        </user-navigation-secondary-item>

        <user-navigation-secondary-item
          :link="{ name: 'user-api' }"
          label="API"
          :condensed="secondaryNavCondensed"
        >
          <template v-slot:icon>
            <IconApi :width="20" :height="20" color="currentColor" />
          </template>
        </user-navigation-secondary-item>
      </div>
    </div>
    
    <span class="collapse-handle" @click="toggleSecondaryMenu" />
    <bf-navigation-tertiary
      v-if="secondaryNavCondensed"
      :bkColor="'#4d628c'"
      :org-id="null"
      key="user-tertiary-nav"
    />
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import UserNavigationSecondaryItem from './UserNavigationSecondaryItem.vue'
import BfNavigationTertiary from '../bf-navigation-tertiary/BfNavigationTertiary.vue'
import IconNavCollapse from '../icons/IconNavCollapse.vue'
import IconNavExpand from '../icons/IconNavExpand.vue'
import IconOrcid from '../icons/IconOrcid.vue'
import IconGitHub from '../icons/IconGitHub.vue'
import IconApi from '../icons/IconApi.vue'

export default {
  name: 'UserNavigationSecondary',

  components: {
    UserNavigationSecondaryItem,
    BfNavigationTertiary,
    IconNavCollapse,
    IconNavExpand,
    IconOrcid,
    IconGitHub,
    IconApi
  },

  mounted() {
    this.toggleSecondaryNav(true)
  },

  beforeUnmount() {
    this.toggleSecondaryNav(false)
  },

  computed: {
    ...mapState([
      'secondaryNavCondensed',
      'primaryNavOpen'
    ])
  },

  methods: {
    ...mapActions([
      'toggleSecondaryNav',
      'togglePrimaryNav',
      'condenseSecondaryNav'
    ]),

    toggleSecondaryMenu() {
      this.togglePrimaryNav(!this.primaryNavOpen)
      this.condenseSecondaryNav(!this.secondaryNavCondensed)
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../styles/_theme.scss';

.user-navigation {
  background: theme.$white;
  border-right: 1px solid theme.$gray_2;
  color: theme.$gray_6;
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 224px;
  transition: width 150ms ease-out;
  position: relative;
  z-index: 29;

  &.condensed {
    width: 56px;
  }

  .menu-wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .heading-wrap {
    padding: 20px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid theme.$gray_2;
    min-height: 60px;

    .user-section-title {
      flex: 1;
      
      .title-text {
        font-size: 16px;
        font-weight: 500;
        color: theme.$gray_6;
      }
    }

    .btn-expand-collapse {
      background: none;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      flex-shrink: 0;
      
      &:hover {
        opacity: 0.8;
      }
    }
  }

  .nav-items {
    flex: 1;
    padding: 16px 0;
    overflow-y: auto;
  }

  .collapse-handle {
    position: absolute;
    right: -8px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 40px;
    background: theme.$gray_3;
    border-radius: 0 8px 8px 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 150ms ease-out;

    &:hover {
      background: theme.$gray_4;
    }

    &::after {
      content: '';
      width: 2px;
      height: 12px;
      background: theme.$white;
      border-radius: 1px;
    }
  }
}
</style>