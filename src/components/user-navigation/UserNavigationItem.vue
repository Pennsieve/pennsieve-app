<template>
  <router-link
    :to="link"
    class="user-navigation-item"
    :class="{ condensed: condensed }"
  >
    <div class="icon-main">
      <slot name="icon" />
    </div>
    <div v-if="!condensed" class="label-wrap">
      <span class="label">{{ label }}</span>
      <span v-if="subtitle" class="subtitle">{{ subtitle }}</span>
    </div>
  </router-link>
</template>

<script>
export default {
  name: 'UserNavigationItem',
  
  props: {
    link: {
      type: Object,
      required: true
    },
    label: {
      type: String,
      required: true
    },
    subtitle: {
      type: String,
      default: ''
    },
    condensed: {
      type: Boolean,
      default: false
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../styles/_theme.scss';

.user-navigation-item {
  align-items: center;
  background: transparent;
  box-sizing: border-box;
  color: $white;
  cursor: pointer;
  display: flex;
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  padding: 0 24px;
  text-decoration: none;
  height: 56px;
  position: relative;
  
  &:first-child {
    margin-top: 0;
  }

  &:hover, &:focus {
    background: rgba(255, 255, 255, 0.1);
    outline: none;
    text-decoration: none;
    color: $white;
    
    .svg-icon {
      color: $white;
    }
  }

  &.router-link-active {
    background: rgba(255, 255, 255, 0.15);
    color: $white !important;

    .svg-icon {
      color: $white !important;
    }
    
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: #ff8300;
    }
  }

  &.condensed {
    justify-content: center;
    padding: 0;
    
    .label-wrap {
      display: none;
    }
    
    .icon-main {
      margin-right: 0;
    }
  }

  .svg-icon {
    color: $gray_2;
  }

  .icon-main {
    display: inline-block;
    flex-shrink: 0;
    height: 20px;
    margin-right: 24px;
    min-width: 20px;
    width: 20px;
  }

  .label-wrap {
    display: flex;
    flex-direction: column;
    flex: 1;
    white-space: nowrap;
    
    .label {
      flex: 1;
      white-space: nowrap;
    }
    
    .subtitle {
      font-size: 12px;
      opacity: 0.7;
      margin-top: 2px;
    }
  }
}
</style>