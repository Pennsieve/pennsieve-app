<template>
  <div class="palette-annotations">
    <div class="annotations-heading">
      <div class="controls">
        <el-tooltip
          placement="top"
          content="Hide all channels"
          :popper-options="{ boundariesElement: 'window' }"
          :open-delay="300"
        >
          <bf-button @click="createLayer">
            <IconPlus
              :height="12"
              :width="12"
            />
            New Layer
          </bf-button>
        </el-tooltip>
      </div>
      <div class="visibility">
        <el-tooltip
          placement="top"
          content="Hide all annotations"
          :popper-options="{ boundariesElement: 'window' }"
          :open-delay="300"
        >
          <button @click="toggleAllGroupsVisibility">
            <IconEyeball
              :height="20"
              :width="20"
            />
          </button>
        </el-tooltip>
      </div>
    </div>

    <div id="annotationWrap">
      <accordion
        v-for="(layer, index) in viewerAnnotations"
        :ref="`accordion-${layer.id}`"
        :key="layer.id"
        :title="layer.name"
        :window-height="windowHeight"
        :selected="layer.selected"
        :nr-layers="viewerAnnotations.length"
        icon="blackfynn:chevron-down-small"
        :border-color="layer.hexColor"
        :layer-id="layer.id"
        :default-open="index === 0"
        @selectItem="onLayerSelected(layer.id)"
      >
        <template #operations>
          <annotation-group
            ref="annotationGroup"
            :hide-title="false"
            :layer="layer"
            :orig-label="layer.name"
            :can-crud-annotation="getPermission('editor')"
          />
        </template>

        <template #items>
          <div >
            <template v-for="annotation in layer.annotations.filter(ann => ann.layer_id === layer.id)">
              <ts-annotation
                v-if="isTimeseriesViewer"
                :ref="`ann-${annotation.id}`"
                :key="annotation.id"
                :annotation="annotation"
              />
              <image-annotation
                v-else
                :id="`ann-${annotation.id}`"
                :key="annotation.id"
                :layer-id="layer.id"
                :annotation="annotation"
                :can-crud-annotation="getPermission('editor')"
                @click="onAnnTap(annotation)"
              />
            </template>
          </div>
        </template>
      </accordion>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { mapActions, mapGetters, mapState } from 'vuex'
import { storeToRefs } from 'pinia'
import { useViewerStore } from '@/stores/tsviewer'
import {
  pathEq,
  propOr,
  head
} from 'ramda'

import EventBus from '../../../../utils/event-bus'
import Sorter from '../../../../mixins/sorter'
import ImportHref from '../../../../mixins/import-href'

import Accordion from '../../../shared/Accordion/Accordion.vue'
import AnnotationGroup from './AnnotationGroup.vue'
import TsAnnotation from './TSAnnotation.vue'
import IconPlus from "../../../icons/IconPlus.vue"
import IconEyeball from "../../../icons/IconEyeball.vue"
import ImageAnnotation from "./ImageAnnotation.vue"
import BfButton from "@/components/shared/bf-button/BfButton.vue";

