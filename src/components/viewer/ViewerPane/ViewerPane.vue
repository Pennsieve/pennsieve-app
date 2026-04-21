<template>
  <div class="viewer-pane" v-if="cmpViewer">
    <div class="viewer-btn-wrapper" v-if="availableViewers.length > 1">
      <button
        v-for="viewer in availableViewers"
        :key="viewer"
        class="viewer-tab-btn"
        :class="{ active: viewer === cmpViewer }"
        @click="selectViewer(viewer)"
      >
        {{ viewerNameMapper(viewer) }}
      </button>
    </div>
    <OmeViewer
      v-if="cmpViewer === 'OmeViewer'"
      ref="viewer"
      :source="omeTiffSource"
      source-type="ome-tiff"
    />
    <NeuroglancerViewer
      v-else-if="cmpViewer.startsWith('NeuroglancerViewer:')"
      ref="viewer"
      :pkg="pkg"
      :asset="viewerAssets[parseInt(cmpViewer.split(':')[1])]"
    />
    <component
      v-else
      :is="cmpViewer"
      :is-preview="isPreview"
      ref="viewer"
      :idx="0"
      :pkg="pkg"
      :side-panel-open="sidePanelOpen"
      :instance-id="viewerInstanceId"
    />
  </div>
</template>

<script>
import { propOr, pathOr } from "ramda";
import { defineAsyncComponent, watch } from "vue";
import { mapActions } from "vuex";
import { storeToRefs } from "pinia";

import ImportHref from "../../../mixins/import-href";
import FileTypeMapper from "../../../mixins/FileTypeMapper";
import GetFileProperty from "../../../mixins/get-file-property";
import NeuroglancerViewer from "../../viewers/NeuroglancerViewer.vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import { TSViewer } from '@pennsieve-viz/tsviewer'
import '@pennsieve-viz/tsviewer/style.css'
import * as siteConfig from '@/site-config/site.json'
import {
  VIEWER_INSTANCE_ID,
  initViewerStore,
  cleanupViewerStore,
  useViewerInstance
} from '@/composables/useViewerInstance'

import "@pennsieve-viz/micro-ct/style.css";
import "@pennsieve-viz/core/style.css";

export default {
  name: "ViewerPane",

  components: {
    BfButton,
    NeuroglancerViewer,
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
    LayViewer: defineAsyncComponent(() =>
      import("../../viewers/LayViewer.vue")
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
      viewerAssets: [],
      timeseriesAsset: null,
      isLoading: false,
      omeTiffSource: "",
      viewerInstanceId: VIEWER_INSTANCE_ID,
    };
  },

  watch: {
    pkg: {
      handler: async function (pkg) {
        if (pkg && Object.keys(pkg.content || {}).length > 0) {
          await this.loadViewer(pkg);
          this.fetchTimeseriesData();
        }
      },
      immediate: true,
      deep: true,
    },
  },

  methods: {
    ...mapActions('viewerModule', ['fetchViewerAssets', 'fetchFileUrl', 'fetchPackageViewerAssets']),

    /**
     * Called when component is mounted
     */
    fetchTimeseriesData: async function () {
      this.isLoading = true;
      // Initialize the viewer store with the shared instance ID
      const viewerStore = initViewerStore(this.viewerInstanceId)
      const viewerControls = useViewerInstance(this.viewerInstanceId)

      const viewerConfig = {
        timeseriesDiscoverApi: siteConfig.timeSeriesUrl,
        apiUrl: siteConfig.apiUrl,
        timeSeriesApi: siteConfig.timeSeriesApi,
      };
      viewerStore.setViewerConfig(viewerConfig)

      try {
        const viewerAssetId = this.timeseriesAsset?.id || null
        const packageId = this.pkg?.content?.id || null
        if (!viewerAssetId && !packageId) return
        const result = await viewerStore.fetchAndSetActiveViewer({ viewerAssetId, packageId })
        return result
      } finally {
        this.isLoading = false
      }
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
      if (viewer.startsWith('NeuroglancerViewer:')) {
        const idx = parseInt(viewer.split(':')[1])
        const asset = this.viewerAssets[idx]
        return asset?.name || `Neuroglancer ${idx + 1}`
      }
      switch (viewer) {
        case "DataExplorer":
          return "Data Explorer";
        case "CSVViewer":
          return "CSV Viewer";
        case "LayViewer":
          return ".Lay Viewer";
        case "TextViewer":
          return "Raw Text";
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

      let viewers = this.checkViewerType(activeViewer);

      // Check for neuroglancer-compatible viewer assets (ome-zarr, etc.)
      const pkgId = pathOr('', ['content', 'id'], activeViewer);
      const datasetId = pathOr('', ['content', 'datasetNodeId'], activeViewer);
      this.viewerAssets = [];
      this.timeseriesAsset = null;
      if (pkgId && datasetId) {
        try {
          const result = await this.fetchPackageViewerAssets({ datasetId, packageId: pkgId });
          if (result?.assets?.length > 0) {
            this.timeseriesAsset = result.assets.find(a => a.asset_type === 'timeseries') || null
            const neuroglancerTypes = ['ome-zarr', 'neuroglancer-precomputed']
            const seen = new Set()
            const ngAssets = result.assets.filter(a => {
              if (!neuroglancerTypes.includes(a.asset_type) || a.status !== 'ready') return false
              if (seen.has(a.asset_url)) return false
              seen.add(a.asset_url)
              return true
            })
            if (ngAssets.length > 0) {
              this.viewerAssets = ngAssets.map(a => ({
                ...a,
                cloudfront: result.cloudfront,
              }))
              const ngViewerNames = ngAssets.map((a, i) =>
                `NeuroglancerViewer:${i}`
              )
              const filtered = viewers.filter(v => v !== 'UnknownViewer')
              viewers = [...ngViewerNames, ...filtered]
            }
          }
        } catch (err) {
          // Viewer assets not available — fall through to default viewer
        }
      }

      this.availableViewers = viewers;

      if (this.isTimeseriesPackageUnprocessed(activeViewer) && !this.isLayFile(activeViewer)) {
        this.loadVueViewer("UnknownViewer");
      } else {
        const viewerToLoad = this.availableViewers[0];

        // Handle viewer source - fetch presigned URL
        // use this when migrating instead of a wrapper for every component
        if (viewerToLoad === 'OmeViewer') {
          try {
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

  beforeUnmount() {
    // Clean up the viewer store when the component is destroyed
    cleanupViewerStore(this.viewerInstanceId);
  },
};
</script>

<style lang="scss" scoped>
@use "../../../styles/theme";

.viewer-pane,
.viewer-wrap {
  background: theme.$gray_1;
  display: flex;
  flex: 1;
  flex-direction: column;
  position: relative;
}

.viewer-btn-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
}

.viewer-tab-btn {
  padding: 4px 16px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: white;
  color: theme.$gray_5;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1.4;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_1;
  }

  &.active {
    background: theme.$purple_1;
    border-color: theme.$purple_1;
    color: white;
  }
}
</style>
