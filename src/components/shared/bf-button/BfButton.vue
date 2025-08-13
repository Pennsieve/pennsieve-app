<template>
  <button
    class="bf-button"
    :disabled="disabled || processing"
    :autofocus="autofocus"
    :type="type"
    :class="[
      type ? 'bf-button--' + type : '',
      hasPrefixSlot ? 'hasPrefix' : '',
    ]"
  >

    <span v-if="hasPrefixSlot" class="prefix">
      <slot name="prefix" />
    </span>

    <template v-if="processing">
      <!-- <el-spinner class="button-spinner" :radius="40" /> -->

      <template v-if="processingText">
        {{ processingText }}
      </template>

      <template v-else>
        <slot />
      </template>
    </template>

    <template v-if="!processing">
      <slot />
    </template>

    <span v-if="hasSuffixSlot" class="suffix">
      <slot name="suffix" />
    </span>
  </button>
</template>

<script>
export default {
  name: "BfButton",

  props: {
    type: {
      type: String,
      default: "button",
    },
    autofocus: Boolean,
    disabled: Boolean,
    processing: {
      type: Boolean,
      default: false,
    },
    processingText: {
      type: String,
      default: "",
    },
  },

  computed: {
    hasPrefixSlot: function () {
      return !!this.$slots["prefix"];
    },
    hasSuffixSlot: function () {
      return !!this.$slots["suffix"];
    },
  },

  methods: {
    /**
     * On click
     * @param {Object} evt
     */
    // handleClick(evt) {
    //   // this.$emit('click', evt)
    // }
  },
};
</script>

<style lang="scss" scoped>
@use "../../../styles/theme";

.bf-button {
  align-items: center;
  background: theme.$app-primary-color;
  border: 1px solid transparent;
  border-radius: 3px;
  color: theme.$white;
  cursor: pointer;
  display: inline-flex;
  flex-direction: row;
  font-size: 14px;
  justify-content: center;
  line-height: 1;
  margin: 0;
  min-width: 160px;
  outline: none;
  padding: 12px 16px;
  text-transform: none;
  min-height: 40px;

  &.dropdown-button {
    justify-content: left;
    text-align: left;
  }

  &.flex {
    min-width: 40px;
  }

  &.hasPrefix {
    padding: 4px 16px;
  }

  &[disabled] {
    opacity: 0.3;
    color: theme.$gray_1;
    cursor: default;
  }
  &:not([disabled]) {
    &:hover,
    &:focus {
      background: theme.$purple_3;
    }
    &:hover {
      box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.25);
    }
    &:active {
      box-shadow: none;
    }
  }
  &.small {
    font-size: 10px;
    color: #ffffff;
    text-align: left;
    line-height: 12px;
    padding: 8px 16px;
    margin-bottom: -10px;
    margin-top: -4px;
  }
  &.compact {
    padding: 8px 16px;
  }
  &.icon {
    padding: 11px 11px;
    min-width: 0;
    height: 40px;
  }
  &.secondary {
    background: theme.$gray_1;
    border-color: #d3d5da;
    color: theme.$text-color;
    &:not([disabled]) {
      &:hover,
      &:focus {
        background: theme.$gray_2;
      }
    }
    &.ghost {
      border-color: theme.$gray_2;
      color: theme.$text-color;
      &:not([disabled]) {
        &:active,
        &:focus {
          background: #f9f9f9;
          color: theme.$text-color;
        }
      }
    }
  }
  &.viewer-selector {
    background: $purple_tint;
    border: 1px solid $purple_0_7;
    min-height: 40px;
    margin: 0;
    min-width: 140px;
    &:not([disabled]) {
      &:hover,
      &:focus {
        background: $purple_0_7;
      }
    }
    &.active {
      color: white;
      background-color: $purple_1;
      &:not([disabled]) {
        &:active,
        &:focus {
          background: $purple_1;
          color: white;
        }
      }
    }
  }
  &.green {
    background: theme.$green_1;
    &:not([disabled]) {
      &:hover,
      &:focus {
        background: theme.$green_2;
      }
    }
    &.ghost {
      border-color: theme.$green_1;
      color: theme.$green_1;
      &:not([disabled]) {
        &:active,
        &:focus {
          background: theme.$green_1;
          color: white;
        }
      }
    }
  }
  &.red {
    background: theme.$red_1;
    &:not([disabled]) {
      &:hover,
      &:focus {
        background: theme.$red_2;
      }
    }
    &.ghost {
      border-color: theme.$red_1;
      color: theme.$red_1;
      &:not([disabled]) {
        &:active,
        &:focus {
          background: theme.$red_1;
          color: white;
        }
      }
    }
  }
  &.ghost {
    background: transparent;
    border-color: theme.$app-primary-color;
    color: theme.$app-primary-color;
    font-weight: 500;
    &:not([disabled]) {
      &:hover {
        background: white;
      }
      &:active,
      &:focus {
        background: theme.$app-primary-color;
        color: white;
      }
    }
  }
  &.dashed {
    background: #f9f9f9;
    border: 1px dashed theme.$gray_2;
    color: theme.$gray_6;
    &:not([disabled]) {
      &:hover,
      &:active,
      &:focus {
        background: #f9f9f9;
        color: theme.$gray_6;
      }
    }
  }
  & iron-icon {
    margin-right: 5px;
  }
}
.button-spinner {
  height: 20px;
  margin: -3px 8px -3px 0;
  width: 20px;
}
.prefix,
.suffix {
  display: inline-flex;
}
.prefix {
  margin-right: 2px;
  .compact & {
    margin-right: 2px;
  }
}
.suffix {
  margin-left: 8px;
  .compact & {
    margin-left: 8px;
  }
}
</style>
