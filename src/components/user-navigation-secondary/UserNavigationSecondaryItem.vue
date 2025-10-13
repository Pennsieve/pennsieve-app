<template>
  <router-link
    :to="link"
    class="user-navigation-secondary-item"
    :class="{ condensed: condensed, active: isActive }"
    active-class="active"
  >
    <div class="icon-wrap">
      <slot name="icon" />
    </div>
    <div v-if="!condensed" class="label-wrap">
      <span class="label">{{ label }}</span>
    </div>
  </router-link>
</template>

<script>
export default {
  name: 'UserNavigationSecondaryItem',
  
  props: {
    link: {
      type: Object,
      required: true
    },
    label: {
      type: String,
      required: true
    },
    condensed: {
      type: Boolean,
      default: false
    }
  },

  computed: {
    isActive() {
      return this.$route && this.$route.name === this.link.name
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../styles/_theme.scss';

.user-navigation-secondary-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  color: $gray_5;
  text-decoration: none;
  transition: all 150ms ease-out;
  cursor: pointer;
  position: relative;

  &:hover {
    background: $gray_1;
    color: $gray_6;
  }

  &.active {
    background: $purple_tint;
    color: $purple_2;
    
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: $purple_2;
    }
  }

  &.condensed {
    justify-content: center;
    
    .label-wrap {
      display: none;
    }
  }

  .icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .label-wrap {
    margin-left: 12px;
    display: flex;
    flex-direction: column;
    flex: 1;
    
    .label {
      font-size: 14px;
      font-weight: 400;
      line-height: 1.4;
    }
  }
}
</style>