export default {
  name: 'PaletteAnnotations',

  components: {
    BfButton,
    IconEyeball,
    IconPlus,
    Accordion,
    AnnotationGroup,
    TsAnnotation
  },

  props: {
    windowHeight: {
      type: Number,
      default: 0
    }
  },

  mixins: [
    Sorter,
    ImportHref
  ],

  setup() {
    // Setup Pinia store
    const viewerStore = useViewerStore()
    const { viewerAnnotations } = storeToRefs(viewerStore)

    return {
      viewerStore,
      viewerAnnotations
    }
  },

  data: function() {
    return {
      allVisible: true
    }
  },

  computed: {
    ...mapGetters(['getPermission']),
    // Keep Vuex for activeViewer and activeAnnotation if not yet migrated
    ...mapState('viewerModule', ['activeViewer', 'activeAnnotation']),

    /**
     * Compute sorted layers and annotations
     * @returns {Array}
     */
    sortedLayers: function() {
      const layers = this.viewerAnnotations

      return this.isTimeseriesViewer ?
        this.setLayerSort(layers, 'start', 'start') :
        this.setLayerSort(layers, 'name', 'updatedAt')
    },

    /**
     * Compute if the active viewer is a timeseries viewer
     * @returns {Boolean}
     */
    isTimeseriesViewer: function() {
      return pathEq(['content', 'packageType'], 'TimeSeries', this.activeViewer)
    },

    /**
     * Compute if the package has layers
     * @returns {Boolean}
     */
    hasLayers: function() {
      return this.viewerAnnotations.length > 0
    }
  },

  mounted: function() {
    // bf-annotation
    // this.importHref('/web-components/src/components/blackfynn/palettes/annotations/bf-annotation.html')
  },

  watch: {
    activeAnnotation: function() {
      if (this.activeAnnotation) {
        this.viewAnnotation(this.activeAnnotation.id)
      }
    }
  },

  methods: {
    onLayerSelected: function(layer_id) {
      // Fold all layers except selected one.
      for (let [key, value] of Object.entries(this.$refs)) {
        if (/^accordion/.test(key) && value[0].layerId !== layer_id) {
          value[0].fold()
        }
      }

      // FIX: Use Pinia store instead of Vuex
      this.viewerStore.setActiveAnnotationLayer(layer_id)
    },

    /**
     * View annotation
     * Opens annotation palette, opens the layer for the annotation
     * and scrolls the palette to the annotation
     * @param {Number} id
     */
    viewAnnotation: function(id) {
      // FIX: Use Pinia store getter instead of Vuex
      const annotation = this.viewerStore.getAnnotationById(id)
      const layerId = propOr('', 'layer_id', annotation)

      if (layerId) {
        const layer = head(this.$refs[`accordion-${layerId}`])

        this.onLayerSelected(layerId)
        layer.open = true

        // Select annotation and scroll it into view
        this.$nextTick(() => {
          const annotationEl = this.$refs[`ann-${id}`][0].$el
          if (annotationEl) {
            annotationEl.scrollIntoView()
          }
        })
      }
    },

    /**
     * Callback for annotation click
     * Select the annotation in the viewer
     * @param {Object} annotation
     */
    onAnnTap: function(annotation) {
      const annStart = propOr(null, 'start', annotation)
      EventBus.$emit('active-viewer-action', {
        method: 'onAnnotationSelect',
        payload: annStart
      })
    },

    /**
     * toggles visibility of all groups
     */
    toggleAllGroupsVisibility: function() {
      // check if all layers are all hidden; visible property does not initially exist
      const allHiddenLayers = this.viewerAnnotations.filter(layer => layer.visible === false)
      const allVisibleValue = allHiddenLayers.length === this.viewerAnnotations.length ? true : !this.allVisible

      this.allVisible = allVisibleValue

      const groups = this.$refs.annotationGroup
      groups.forEach(group => group.toggleLayer(this.allVisible))
    },

    /**
     * Set layer and annotation sort
     * @param {Array} list
     * @param {String} sortLayerPath
     * @param {String} sortAnnotationsPath
     * @returns {Array}
     */
    setLayerSort: function(list, sortLayerPath, sortAnnotationsPath) {
      let layers = this.returnSort(sortLayerPath, list, 'desc')
      layers.map(layer => {
        const sortedAnnotations = this.returnSort(sortAnnotationsPath, layer.annotations, 'desc')
        return layer.annotations = sortedAnnotations
      })

      return layers
    },

    /**
     * Open layer window in create state
     */
    createLayer: function(evt) {
      //TODO move to vuex
      EventBus.$emit('active-viewer-action', {
        method: 'openLayerWindow',
        payload: {
          isCreating: true
        }
      })
    },
  }
}
</script>

<style lang="scss" scoped>
@import '../../../../assets/_variables.scss';

.palette-annotations {
  background: #fff;
  display: flex;
  flex-direction: column;
  height: 100%;
}

h3 {
  margin: 15px 0;
}

.annotations-heading {
  align-items: center;
  background: $purple_0_7;
  border-bottom: solid 1px $gray_2;
  display: flex;
  overflow: hidden;
  padding: 8px;

}

.controls {
  flex: 1;
}

.controls .inner {
  width: 100px;
}

.controls .inner:hover {
  cursor: pointer;
}

.visibility {
}

.annotation-control {
  height: 20px;
  width: 20px;
  transition: color .15s linear;
}

.annotation-control:hover {
  cursor: pointer;
}

#annotationWrap {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  position: relative;
}

[slot="title"] {
  flex: 1;
  height: 100%;
}

iron-icon {
  color: #9B9B9B;
}
iron-icon:hover, iron-icon[focused] {
  color: $app-primary-color
}
.all-hidden {
  color: #DADADA;
}
</style>