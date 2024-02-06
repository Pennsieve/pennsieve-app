<template>
  <div class="viewer-pane">
    <component
      :is='cmpViewer'
      ref="viewer"
      :idx="0"
      :pkg="pkg"
    />

  </div>
</template>

<script>
  import { propOr, pathOr, path, isNil } from 'ramda'

  import ImportHref from '../../../mixins/import-href'
  import FileTypeMapper from '../../../mixins/FileTypeMapper'
  import GetFileProperty from '../../../mixins/get-file-property'

  import PDFViewer from '../../viewers/PDFViewer.vue'
  import UnknownViewer from "../../viewers/UnknownViewer.vue";
  import TextViewer from "../../viewers/TextViewer.vue";
  import VideoViewer from "../../viewers/VideoViewer.vue"
  import ImageViewer from "../../viewers/ImageViewer.vue"
  // import DirectoryViewer from "../../viewers/DirectoryViewer.vue";

  export default {
    name: 'ViewerPane',

    components: {
      PDFViewer,
      UnknownViewer,
      TextViewer,
      VideoViewer,
      ImageViewer,
      // DirectoryViewer,
      // 'slide-viewer': () => import('@/components/viewers/SlideViewer/SlideViewer.vue'),
      // 'image-viewer': () => import('@/components/viewers/ImageViewer.vue'),
      // 'pdf-viewer': () => import('../../viewers/PDFViewer/PDFViewer.vue'),
      // 'text-viewer': () => import('@/components/viewers/TextViewer.vue'),
      'unknown-viewer': () => import('../../viewers/UnknownViewer.vue'),
      // 'video-viewer': () => import('@/components/viewers/VideoViewer.vue'),
      // 'timeseries-viewer': () => import('@/components/viewers/TSViewer/TSViewer.vue')
    },

    mixins: [
      FileTypeMapper,
      GetFileProperty,
      ImportHref
    ],

    props: {
      pkg: {
        type: Object,
        default: () => {}
      }
    },

    data: function() {
      return {
        cmpViewer: '',
      }
    },

    watch: {
      pkg: {
        handler: function(pkg) {
          console.log(pkg)
          if (Object.keys(pkg).length > 0 ) {
            this.loadViewer()
          }
        },
        immediate: true
      }
    },

    methods: {
      /**
       * Invoke method on viewer
       * Event emitted from palettes
       * @param {Object} evt
       */
      activeViewerAction: function(evt) {
        const method = propOr('', 'method', evt)
        const payload = propOr('', 'payload', evt)
        const viewer = this.cmpViewer !== '' ?
          this.$refs.viewer :
          this.$el.querySelector('#viewer')
        // Check the method
        if(viewer && typeof viewer[method] === 'function') {
          viewer[method](payload)
        }
      },

      /**
       * loads appropriate viewer based on package type
       */
      loadViewer: function() {
        // Reset viewers
        this.cmpViewer = ''
        const viewerWrap = this.$refs.viewerWrap
        if (viewerWrap) {
          viewerWrap.innerHTML = ''
        }

        const viewerType = this.checkViewerType(this.pkg)
        this.loadVueViewer(viewerType)

      },

      /**
       * Load Vue viewer
       * @param {String} component
       */
      loadVueViewer: function(component) {
        this.cmpViewer = component
      }
    }
  }
</script>

<style lang="scss" scoped>
  @import '../../../assets/variables.scss';

  .viewer-pane, .viewer-wrap {
    background: $gray_1;
    display: flex;
    flex: 1;
    flex-direction: column;
    position: relative;
  }
</style>
