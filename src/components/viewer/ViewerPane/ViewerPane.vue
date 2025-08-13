<template>
  <div class="viewer-pane" v-if="cmpViewer">
    <div class="viewer-btn-wrapper" v-if="availableViewers.length > 1">
      <div v-for="viewer in availableViewers">

        <tag-pill
          :class="[viewer === this.cmpViewer ? 'active viewer-selector' : 'viewer-selector']"
          :indicator-color="viewer === this.cmpViewer? '#F9A23A': '#CCCCCC'"
          :has-indicator="false"
          :label=viewerNameMapper(viewer)
          @click="selectViewer(viewer)">

          <template #prefix>
            <div class="icon-wrapper">
              <icon-analysis/>

            </div>
          </template>
        </tag-pill>
      </div>

    </div>
    <component
      :is="cmpViewer"
      :is-preview="isPreview"
      ref="viewer"
      :idx="0"
      :pkg="pkg"
      :side-panel-open="sidePanelOpen"
    />
  </div>
</template>

<script>
import { propOr, pathOr, path, isNil } from "ramda";
import { defineAsyncComponent } from "vue";

import ImportHref from "../../../mixins/import-href";
import FileTypeMapper from "../../../mixins/FileTypeMapper";
import GetFileProperty from "../../../mixins/get-file-property";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import TagPill from "@/components/shared/TagPill/TagPill.vue";
import IconAnalysis from "@/components/icons/IconAnalysis.vue";

export default {
  name: "ViewerPane",

  components: {
    IconAnalysis,
    TagPill,
    BfButton,
    SlideViewer: defineAsyncComponent(() =>
      import("../../viewers/SlideViewer/SlideViewer.vue")
    ),
    ImageViewer: defineAsyncComponent(() =>
      import("../../viewers/ImageViewer.vue")
    ),
    PDFViewer: defineAsyncComponent(() =>
      import("../../viewers/PDFViewer.vue")
    ),
    TextViewer: defineAsyncComponent(() =>
      import("../../viewers/TextViewer.vue")
    ),
    UnknownViewer: defineAsyncComponent(() =>
      import("../../viewers/UnknownViewer.vue")
    ),
    VideoViewer: defineAsyncComponent(() =>
      import("../../viewers/VideoViewer.vue")
    ),
    TimeseriesViewer: defineAsyncComponent(() =>
      import("../../viewers/TSViewer/TSViewer.vue")
    ),
    XLSViewer: defineAsyncComponent(() =>
      import("../../viewers/XLSViewer.vue")
    ),
    UMAPViewer: defineAsyncComponent( () =>
      import ("../../viewers/UmapViewer/wrapper.vue")
    ),
    NiiViewer: defineAsyncComponent( () =>
      import ("../../viewers/NiiViewer/NiiViewerWrapper.vue")
    ),
    DataExplorer: defineAsyncComponent( () =>
      import ("../../viewers/DuckDBExplorer/DuckDBViewerWrapper.vue")
    ),
    CSVViewer: defineAsyncComponent(() =>
      import("../../viewers/CSVViewer/CSVViewerWrapper.vue")
    ),
  },

  mixins: [FileTypeMapper, GetFileProperty, ImportHref],

  props: {
    isPreview: {
      type: Boolean,
      default: false,
    },
    pkg: {
      type: Object,
      default: () => {},
    },
    sidePanelOpen: {
      type: Boolean,
      default: false,
    }
  },

  data: function () {
    return {
      cmpViewer: "",
      availableViewers: [],
    };
  },

  watch: {
    pkg: {
      handler: function (pkg) {
        if (Object.keys(pkg).length > 0) {
          console.log(pkg)
          this.loadViewer(pkg);
        }
      },
      immediate: true,
    },
  },

  methods: {
    /**
     * Invoke method on viewer
     * Event emitted from palettes
     * @param {Object} evt
     */
    activeViewerAction: function (evt) {
      const method = propOr("", "method", evt);
      const payload = propOr("", "payload", evt);
      const viewer =
        this.cmpViewer !== ""
          ? this.$refs.viewer
          : this.$el.querySelector("#viewer");
      // Check the method
      if (viewer && typeof viewer[method] === "function") {
        viewer[method](payload);
      }
    },

    viewerNameMapper: function (viewer) {
      console.log(viewer)
      switch (viewer) {
        case 'DataExplorer':
          return 'Data Explorer'
        case 'CSVViewer':
          return 'CSV Viewer'
        default:
          return viewer
      }
    },

    selectViewer: function (evt) {
      console.log(evt)
      this.cmpViewer = evt
    },

    /**
     * loads appropriate viewer based on package type
     */
    loadViewer: function (activeViewer) {

      // Reset viewers
      this.cmpViewer = "";
      const viewerWrap = this.$refs.viewerWrap;
      if (viewerWrap) {
        viewerWrap.innerHTML = "";
      }

      this.availableViewers = this.checkViewerType(activeViewer);
      console.log('Use viewerType: ' + this.availableViewers)

      if(this.isTimeseriesPackageUnprocessed(activeViewer)) {
        this.loadVueViewer("UnknownViewer");
      } else {
        this.loadVueViewer(this.availableViewers[0]);
      }
    },

    /**
     * Load Vue viewer
     * @param {String} component
     */
    loadVueViewer: function (component) {
      this.cmpViewer = component;
    },

    isTimeseriesPackageUnprocessed: function (pkg) {
      const isTimeseriesFile = pathOr('unknown', ['content', 'packageType'], pkg).toLowerCase() === 'timeseries'
      const isUnprocessed = pathOr('unknown', ['content', 'state'], pkg).toLowerCase() === "uploaded"
      return (isTimeseriesFile && isUnprocessed)
    }
  },
};
</script>

<style lang="scss" scoped>
@use "../../../styles/theme";

.viewer-selector {
  margin: 4px;
  padding: 4px;
  text-align: center;
  vertical-align: center;
  font-weight: 500;
  color: $purple_3;
  border: 1px solid $gray_4;
  background: $purple_tint;
  height: 32px;
  min-width: 120px;
  align-content: center;
  cursor: pointer;
}

.viewer-pane,
.viewer-wrap {
  background: theme.$gray_1;
  display: flex;
  flex: 1;
  flex-direction: column;
  position: relative;
}

.viewer-btn-wrapper {
  margin: 8px;
  display: flex;
  flex-direction: row;
}

.icon-wrapper{
  display: flex;
  margin-right: 4px;
}
</style>
