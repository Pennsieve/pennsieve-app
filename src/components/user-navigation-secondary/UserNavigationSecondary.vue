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
    
    <button
      type="button"
      class="collapse-handle"
      :aria-label="secondaryNavCondensed ? 'Expand secondary navigation' : 'Collapse secondary navigation'"
      :aria-expanded="!secondaryNavCondensed"
      @click="toggleSecondaryMenu"
    >
      <IconArrowLeft
        class="collapse-chevron"
        :class="{ 'is-flipped': secondaryNavCondensed }"
        :width="6"
        :height="10"
        color="currentColor"
      />
    </button>
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
import IconArrowLeft from '../icons/IconArrowLeft.vue'
import IconOrcid from '../icons/IconOrcid.vue'
import IconGitHub from '../icons/IconGitHub.vue'
import IconApi from '../icons/IconApi.vue'

export default {
  name: 'UserNavigationSecondary',

  components: {
    UserNavigationSecondaryItem,
    BfNavigationTertiary,
    IconArrowLeft,
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
@use '../../styles/collapse-handle';

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

}

// Top level, not nested: the mixin's reveal selector is
// ".user-navigation:hover &", so nesting would resolve to
// ".user-navigation:hover .user-navigation .collapse-handle".
.collapse-handle {
  @include collapse-handle.collapse-handle(".user-navigation");
}
</style>