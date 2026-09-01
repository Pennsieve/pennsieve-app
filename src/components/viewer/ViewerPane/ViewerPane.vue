<template>
  <div class="viewer-pane" v-if="cmpViewer">
    <div
      v-if="showConversionHint"
      class="viewer-info"
    >
      Find out more about processing an image for previewing
      <a
        href="https://docs.pennsieve.io/page/running-a-file-conversion-workflow-in-pennsieve"
        target="_blank"
      >here</a>.
    </div>
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
    <div
      v-if="omeTiffSlowWarning && cmpViewer === 'OmeViewer'"
      class="viewer-warning"
    >
      This TIFF has interleaved channels and may be very slow to load.
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
    <ThumbnailViewer
      v-else-if="cmpViewer === 'ThumbnailViewer'"
      ref="viewer"
      :asset="thumbnailAsset"
    />
    <CSVViewer
      v-else-if="cmpViewer === 'CSVViewer'"
      ref="viewer"
      :pkg="pkg"
      :api-url="apiUrl"
      :file-type="pkg.content?.packageType"
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
import {
  TSViewer,
  TIMESERIES_ZARR,
  TIMESERIES_WEBSOCKET,
} from "@pennsieve-viz/tsviewer";
import "@pennsieve-viz/tsviewer/style.css";
import * as siteConfig from "@/site-config/site.json";
import {
  VIEWER_INSTANCE_ID,
  initViewerStore,
  cleanupViewerStore,
} from "@/composables/useViewerInstance";
import { useViewerAssets } from "@/composables/useViewerAssets";

import "@pennsieve-viz/micro-ct/style.css";
import "@pennsieve-viz/core/style.css";

