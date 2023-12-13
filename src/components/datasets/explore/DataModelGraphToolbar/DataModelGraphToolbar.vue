<template>
  <div class="graph-toolbar">
    <el-tooltip
      placement="top"
      content="Center and Fit to Screen"
      :popper-options="popperOptions"
      :open-delay="300"
    >
      <button
        @click="$emit('center')"
      >
        <IconCenter
          class="icon-center"
          :height="20"
          :width="20"
        />
      </button>
    </el-tooltip>
    <el-tooltip
      placement="top"
      content="Zoom Out"
      :popper-options="popperOptions"
      :open-delay="300"
    >
      <button
        @click="$emit('zoom-out')"
      >
        <IconZoomOut
          icon="icon-zoom-out"
          height="24"
          width="24"
        />
      </button>
    </el-tooltip>
    <el-tooltip
      placement="top"
      content="Zoom In"
      :popper-options="popperOptions"
      :open-delay="300"
    >
      <button
        @click="$emit('zoom-in')"
      >
        <IconZoomIn
          :height="24"
          :width="24"
        />
      </button>
    </el-tooltip>
    <el-tooltip
      placement="top"
      content="Fullscreen"
      :popper-options="popperOptions"
      :open-delay="300"
    >
      <button
        v-if="!isFullscreen"
        @click="$emit('fullscreen')"
      >
        <IconFullScreen
          :height="24"
          :width="24"
        />
      </button>
    </el-tooltip>
    <button
      v-if="isFullscreen"
      @click="$emit('exit-fullscreen')"
    >
      <IconMinimize
        :height="24"
        :width="24"
      />
    </button>
  </div>
</template>

<script>
  import IconZoomIn from "../../../icons/IconZoomIn.vue";
  import IconFullScreen from "../../../icons/IconFullScreen.vue";
  import IconMinimize from "../../../icons/IconMinimize.vue";
  import IconCenter from "../../../icons/IconCenter.vue";
  import IconZoomOut from "../../../icons/IconZoomOut.vue";

  export default {
    name: 'DataModelGraphToolbar',
    components: {IconCenter, IconMinimize, IconFullScreen, IconZoomIn,IconZoomOut},
    data() {
      return {
        isFullscreen: false,
        popperOptions: {
          boundariesElement: 'body'
        }
      }
    },

    mounted: function() {
      document.addEventListener('fullscreenchange', this.onFullscreenchange.bind(this))
    },

    beforeDestroy: function() {
      document.removeEventListener('fullscreenchange', this.onFullscreenchange.bind(this))
    },

    methods: {
      /**
       * List for fullscreen event and set fullscreen data
       */
      onFullscreenchange: function(evt) {
        this.isFullscreen = document.fullscreenElement
      }
    }
  }
</script>

<style scoped lang="scss">
  @import './src/assets/_variables.scss';

  .graph-toolbar {
    background: $gray_1;
    border: 0.5px solid $gray_3;
    border-radius: 2px;
    //box-shadow: 3px 1px 11px 0 rgba(0,0,0,0.21);
    display: flex;
    left: 32px;
    position: absolute;
    top: 20px;
    z-index: 3;
    button {
      margin-top: 3px;
      border-left: 1px solid $gray_2;
      color: $purple_3;
      padding: 6px;
      //width: 33px;
      &:first-child {
        border: none;
      }
      &:hover {
        background: $gray_2
      }
      &:active {
        color: $app-primary-color;
      }
    }
  }
</style>
