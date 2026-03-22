<template>
  <el-tooltip
    popper-class="tooltip-navigation"
    placement="right"
    :content="label"
    :disabled="!condensed"
    :show-after="200"
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
        const darkenedColor = this.styleColor ? (this.pSBC(-0.25, this.styleColor) || this.styleColor) : ''
        if (this.$route.matched.map(a => a.name).includes(this.link.name)) {
          cl = darkenedColor
        }

        return this.styleColor? {
          '--color-hover': this.styleColor,
          '--color-active': darkenedColor,
          'color': cl

        } : {
          '--color-hover': '#4d628c',
          '--color-active': '#3a4a6b'
        }
      },
      itemClass: function() {
        return `bf-navigation-item ${this.secondary? 'secondary': ''}`
      }
    }
  }
</script>

<style lang="scss">
  @use '../../../styles/theme';

  .bf-navigation-item {
    align-items: center;
    background: transparent;
    box-sizing: border-box;
    color: theme.$gray_6;
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
      background: theme.$gray_1;
      outline: none;
      text-decoration: none;
      color: theme.$gray_6;

      .svg-icon {
        color: theme.$gray_2;
      }
    }
    &.router-link-active {
      background: transparent;
      color: theme.$purple_1;

      .svg-icon {
        color: theme.$purple_1;
      }
      &.secondary, &.secondary:hover, &.secondary:focus {
        background: theme.$purple_tint;
        border-right: 4px solid var(--color-active, theme.$purple_1);
        color: var(--color-active, theme.$purple_1);
        font-weight: 600;

        .svg-icon {
          color: var(--color-active, theme.$purple_1);
        }
      }
    }
    .svg-icon {
      color: theme.$gray_2;
    }
    &.disabled {
      pointer-events: none;
    }
    &.secondary {
      transition: background 0.15s ease, color 0.15s ease;

      .svg-icon {
        color: inherit;
        transition: color 0.15s ease;
      }
      &:hover, &:focus {
          background: theme.$gray_1;
          color: var(--color-active, var(--color-hover));

          .svg-icon {
            color: var(--color-active, var(--color-hover));
          }
      }
    }
    .primary & {
      color: theme.$white;
      position: relative;
      
      &:hover, &:focus, &.active {
        background: rgba(255, 255, 255, 0.1);
        color: theme.$white;
        .svg-icon {
          color: theme.$white;
        }
      }
      &.router-link-active {
        background: rgba(255, 255, 255, 0.15);
        color: theme.$white !important;

        .svg-icon {
          color: theme.$white !important;
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
      .svg-icon {
        color: theme.$gray_2;
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
