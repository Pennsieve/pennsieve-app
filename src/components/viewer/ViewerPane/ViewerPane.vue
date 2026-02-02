<template>
  <div class="viewer-pane" v-if="cmpViewer">
    <div class="viewer-btn-wrapper" v-if="availableViewers.length > 1">
      <div v-for="viewer in availableViewers">
        <tag-pill
          :class="[
            viewer === this.cmpViewer
              ? 'active viewer-selector'
              : 'viewer-selector',
          ]"
          :indicator-color="viewer === this.cmpViewer ? '#F9A23A' : '#CCCCCC'"
          :has-indicator="false"
          :label="viewerNameMapper(viewer)"
          @click="selectViewer(viewer)"
        >
          <template #prefix>
            <div class="icon-wrapper">
              <icon-analysis />
            </div>
          </template>
        </tag-pill>
      </div>
    </div>
    <OmeViewer
      v-if="cmpViewer === 'OmeViewer'"
      ref="viewer"
      :source="omeTiffSource"
      source-type="ome-tiff"
    />
    <component
      v-else
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
import { propOr, pathOr } from "ramda";
import { defineAsyncComponent } from "vue";
import { mapActions } from "vuex";

import ImportHref from "../../../mixins/import-href";
import FileTypeMapper from "../../../mixins/FileTypeMapper";
import GetFileProperty from "../../../mixins/get-file-property";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import TagPill from "@/components/shared/TagPill/TagPill.vue";
import IconAnalysis from "@/components/icons/IconAnalysis.vue";
import { useViewerStore as useLibraryViewerStore, TSViewer } from '@pennsieve-viz/tsviewer'
import '@pennsieve-viz/tsviewer/style.css'
import * as siteConfig from '@/site-config/site.json'

import "@pennsieve-viz/micro-ct/style.css";

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
    TimeseriesViewer: TSViewer,
    XLSViewer: defineAsyncComponent(() =>
      import("../../viewers/XLSViewer.vue")
    ),
    UMAPViewer: defineAsyncComponent(() =>
      import("../../viewers/UmapViewer/wrapper.vue")
    ),
    NiiViewer: defineAsyncComponent(() =>
      import("../../viewers/NiiViewer/NiiViewerWrapper.vue")
    ),
    DataExplorer: defineAsyncComponent(() =>
      import("../../viewers/DuckDBExplorer/DuckDBViewerWrapper.vue")
    ),
    CSVViewer: defineAsyncComponent(() =>
      import("../../viewers/CSVViewer/CSVViewerWrapper.vue")
    ),
    OmeViewer: defineAsyncComponent(()=>
    import("@pennsieve-viz/micro-ct").then(m => m.OmeViewer)
    )
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
    },
  },

  data: function () {
    return {
      cmpViewer: "",
      availableViewers: [],
      isLoading: false,
      omeTiffSource: "",
    };
  },

mounted(){
    this.fetchTimeseriesData();
    this.isLoading = false
  },

  watch: {
    pkg: {
      handler: function (pkg) {
        if (Object.keys(pkg).length > 0) {
          this.loadViewer(pkg);
        }
      },
      immediate: true,
    },
  },

  methods: {
    ...mapActions('viewerModule', ['fetchViewerAssets', 'fetchFileUrl']),

    /**
     * Called when component is mounted
     */
    fetchTimeseriesData: async function () {
      this.isLoading = true;
      const viewerStore = useLibraryViewerStore()
      const viewerConfig = {
        timeseriesDiscoverApi: siteConfig.timeSeriesUrl,
        apiUrl: siteConfig.apiUrl,
        timeSeriesApi: siteConfig.timeSeriesApi,
      };
      viewerStore.setViewerConfig(viewerConfig)

      return await viewerStore.fetchAndSetActiveViewer({
        packageId: this.pkg?.content?.id,
      })
    },

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
      switch (viewer) {
        case "DataExplorer":
          return "Data Explorer";
        case "CSVViewer":
          return "CSV Viewer";
        default:
          return viewer;
      }
    },

    selectViewer: function (evt) {
      this.cmpViewer = evt;
    },

    /**
     * loads appropriate viewer based on package type
     */
    loadViewer: async function (activeViewer) {
      // Reset viewers
      this.cmpViewer = "";
      this.omeTiffSource = "";
      const viewerWrap = this.$refs.viewerWrap;
      if (viewerWrap) {
        viewerWrap.innerHTML = "";
      }

      this.availableViewers = this.checkViewerType(activeViewer);

      if (this.isTimeseriesPackageUnprocessed(activeViewer)) {
        this.loadVueViewer("UnknownViewer");
      } else {
        const viewerToLoad = this.availableViewers[0];

        // Handle viewer source - fetch presigned URL
        // use this when migrating instead of a wrapper for every component
        if (viewerToLoad === 'OmeViewer') {
          try {
            const pkgId = pathOr('', ['content', 'id'], activeViewer);
            const viewerAssets = await this.fetchViewerAssets(pkgId);

            if (viewerAssets && viewerAssets.length > 0) {
              const fileId = pathOr('', ['content', 'id'], viewerAssets[0]);
              this.omeTiffSource = await this.fetchFileUrl({ packageId: pkgId, fileId });
            }
          } catch (err) {
            console.error('Failed to fetch file URL:', err);
          }
        }

        this.loadVueViewer(viewerToLoad);
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
      const isTimeseriesFile =
        pathOr("unknown", ["content", "packageType"], pkg).toLowerCase() ===
        "timeseries";
      const isUnprocessed =
        pathOr("unknown", ["content", "state"], pkg).toLowerCase() ===
        "uploaded";
      return isTimeseriesFile && isUnprocessed;
    },
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
  color: theme.$purple_3;
  border: 1px solid theme.$gray_4;
  background: theme.$purple_tint;
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

.icon-wrapper {
  display: flex;
  margin-right: 4px;
}
</style>
