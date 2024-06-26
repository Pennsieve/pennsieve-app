<template>
  <div class="viewer-pane" v-if="cmpViewer">
    <component
      :is="cmpViewer"
      :isPreview="isPreview"
      ref="viewer"
      :idx="0"
      :pkg="pkg"
    />
  </div>
</template>

<script>
import { propOr, pathOr, path, isNil } from "ramda";
import { defineAsyncComponent } from "vue";

import ImportHref from "../../../mixins/import-href";
import FileTypeMapper from "../../../mixins/FileTypeMapper";
import GetFileProperty from "../../../mixins/get-file-property";

export default {
  name: "ViewerPane",

  components: {
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
    CSVViewer: defineAsyncComponent(() =>
      import("../../viewers/CSVViewer.vue")
    ),
    XLSViewer: defineAsyncComponent(() =>
      import("../../viewers/XLSViewer.vue")
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
  },

  data: function () {
    return {
      cmpViewer: "",
    };
  },

  watch: {
    pkg: {
      handler: function (pkg) {
        if (Object.keys(pkg).length > 0) {
          this.loadViewer();
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

    /**
     * loads appropriate viewer based on package type
     */
    loadViewer: function () {
      // Reset viewers
      this.cmpViewer = "";
      const viewerWrap = this.$refs.viewerWrap;
      if (viewerWrap) {
        viewerWrap.innerHTML = "";
      }

      const viewerType = this.checkViewerType(this.pkg);
      this.loadVueViewer(viewerType);
    },

    /**
     * Load Vue viewer
     * @param {String} component
     */
    loadVueViewer: function (component) {
      this.cmpViewer = component;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../../../assets/variables.scss";

.viewer-pane,
.viewer-wrap {
  background: $gray_1;
  display: flex;
  flex: 1;
  flex-direction: column;
  position: relative;
}
</style>
