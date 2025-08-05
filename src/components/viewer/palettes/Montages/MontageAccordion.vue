<template>
  <div
    class="accordion"
    :style="{maxHeight:`${annotationHeight}`}">
    <div class="accordion-trigger">
      <a
        href="#openAccordion"
        class="toggle"
        :style="{ borderLeft: `solid 5px ${borderColor}` }"
        @click="select"
      >
        <IconArrowUp
          v-show="!isIconHidden"
          :class="[ iconDir === 'right' ? 'toggle-icon svg-flip' : 'toggle-icon' ]"
          class="toggle-icon"
          :height="6"
          :width="10"
          @click="toggle"
        />

        <h3 :class="{selected: selected}">
          {{ title }}
        </h3>
      </a>

      <slot name="operations" />
    </div>

    <div v-if="open">
      <slot name="items" />
    </div>
  </div>
</template>

<script>
import IconArrowUp from "../../../icons/IconArrowUp.vue";
export default {
  name: 'MontageAccordion',
  components: {IconArrowUp},
  props: {
    nrLayers: {
      type: Number,
      default: function () {
        return 1
      }
    },
    layerId: Number,
    icon: String,
    borderColor: String,
    title: String,
    selected: Boolean,
    windowHeight: {
      type: Number,
      default: 0
    }
  },

  data: function() {
    return {
      openOnLoad: false,
      open: false
    }
  },

  computed: {
    isIconHidden: function() {
      return !this.icon || this.icon.length === 0;
    },
    toggleStyles: function() {
      return this.borderColor && this.borderColor.length > 0 ? `border-left: solid 5px ${this.borderColor};` : '';
    },
    iconDir: function() {
      return this.open ? 'down' : 'right'
    },
    annotationHeight: function() {
      return this.windowHeight - (this.nrLayers - 1)*35 + "px"
    }
  },

  methods: {
    fold: function() {
      this.open = false
    },
    /**
     * toggles opened property true/false
     * @param {Event} evt
     */
    toggle: function(evt) {
      this.open = !this.open
    },
    select: function(evt) {
      this.$emit('selectItem', this)
    }
  }
}
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme';

.accordion {
  background: theme.$gray_1;
  color: #000;
  font-size: 12px;
  text-decoration: none;
  white-space: nowrap;
  overflow: scroll;
  &:hover {
    background: #fff;
  }
}
.accordion-trigger {
  align-items: center;
  border-bottom: solid 1px theme.$gray_2;
  display: flex;
  flex-direction: row;
}
.toggle-icon {
  margin-right: 4px;
}
a {
  align-items: center;
  color: theme.$text-color;
  display: flex;
  flex: 1;
  height: 34px;
  padding-left: 10px;
  text-decoration: none;
}
h3 {
  font-size: 12px;
  font-weight: 500;
  line-height: 17px;
  margin: 0;

}
.selected {
  color: theme.$purple_1
}
bf-annotation-group {
  flex: 0;
  flex-shrink: unset;
}
</style>
