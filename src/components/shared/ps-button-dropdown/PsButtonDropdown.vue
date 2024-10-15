<template xmlns="http://www.w3.org/1999/html">
  <div>
    <button
      :class="menuOpen ? `ps-button-dropdown active` : `ps-button-dropdown`"
    >
      <template v-if="menuOpen">
        <div class = "active-actions">X</div>
      </template>
      <template v-else>
        <div>...</div>
      </template>
    </button>

    <div
         :class="menuOpen ? `button-array active` : `button-array`">

      <slot name="buttons"/>


    </div>

  </div>



</template>

<script>
import IconAnalysis from "@/components/icons/IconAnalysis.vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import IconUpload from "@/components/icons/IconUpload.vue";
import IconPlus from "@/components/icons/IconPlus.vue";

export default {
  name: "PsDropDownButton",
  components: {IconPlus, IconUpload, BfButton, IconAnalysis},

  props: {
    menuOpen: {
      type: Boolean,
      default: false
    },

  }
};
</script>

<style lang="scss" scoped>
@import "../../../assets/_variables.scss";

.button-array {
  position: absolute;
  z-index: 10;
  margin: 8px 0;
  left: calc(100% - 80px);
  background: white;
  padding: 0 8px;
  width: 32px;
  overflow: hidden;
  visibility: hidden;

  &.active {
    visibility: visible;
    transition-property: all;
    transition-duration: 0.25s;
    left: calc(100% - 200px);
    max-width: 160px;
    width: 160px;
  }

  .btn {
    margin-top:8px
  }
}

.active-actions {
  font-size: 14pt;
}


.ps-button-dropdown {
  //margin-left: 8px;
  align-items: center;
  background: $app-primary-color;
  border: 1px solid transparent;
  border-radius: 3px;
  color: $white;
  cursor: pointer;
  display: inline-flex;
  flex-direction: row;
  font-size: 24px;
  justify-content: center;
  line-height: 1;
  outline: none;
  text-transform: none;
  min-height: 40px;
  width: 40px;

  &.active {
    background: $purple_tint;
    color: $purple_3;
  }
}

.bb {
  background: #1c4c5b;
}

</style>
