<template>
  <div v-show="sidePanelOpen" class="bf-viewer-side-panel">
    <palette-info v-show="sidePanelView === viewerSidePanelTypes.INFO_PANEL" />

    <palette-annotations
      v-show="sidePanelView === viewerSidePanelTypes.ANNOTATIONS"
      :ref="viewerSidePanelTypes.ANNOTATIONS"
      :window-height="window_height"
    />

    <palette-channels
      v-if="sidePanelView === viewerSidePanelTypes.CHANNELS"
      :ref="viewerSidePanelTypes.CHANNELS"
      :window-height="window_height"
      :active-viewer="activeViewer"
    />

    <palette-montages
      v-if="sidePanelView === viewerSidePanelTypes.MONTAGES"
      :ref="viewerSidePanelTypes.MONTAGES"
      :window-height="window_height"
    />

    <palette-navigator v-show="sidePanelView === 'navigator'" />
  </div>
</template>

<script>
import { mapActions } from "vuex";

import ImportHref from "../../../mixins/import-href";
import PaletteAnnotations from "../palettes/PaletteAnnotations/PaletteAnnotations.vue";
import PaletteNavigator from "../palettes/PaletteNavigator/PaletteNavigator.vue";
import PaletteChannels from "../palettes/PaletteChannels/PaletteChannels.vue";
import PaletteInfo from "../palettes/PaletteInfo/PaletteInfo.vue";

import { viewerSidePanelTypes } from "../../../utils/constants";
import PaletteMontages from "@/components/viewer/palettes/Montages/PaletteMontages.vue";

export default {
  name: "BfViewerSidePanel",

  components: {
    PaletteMontages,
    PaletteAnnotations,
    PaletteNavigator,
    PaletteChannels,
    PaletteInfo,
  },

  mixins: [ImportHref],
  props: {
    sidePanelOpen: {
      type: Boolean,
      default: false,
    },
    sidePanelView: {
      type: String,
      default: "",
    },
    activeViewer: {
      type: Object,
      default: () => {},
    },
  },

  data: function () {
    return {
      window_height: 0,
      expanded: false,
      viewerSidePanelTypes,
    };
  },

  /**
   * Vue lifecycle method
   * Import required Polymer components
   */
  mounted: function () {
    window.addEventListener("resize", this.onResize);
    this.window_height = window.innerHeight - 85;
  },

  beforeDestroy: function () {
    window.removeEventListener("resize", this.onResize);
  },

  methods: {
    ...mapActions("viewerModule", ["setSidePanel"]),

    onResize: function () {
      this.window_height = window.innerHeight - 85;
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/theme";
@use "../../../styles/element/dialog";

.bf-viewer-side-panel {
  background: #f7f7f7;
  border-left: 1px solid theme.$gray_2;
  height: 100%;
  flex-direction: column;
  width: 100%;
  max-width: 354px;
  display: flex;
}
</style>
