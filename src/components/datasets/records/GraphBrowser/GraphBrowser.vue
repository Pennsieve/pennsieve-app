<template>
  <bf-stage>
    <div class="graph-browser">
      <data-model-graph
        ref="dataModelGraph"
        :show-title="false"
        :height="chartHeight"
        :show-overlay="false"
        :show-toolbar="true"
      />

      <div
        v-if="hasModels"
        class="models-list-wrap"
        :class="{ 'visible': modelsListVisible }"
      >
        <button
          class="btn-toggle-models-list"
          @click="toggleModelsList"
        >
          <IconArrowRight
            :class="[ modelsListArrowDir === 'left' ? 'svg-flip' : '' ]"
            :height="16"
            :width="16"
          />
        </button>
        <div
          ref="modelsList"
          class="models-list-scroll"
        >
          <models-list
            :show-heading="false"
            :is-link="false"
            :should-reset.sync="resetModelsList"
            :scrolling-list="true"
            @click="focusNode"
          />
        </div>
      </div>
    </div>

  </bf-stage>
</template>

<script>
  import debounce from 'lodash/debounce'
  import DataModelGraph from '../../explore/DataModelGraph.vue'
  import ModelsList from '../ModelsList/ModelsList.vue'

  import {
    mapActions,
    mapState
  } from 'vuex'
  import IconArrowRight from "../../../icons/IconArrowRight.vue";
  import Cookies from "js-cookie";

  export default {
    name: 'GraphBrowser',

    components: {
      IconArrowRight,
      DataModelGraph,
      ModelsList
    },

    data() {
      return {
        chartHeight: 0,
        isFullscreen: false,
        modelsListVisible: true,
        resetModelsList: false
      }
    },

    computed: {
      ...mapState([
        'concepts'
      ]),

      /**
       * Compute direction for models list arrow based on if it is visible
       * @returns {String}
       */
      modelsListArrowDir: function() {
        return this.modelsListVisible ? 'right' : 'left'
      },

      /**
       * Compute if the dataset has models
       * @returns {Boolean}
       */
      hasModels: function() {
        return this.concepts.length > 0
      }
    },

    created: function () {
      window.addEventListener('resize', this.setChartHeight)
      this.setChartHeight()
    },

    mounted: function() {
        const token = Cookies.get('user_token')
        if (token) {
          this.fetchModels()
        }
      document.addEventListener('fullscreenchange', this.onFullscreenchange.bind(this))

    },

    beforeDestroy: function() {
      document.removeEventListener('fullscreenchange', this.onFullscreenchange.bind(this))
      window.removeEventListener('resize', this.setChartHeight)
    },

    methods: {
      ...mapActions('metadataModule', [
        'fetchModels'
      ]),

      /**
       * Set chart height based on the height of the window
       */
      setChartHeight: debounce(
        function() {
          const rafter = document.querySelector('.bf-rafter')
          const rafterHeight = this.isFullscreen ? 0 : rafter.offsetHeight
          this.chartHeight = window.innerHeight - rafterHeight
        },
        100
      ),

      /**
       * List for fullscreen event and set fullscreen data
       */
      onFullscreenchange: function(evt) {
        this.isFullscreen = document.fullscreenElement
        this.setChartHeight()
      },

      /**
       * Toggle models list visibility and scroll list to the top
       */
      toggleModelsList: function() {
        this.modelsListVisible = !this.modelsListVisible

        // Scroll list to the top
        if (this.modelsListVisible) {
          this.$refs.modelsList.scrollTop = 0
          this.resetModelsList = true
        }
      },

      /**
       * Focus node on the chart
       */
      focusNode: function(evt) {
        if (this.$refs.dataModelGraph) {
          this.$refs.dataModelGraph.focusNode(evt)
        }
      }
    }
  }
</script>

<style lang="scss" scoped>
  @import '../../../../assets/_variables.scss';

  .graph-browser {
    margin: -32px;
    height: calc(100vh - 114px);
    overflow: hidden;
    position: relative;
  }
  .models-list-wrap {
    border-left: 1px solid $gray_2;
    height: 100%;
    position: absolute;
    right: 0;
    top: 0;
    transform: translate3d(100%, 0, 0);
    transition: transform .3s ease-out;
    width: 300px;
    will-change: transform;
    z-index: 3;
    &.visible {
      transform: translate3d(0, 0, 0);
    }
  }
  .models-list-scroll {
    height: 100%;
    overflow: hidden;
    background: $gray_1;
    padding: 8px 8px 0 0 ;
  }
  .btn-toggle-models-list {
    align-items: center;
    background: $gray_1;
    border-left: 1px solid $gray_2;
    border-top: 1px solid $gray_2;
    border-bottom: 1px solid $gray_2;
    display: flex;
    height: 32px;
    left: -33px;
    justify-content: center;
    position: absolute;
    top: 20px;
    width: 33px;
    &:after {
      background: $gray_1;
      content: '';
      height: 100%;
      pointer-events: none;
      position: absolute;
      top: 0;
      right: -5px;
      width: 5px;
    }
  }
</style>