export default {
  name: "ViewerPane",

  components: {
    BfButton,
    NeuroglancerViewer,
    SlideViewer: defineAsyncComponent(() =>
      import("../../viewers/SlideViewer/SlideViewer.vue"),
    ),
    ImageViewer: defineAsyncComponent(() =>
      import("../../viewers/ImageViewer.vue"),
    ),
    PDFViewer: defineAsyncComponent(() =>
      import("../../viewers/PDFViewer.vue"),
    ),
    TextViewer: defineAsyncComponent(() =>
      import("../../viewers/TextViewer.vue"),
    ),
    UnknownViewer: defineAsyncComponent(() =>
      import("../../viewers/UnknownViewer.vue"),
    ),
    VideoViewer: defineAsyncComponent(() =>
      import("../../viewers/VideoViewer.vue"),
    ),
    TimeseriesViewer: TSViewer,
    XLSViewer: defineAsyncComponent(() =>
      import("../../viewers/XLSViewer.vue"),
    ),
    UMAPViewer: defineAsyncComponent(() =>
      import("../../viewers/UmapViewer/wrapper.vue"),
    ),
    DataExplorer: defineAsyncComponent(() =>
      import("../../viewers/DuckDBExplorer/DuckDBViewerWrapper.vue"),
    ),
    CSVViewer: defineAsyncComponent(() =>
      import("@pennsieve-viz/core").then((m) => m.CSVViewer),
    ),
    LayViewer: defineAsyncComponent(() =>
      import("../../viewers/LayViewer.vue"),
    ),
    OmeViewer: defineAsyncComponent(() =>
      import("@pennsieve-viz/micro-ct").then((m) => m.OmeViewer),
    ),
    ThumbnailViewer: defineAsyncComponent(() =>
      import("../../viewers/ThumbnailViewer.vue"),
    ),
  },

  mixins: [FileTypeMapper, GetFileProperty, ImportHref],

  setup() {
    const { fetchViewerAssets: fetchPackageViewerAssets } = useViewerAssets();
    return { fetchPackageViewerAssets };
  },

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
      thumbnailAsset: null,
      timeseriesAsset: null,
      isLoading: false,
      omeTiffSource: "",
      omeTiffSlowWarning: false,
      apiUrl: siteConfig.apiUrl,
      viewerInstanceId: VIEWER_INSTANCE_ID,
    };
  },

  computed: {
    showConversionHint() {
      return this.isNifti(this.pkg) || this.isOMETiff(this.pkg)
    },
  },

  watch: {
    "pkg.content.id": {
      handler: async function (packageId) {
        if (!packageId) {
          return;
        }
        const pkg = this.pkg;
        await this.loadViewer(pkg);
        // Activate on packageType as before, and additionally whenever loadViewer resolved a
        // timeseries viewer asset: a Zarr bundle's package need not carry packageType
        // Timeseries, and without this such a package mounts the viewer but never feeds it.
        const isTimeseriesPackage =
          pathOr("", ["content", "packageType"], pkg).toLowerCase() ===
          "timeseries";
        if (isTimeseriesPackage || this.timeseriesAsset) {
          await this.fetchTimeseriesData();
        }
      },
      immediate: true,
    },
  },

  methods: {
    ...mapActions("viewerModule", [
      "fetchViewerAssets",
      "fetchViewerAssetById",
      "fetchFileUrl",
      "fetchSourceFiles",
    ]),

    /**
     * Builds the URL a viewer asset's bytes are read from.
     *
     * `asset_url` is a directory prefix that already ends in `/`, and one CloudFront policy
     * covers every object beneath it, so the signature goes on the prefix and the reader
     * appends its own keys. Returns the bare prefix when no policy came back (a public
     * bucket, or signing unavailable), and null when there is nothing to read at all.
     */
    signedAssetUrl: function (asset) {
      const url = asset?.asset_url;
      if (!url) return null;

      const cf = asset?.cloudfront;
      if (!cf?.policy || !cf?.signature || !cf?.key_pair_id) return url;

      const qs = new URLSearchParams({
        Policy: cf.policy,
        Signature: cf.signature,
        "Key-Pair-Id": cf.key_pair_id,
      });
      return `${url}?${qs.toString()}`;
    },

    /**
     * Returns a callback the viewer calls to re-sign a bundle whose policy has expired.
     *
     * CloudFront policies last an hour and a viewing session outlives that. The ids are taken
     * as arguments rather than read off `this`, so the callback stays pinned to the asset it
     * was created for even after the user navigates to another package.
     */
    buildUrlRefresher: function (datasetId, assetId) {
      return async () => {
        const result = await this.fetchViewerAssetById({ datasetId, assetId });
        // fetchViewerAssetById swallows failures and resolves null, so this has to throw
        // rather than hand back an unusable value.
        const url = this.signedAssetUrl({
          ...result?.asset,
          cloudfront: result?.cloudfront,
        });
        if (!url) {
          throw new Error(`Could not re-sign viewer asset ${assetId}`);
        }
        return url;
      };
    },

    /**
     * Called when component is mounted
     */
    fetchTimeseriesData: async function () {
      this.isLoading = true;
      // Initialize the viewer store with the shared instance ID
      const viewerStore = initViewerStore(this.viewerInstanceId);

      const viewerConfig = {
        timeseriesDiscoverApi: siteConfig.timeSeriesUrl,
        apiUrl: siteConfig.apiUrl,
        timeSeriesApi: siteConfig.timeSeriesApi,
      };
      viewerStore.setViewerConfig(viewerConfig);

      try {
        const asset = this.timeseriesAsset;
        const viewerAssetId = asset?.id || null;
        const packageId = this.pkg?.content?.id || null;
        const datasetId = this.pkg?.content?.datasetNodeId || null;
        if (!viewerAssetId && !packageId) return;

        // The viewer asset's type picks the data path: a Zarr bundle is read straight from
        // CloudFront in the browser, anything else streams over the discovery WebSocket.
        const bundleUrl =
          asset?.asset_type === TIMESERIES_ZARR
            ? this.signedAssetUrl(asset)
            : null;

        if (asset?.asset_type === TIMESERIES_ZARR && !bundleUrl) {
          // Claiming the Zarr path without a URL would make the viewer throw. Degrade
          // instead, which is what an unrecognized asset type does anyway.
          console.warn(
            `Viewer asset ${viewerAssetId} is ${TIMESERIES_ZARR} but exposes no URL to read; using the streaming service instead.`,
          );
        }

        const payload = {
          viewerAssetId,
          packageId,
          assetType: bundleUrl ? TIMESERIES_ZARR : TIMESERIES_WEBSOCKET,
        };
        if (bundleUrl) {
          payload.url = bundleUrl;
          if (datasetId && viewerAssetId) {
            payload.onUrlExpired = this.buildUrlRefresher(
              datasetId,
              viewerAssetId,
            );
          }
        }

        return await viewerStore.fetchAndSetActiveViewer(payload);
      } catch (err) {
        // Both paths can reject (a failed bundle open, a failed discovery socket). Swallow
        // it here so the watcher that calls this cannot raise an unhandled rejection.
        console.error("Failed to activate the timeseries viewer:", err);
        return null;
      } finally {
        this.isLoading = false;
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
      if (viewer.startsWith("NeuroglancerViewer:")) {
        const idx = parseInt(viewer.split(":")[1]);
        const asset = this.viewerAssets[idx];
        return asset?.name || `Neuroglancer ${idx + 1}`;
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
        case "ThumbnailViewer":
          return "Thumbnail";
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

      let viewers = this.checkViewerType(activeViewer) || ['UnknownViewer'];

      // A ready Zarr bundle makes the package viewable regardless of the legacy
      // package state; set below once the asset listing comes back.
      let hasReadyZarrTimeseries = false;

      // Check for neuroglancer-compatible viewer assets (ome-zarr, etc.)
      const pkgId = pathOr("", ["content", "id"], activeViewer);
      const datasetId = pathOr("", ["content", "datasetNodeId"], activeViewer);
      this.viewerAssets = [];
      this.thumbnailAsset = null;
      this.timeseriesAsset = null;
      if (pkgId && datasetId) {
        try {
          const result = await this.fetchPackageViewerAssets(
            datasetId,
            pkgId
          );
          if (result?.assets?.length > 0) {
            // A package can carry both a legacy streaming asset and a newer Zarr bundle.
            // The listing comes back ordered by created_at DESC, so choose by explicit
            // precedence rather than by position: the bundle wins when it is ready to read.
            // `cloudfront` rides along so the URL can be signed at activation time.
            // Only the bundle is status-gated — an unready bundle has no bytes to read,
            // whereas the legacy asset is just an identifier for the streaming service and
            // has never been filtered on status here.
            const zarrAsset = result.assets.find(
              (a) => a.asset_type === TIMESERIES_ZARR && a.status === "ready",
            );
            const legacyAsset = result.assets.find(
              (a) => a.asset_type === TIMESERIES_WEBSOCKET,
            );
            const tsAsset = zarrAsset || legacyAsset || null;
            this.timeseriesAsset = tsAsset
              ? { ...tsAsset, cloudfront: result.cloudfront }
              : null;

            if (zarrAsset) {
              hasReadyZarrTimeseries = true;
              if (!viewers.includes("TimeseriesViewer")) {
                viewers = [
                  "TimeseriesViewer",
                  ...viewers.filter((v) => v !== "UnknownViewer"),
                ];
              }
            }

            const neuroglancerTypes = ["ome-zarr", "neuroglancer-precomputed"];
            const seen = new Set();
            const ngAssets = result.assets.filter((a) => {
              if (
                !neuroglancerTypes.includes(a.asset_type) ||
                a.status !== "ready"
              )
                return false;
              if (seen.has(a.asset_url)) return false;
              seen.add(a.asset_url);
              return true;
            });
            if (ngAssets.length > 0) {
              this.viewerAssets = ngAssets.map((a) => ({
                ...a,
                cloudfront: result.cloudfront,
              }));
              const ngViewerNames = ngAssets.map(
                (a, i) => `NeuroglancerViewer:${i}`,
              );
              const filtered = viewers.filter((v) => v !== "UnknownViewer");
              viewers = [...ngViewerNames, ...filtered];
            }

            // Check for thumbnail asset
            const thumbAsset = result.assets.find(
              (a) => a.asset_type === "thumb" && a.status === "ready",
            );
            if (thumbAsset) {
              this.thumbnailAsset = { ...thumbAsset, cloudfront: result.cloudfront };
              viewers = [...viewers.filter((v) => v !== "UnknownViewer"), "ThumbnailViewer"];
            }
          }
        } catch (err) {
          // Viewer assets not available — fall through to default viewer
        }
      }

      // Warn when an OME-TIFF has interleaved channels (processed into
      // zarr for Neuroglancer) — the raw TIFF will be slow to render.
      const hasNgViewers = viewers.some((v) =>
        v.startsWith("NeuroglancerViewer:"),
      );
      this.omeTiffSlowWarning = this.isOMETiff(activeViewer) && hasNgViewers;

      this.availableViewers = viewers;

      // `state` is only a signal about the legacy processing pipeline: a package
      // with a ready Zarr bundle is viewable whether or not it ever ran.
      if (
        this.isTimeseriesPackageUnprocessed(activeViewer) &&
        !hasReadyZarrTimeseries &&
        !this.isLayFile(activeViewer)
      ) {
        this.loadVueViewer("UnknownViewer");
      } else {
        const viewerToLoad = this.availableViewers[0];

        // Fetch presigned URL for OmeViewer from the original source
        // files — not /view which returns processed zarr chunks.
        if (viewers.includes("OmeViewer")) {
          try {
            const sourceFiles = await this.fetchSourceFiles(pkgId);

            if (sourceFiles && sourceFiles.length > 0) {
              const fileId = pathOr("", ["content", "id"], sourceFiles[0]);
              this.omeTiffSource = await this.fetchFileUrl({
                packageId: pkgId,
                fileId,
              });
            }
          } catch (err) {
            console.error("Failed to fetch source file URL:", err);
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
  min-width: 0;
  overflow: auto;
}

.viewer-info {
  background: #e8f4fd;
  border: 1px solid #b8daff;
  border-radius: 4px;
  color: #004085;
  font-size: 13px;
  margin: 8px 8px 0;
  padding: 8px 12px;

  a {
    color: #004085;
    font-weight: 500;
    text-decoration: underline;
  }
}

.viewer-warning {
  background: #fef3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  color: #856404;
  font-size: 12px;
  margin: 0 8px;
  padding: 6px 12px;
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
