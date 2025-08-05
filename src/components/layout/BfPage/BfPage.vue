<template>
  <div
    class="bf-page"
    :class="[condensed ? 'page-condensed' : '']"
  >
    <slot name="navigationSecondary"/>
    <div class="stageWrapper">
      <slot name="banner" />
      <slot name="heading" />
      <slot name="stage" />
      <slot />
    </div>

  </div>
</template>

<script>
  import { pathOr } from 'ramda'
  import EventBus from '../../../utils/event-bus'

  export default {
    name: 'BfPage',

    components: {
    },

    data: function() {
      return {
        condensed: false
      }
    },

    mounted: function() {
      EventBus.$on('stage-scroll', this.onScroll.bind(this))
    },

    beforeUnmount: function() {
      EventBus.$off('stage-scroll', this.onScroll.bind(this))
    },

    methods: {
      /**
       * Set condensed if the user has scrolled down the view
       * @param {Object} evt
       */
      onScroll: function(evt) {
        const scrollTop = pathOr(0, ['target', 'scrollTop'], evt)
        this.condensed = scrollTop > 0
      }
    }
  }
</script>

<style scoped lang="scss">
  .bf-page {
    display: flex;
    flex-direction: row;
  }

  .stageWrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
</style>
