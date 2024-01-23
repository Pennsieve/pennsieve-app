<template>
  <el-tooltip
    popper-class="tooltip-navigation"
    placement="right"
    :content="label"
    :disabled="!condensed"
    :open-delay="200"
  >

    <router-link :class="itemClass" :to="link" :style="styleObject">
      <div class="svg-icon svg-fill icon-main">
        <slot name="icon" ></slot>
      </div>

      <span
        v-if="!condensed"
        ref="routerlink"
        class="label">
        {{ label }}
      </span>

      <div
        v-if="$slots['suffix']"
        class="slot-suffix"
      >
        <slot name="suffix" />
      </div>
    </router-link>
  </el-tooltip>
</template>

<script>

import CustomTheme from "../../../mixins/custom-theme";

export default {
    name: 'BfNavigationItem',

    mixins:[
      CustomTheme
    ],


    props: {
      condensed: {
        type: Boolean,
        default: false
      },
      secondary: {
        type: Boolean,
        default: false
      },
      item: {
        type: Object,
        default: function() {
          return {}
        }
      },
      link: {
        type: Object,
        default: function() {
          return {}
        }
      },
      label: {
        type: String,
        default: ''
      },
      icon: {
        type: String,
        default: ''
      },
      styleColor: {
        type: String,
        default: ''
      },
      orgId: {
        type: String,
        default: ''
      },
    },
    computed: {
      getThemeColors: function() {
        return this.getTheme(this.orgId)
      },
      styleObject: function() {
        // Check if any of the matched routes (including parents of current route)
        // matches --> link is active
        let cl = ''
        if (this.$route.matched.map(a => a.name).includes(this.link.name)) {
          cl = this.styleColor
        }

        return this.styleColor? {
          '--color-hover': this.styleColor,
          'color': cl

        } : {
          '--color-hover': '#4d628c'
        }
      },
      itemClass: function() {
        return `bf-navigation-item ${this.secondary? 'secondary': ''}`
      }
    }
  }
</script>

<style lang="scss">
  @import '../../../assets/_variables.scss';

  .bf-navigation-item {
    align-items: center;
    background: transparent;
    box-sizing: border-box;
    color: $gray_6;
    display: flex;
    font-weight: 500;
    overflow: hidden;
    padding: 0 24px;
    text-decoration: none;
    height: 56px;
    &:first-child {
      margin-top: 0;
    }
    &:hover, &:focus {
      background: $gray_1;
      outline: none;
      text-decoration: none;
      color: $gray_6;

      .svg-icon {
        color: $gray_2;
      }
    }
    &.router-link-active {
      background: transparent;
      color: $purple_1;

      .svg-icon {
        color: $purple_1;
      }
      &.secondary {
      background: $purple_tint;
      border-right: 4px solid;
    }
    }
    .svg-icon {
      color: $gray_2;
    }
    &.disabled {
      pointer-events: none;
    }
    &.secondary {
      .svg-icon {
        color: inherit;
      }
      &:hover, &:focus, &.active {
          color: var(--color-hover);
      }
    }
    .primary & {
      color: $white;
      &:hover, &:focus, &.active {
        background: var(--color-hover);
        color: $white;
        .svg-icon {
          color: $white;
        }
      }
      &.router-link-active {
        background: $gray_1;
        color: var(--color-hover);

        .svg-icon {
          color: var(--color-hover);
        }
      }
      .svg-icon {
        color: $gray_2;
      }
    }
    .icon-main {
      display: inline-block;
      flex-shrink: 0;
      height: 20px;
      margin-right: 24px;
      min-width: 20px;
      width: 20px;
    }
    .label {
      flex: 1;
      white-space: nowrap;
    }
    .slot-suffix {
      display: inline-flex;
      margin-left: 8px;
    }
  }
</style>
