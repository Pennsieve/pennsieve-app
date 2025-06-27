<template>
  <div
    id="ts_viewer"
    ref="ts_viewer"
    :class="[ isPreview ? 'timeseries-viewer preview' : 'timeseries-viewer' ]"
  >
    <TimeseriesScrubber
      ref="scrubber"
      :ts_start="ts_start"
      :ts_end="ts_end"
      :c-width="cWidth"
      :label-width="labelWidth"
      :cursor-loc="cursorLoc"
      :start="start"
      :duration="duration"
      :constants="constants"
      @setStart="updateStart"
    />

    <div id="channelCanvas">
      <!--       Channel labels-->
      <div
        id="channelLabels"
        ref="channelLabels"
      >
        <div
          v-for="item in viewerChannels"
          :key="item.displayName"
        >
          <div
            v-if="item.visible"
            class="chLabelWrap"
            :data-id="item.id"
            @tap="onLabelTap"
          >
            <div class="labelDiv">
              {{ item.displayName }}
            </div>
            <div
              class="chLabelIndWrap"
              :hidden="hideLabelInfo"
              :class="[ item.selected? 'selected': '']"
            >
              <div
                class="chLabelInd"
                :hidden="hideLabelInfo"
              >
                {{ _computeLabelInfo(item, globalZoomMult, item.rowScale) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!--       Timeseries viewport-->
      <TimeseriesViewerCanvas
        ref="viewerCanvas"
        :window_height="window_height"
        :window_width="window_width"
        :duration="duration"
        :start="start"
        :c-width="cWidth"
        :c-height="cHeight"
        :constants="constants"
        :ts-start="ts_start"
        :ts-end="ts_end"
        :cursor-loc="cursorLoc"
        :global-zoom-mult="globalZoomMult"
        :active-viewer="activeViewer"
        :config="config"
        @setStart="updateStart"
        @setCursor="setCursor"
        @setGlobalZoom="setGlobalZoom"
        @setDuration="setDuration"
        @channelsInitialized="onChannelsInitialized"
        @annLayersInitialized="onAnnLayersInitialized"
        @closeAnnotationLayerWindow="onCloseAnnotationLayerWindow"
        @addAnnotation="onOpenAnnotationWindow"
        @updateAnnotation="onUpdateAnnotation"
      />
    </div>

    <TimeseriesViewerToolbar
      v-if="!isPreview"
      :constants="constants"
      :duration="duration"
      :start="start"
      @pageBack="onPageBack"
      @pageForward="onPageForward"
      @incrementZoom="onIncrementZoom"
      @decrementZoom="onDecrementZoom"
      @updateDuration="onUpdateDuration"
      @nextAnnotation="onNextAnnotation"
      @previousAnnotation="onPreviousAnnotation"
      @setStart="updateStart"
    />

    <TimeseriesFilterModal
      ref="filterWindow"
      :visible="filterWindowOpen"
      @update:visible="filterWindowOpen = $event"
      @closeWindow="onCloseFilterWindow"
    />

    <TimeseriesAnnotationModal
      ref="annotationModal"
      :visible="annotationWindowOpen"
      @update:visible="annotationWindowOpen = $event"
      @closeWindow="onCloseAnnotationWindow"
      @createUpdateAnnotation="onCreateUpdateAnnotation"
    />

    <TsAnnotationDeleteDialog
      :visible="isTsAnnotationDeleteDialogVisible"
      :delete-annotation="annotationDelete"
      @update:visible="isTsAnnotationDeleteDialogVisible = $event"
      @delete="deleteAnnotation"
    />

  </div>
</template>

<script setup>
import {
  ref,
  reactive,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
  defineAsyncComponent
} from 'vue'
import { useStore } from 'vuex'
import { storeToRefs } from 'pinia'
import {
  propOr,
  isEmpty
} from 'ramda'

import { useViewerStore } from "@/stores/tsviewer"
import { useTsAnnotation } from "@/composables/useTsAnnotation"

// Component imports (required for <script setup>)
const TimeseriesScrubber = defineAsyncComponent(() => import('@/components/viewers/TSViewer/TSScrubber.vue'))
const TimeseriesViewerCanvas = defineAsyncComponent(() => import('@/components/viewers/TSViewer/TSViewerCanvas.vue'))
const TimeseriesViewerToolbar = defineAsyncComponent(() => import('@/components/viewers/TSViewer/TSViewerToolbar.vue'))
const TimeseriesFilterModal = defineAsyncComponent(() => import('@/components/viewers/TSViewer/TSFilterModal.vue'))
const TimeseriesAnnotationModal = defineAsyncComponent(() => import('@/components/viewers/TSViewer/TSAnnotationModal.vue'))
const TsAnnotationDeleteDialog = defineAsyncComponent(() => import('@/components/viewers/TSViewer/TSAnnotationDeleteDialog/TsAnnotationDeleteDialog.vue'))

// Define props
const props = defineProps({
  isPreview: {
    type: Boolean,
    default: false
  }
})

// Store setup
const store = useStore()
const viewerStore = useViewerStore()
const { viewerChannels } = storeToRefs(viewerStore)

// TsAnnotation composable setup
const {
  addAnnotation,
  updateAnnotation,
  removeAnnotation,
  getChannelId: getChannelIdFromAnnotation,
} = useTsAnnotation()

// Template refs
const ts_viewer = ref(null)
const scrubber = ref(null)
const channelLabels = ref(null)
const viewerCanvas = ref(null)
const filterWindow = ref(null)
const annotationModal = ref(null)

// Reactive data
const constants = reactive({
  TIMEUNIT: 'microSeconds',   // Basis for time
  XOFFSET: 0,                 // X-offset of graph in canvas
  XGRIDSPACING: 1000000,      // Time in microseconds between vertical lines
  NRPXPERLABEL: 150,          // Number of pixels per label on x-axis
  USEREALTIME: true,          // If true than interpret timepoints as UTC microseconds.
  DEFAULTDPI: 96,             // Default pixels per inch
  ANNOTATIONLABELHEIGHT: 20,  // Height of annotation label
  ROUNDDATAPIXELS: false,     // If true, canvas point will be rounded to integer pixels for faster render (faster)
  MINMAXPOLYGON: true,        // If true, then polygon is rendered thru minMax values, otherwise vertical lines (faster)
  PAGESIZEDIVIDER: 0.5,       // Number of pages that span the current canvas.
  PREFETCHPAGES: 3,           // Number of pages to read ahead of view.
  LIMITANNFETCH: 500,         // Maximum number of annotations that are fetched per request
  USEMEDIAN: false,           // Use Median instead of mean for centering channels
  CURSOROFFSET: 5,            // Offset of cursor canvas
  SEGMENTSPAN: 1209600000000, // One week of gap-data is returned per request.
  MAXRECURSION: 20,           // Maximum recursion depth of gap-data requests (max 2 years)
  MAXDURATION: 600000000,     // Maximum duration window (5min)
  INITDURATION: 15000000      // Initial duration window  (15sec)
})

const ts_start = ref(null)
const ts_end = ref(null)
const window_height = ref(0)
const window_width = ref(0)
const start = ref(0)                // Start Timestamp of viewer in microseconds
const duration = ref(0)            // Length of data in viewer in microseconds (ignore gaps)
const cWidth = ref(0)
const cHeight = ref(0)
const labelWidth = ref(0)
const globalZoomMult = ref(1)
const cursorLoc = ref(1/10)
const filterWindowOpen = ref(false)
const annotationWindowOpen = ref(false)
const annotationLayerWindowOpen = ref(false)
const annotationDelete = ref(null)
const isTsAnnotationDeleteDialogVisible = ref(false)

// Computed properties
const activeViewer = computed(() => store.state.viewerModule.activeViewer)
const viewerSidePanelOpen = computed(() => store.state.viewerModule.viewerSidePanelOpen)
const viewerAnnotations = computed(() => store.state.viewerModule.viewerAnnotations)
const viewerMontageScheme = computed(() => store.state.viewerModule.viewerMontageScheme)
const config = computed(() => store.state.config)

const hideLabelInfo = computed(() => {
  let hide = false
  if (cHeight.value / nrVisChannels.value < 30) {
    hide = true
  }
  return hide
})

const nrVisChannels = computed(() => {
  return viewerChannels.value.reduce((accumulator, currentValue) => {
    if (currentValue.visible) {
      return accumulator + 1
    }
    return accumulator
  }, 0)
})

const _cpStyleLabels = computed(() => {
  return (height, nrVisCh) => {
    const h = Math.max(1, Math.min(12, height / nrVisCh - 2))
    return 'font-size:' + h + 'px; height:' + h + 'px'
  }
})

// Methods that need to be defined early (used in watchers)
const onResize = async (event) => {
  console.log('onresize...')
  if (!ts_viewer.value) {
    return
  }

  const element = document.getElementById("ts_viewer")
  if (!element) {
    return
  }

  var style = window.getComputedStyle(element, null)
  const hhh = parseInt(style.getPropertyValue('height'))

  const toolbarOffset = props.isPreview ? 0 : 100

  window_height.value = hhh - toolbarOffset

  await nextTick()
  window_width.value = ts_viewer.value.offsetWidth

  const labelDiv = channelLabels.value
  if (!labelDiv) {
    return
  }

  labelWidth.value = labelDiv.clientWidth
  cWidth.value = (window_width.value - labelDiv.clientWidth - 16)
  cHeight.value = (window_height.value - 40)
}

// Watchers
watch(viewerSidePanelOpen, () => {
  // Only call onResize if component is mounted and elements exist
  if (ts_viewer.value) {
    onResize()
  }
}, { immediate: false }) // Changed from immediate: true to avoid early execution

// Methods
const fetchWorkspaceMontages = async () => {
  return viewerStore.fetchWorkspaceMontages()
}

const openEditAnnotationDialog = (annotation) => {
  store.dispatch('viewerModule/setActiveAnnotation', annotation).then(() => {
    viewerCanvas.value.renderAnnotationCanvas()
    annotationWindowOpen.value = true
  })
}

const onUpdateAnnotation = (annotation) => {
  openEditAnnotationDialog(annotation)
}

const onCreateUpdateAnnotation = async (annotation) => {
  annotationWindowOpen.value = false
  try {
    if (annotation.id) {
      await updateAnnotation()
      onAnnotationUpdated()
    } else {
      await addAnnotation()
      onAnnotationCreated()
    }
  } catch (error) {
    console.error('Error creating/updating annotation:', error)
    // Could emit an error event or show a notification here
  }
}

const onAnnotationUpdated = () => {
  viewerCanvas.value.renderAnnotationCanvas()
}

const onOpenAnnotationWindow = () => {
  annotationWindowOpen.value = true
}

const confirmDeleteAnnotation = (annotation) => {
  annotationDelete.value = annotation
  isTsAnnotationDeleteDialogVisible.value = true
}

const deleteAnnotation = async (annotation) => {
  isTsAnnotationDeleteDialogVisible.value = false
  try {
    await removeAnnotation(annotation)
    onAnnotationDeleted()
  } catch (error) {
    console.error('Error deleting annotation:', error)
    // Could emit an error event or show a notification here
  }
}

const onAnnotationDeleted = () => {
  viewerCanvas.value.renderAnnotationCanvas()
}

const onAddAnnotation = (start, duration, onAll, label, description, layer) => {
  addAnnotation(start, duration, onAll, label, description, layer)
}

const onAnnotationCreated = () => {
  viewerCanvas.value.renderAnnotationCanvas()
}

const onCreateAnnotationLayer = (newLayer) => {
  viewerCanvas.value.createAnnotationLayer(newLayer)
}

const onCloseAnnotationLayerWindow = () => {
  annotationLayerWindowOpen.value = false
}

const onCloseAnnotationWindow = () => {
  viewerCanvas.value.resetFocusedAnnotation()
  viewerCanvas.value.renderAnnotationCanvas()
  annotationWindowOpen.value = false
}

const onCloseFilterWindow = () => {
  filterWindowOpen.value = false
}

const onLabelTap = (e) => {
  e.stopPropagation()
  e.preventDefault()

  const append = e.detail.sourceEvent.metaKey
  selectChannel({ channelId: e.currentTarget.dataset.id, append: append })
  viewerCanvas.value.renderAll()
}

const onNextAnnotation = () => {
  start.value = viewerCanvas.value.getNextAnnotation()
}

const onPreviousAnnotation = () => {
  start.value = viewerCanvas.value.getPreviousAnnotation()
}

const onUpdateDuration = (value) => {
  setDuration(value * 1e6)
}

const onIncrementZoom = () => {
  globalZoomMult.value = globalZoomMult.value * 1.25
}

const onDecrementZoom = () => {
  globalZoomMult.value = globalZoomMult.value * 0.8
}

const onAnnLayersInitialized = () => {
  scrubber.value.getAnnotations()
}

const onChannelsInitialized = () => {
  scrubber.value.initSegmentSpans()

  // Resize the canvas as label length likely changed
  nextTick(() => {
    onResize()
  })
}

const onPageBack = () => {
  console.log('Page forward triggered from toolbar')

  // Calculate new start position (go back by current duration)
  const newStart = Math.max(
    start.value - (3/4) * duration.value,
    ts_start.value
  )

  updateStart(newStart)

  // Trigger re-render
  nextTick(() => {
    viewerCanvas.value?.renderAll()
  })
}

const onPageForward = () => {
  console.log('Page forward triggered from toolbar')

  // Calculate new start position
  const newStart = Math.min(
    start.value + (3/4) * duration.value,
    ts_end.value - duration.value
  )

  console.log(`Moving from ${start.value} to ${newStart}`)

  // Update start position
  updateStart(newStart)

  // Force canvas to invalidate cache and fetch new data
  nextTick(() => {
    if (viewerCanvas.value?.invalidate) {
      viewerCanvas.value.invalidate()
    }
    if (viewerCanvas.value?.renderAll) {
      viewerCanvas.value.renderAll()
    }
  })
}

const selectAnnotation = (payload) => {
  let rsPeriod = viewerCanvas.value.rsPeriod
  updateStart(payload.annotation.start - ((cursorLoc.value * cWidth.value - constants.CURSOROFFSET) * rsPeriod))
}

const selectChannel = (payload) => {
  const _channels = viewerChannels.value.map(channel => {
    const selected = channel.selected

    if (payload.append === false) {
      channel.selected = false
    }

    if (payload.channelId === channel.id) {
      channel.selected = !selected
    }

    return channel
  })

  viewerStore.setChannels(_channels)
}

const selectChannels = (ids, append) => {
  const channels = viewerChannels.value.map(channel => {
    if (append === false) {
      channel.selected = false
    }
    if (channel.id in ids) {
      channel.selected = true
    }
    return channel
  })

  viewerStore.setChannels(channels)
}

const updateStart = (value) => {
  start.value = value
}

const setCursor = (value) => {
  // set the cursor location as a fraction of the width of the canvas
  cursorLoc.value = value
}

const setGlobalZoom = (value) => {
  globalZoomMult.value = value
}

const setDuration = (value) => {
  if (value > constants.MAXDURATION) {
    duration.value = constants.MAXDURATION
  } else {
    duration.value = value
  }
}

const getChannelId = (channel) => {
  // Use the method from the TsAnnotation composable
  return getChannelIdFromAnnotation(channel)
}

const _computeLabelInfo = (item, globalZoomMult, rowscale) => {
  const n = (((constants.DEFAULTDPI * window.devicePixelRatio) / (globalZoomMult * rowscale)) / 25.4).toFixed(1)
  return n + ' ' + item.unit + '/mm'
}

const initChannels = () => {
  const channels = activeViewer.value.channels
  if (channels.length > 0) {
    // Find Global start and end
    ts_start.value = channels[0].content.start
    ts_end.value = channels[0].content.end
    for (let ic = 1; ic < channels.length; ic++) {
      if (channels[ic].content.start < ts_start.value) {
        ts_start.value = channels[ic].content.start
      }
      if (channels[ic].content.end > ts_end.value) {
        ts_end.value = channels[ic].content.end
      }
    }

    start.value = ts_start.value
  }
}

const openLayerWindow = (payload) => {
  // Note: layerModal component not found in template - this might need to be added
  // or this function might be unused
  console.warn('openLayerWindow called but layerModal ref not found in template')
  annotationLayerWindowOpen.value = true
}

const openFilterWindow = (payload) => {
  const channels = propOr([], 'channels', payload)
  const filter = propOr('', 'filter', payload)
  const filterWindowRef = filterWindow.value
  filterWindowRef.onChannels = channels

  if (!isEmpty(filter)) {
    filterWindowRef.input0 = filter.input0
    filterWindowRef.input1 = filter.input1
  } else {
    filterWindowRef.input0 = NaN
    filterWindowRef.input1 = NaN
    filterWindowRef.selectedFilter = null
    filterWindowRef.selectedNotch = null
  }
  filterWindowOpen.value = true
}

const setTimeseriesFilters = (payload) => {
  viewerCanvas.value.setFilters(payload)
}

// Lifecycle hooks
onMounted(() => {
  initChannels()

  const element = document.getElementById("ts_viewer")
  if (!element) {
    console.warn('ts_viewer element not found')
    return
  }

  var style = window.getComputedStyle(element, null)
  const hhh = parseInt(style.getPropertyValue('height'))

  const toolbarOffset = props.isPreview ? 0 : 100

  // Fetch the workspace montages
  fetchWorkspaceMontages()

  window_height.value = hhh - toolbarOffset
  if (ts_viewer.value) {
    window_width.value = ts_viewer.value.offsetWidth
  }
  window.addEventListener('resize', onResize)

  const labelDiv = channelLabels.value
  if (labelDiv) {
    labelWidth.value = labelDiv.clientWidth
    cWidth.value = (window_width.value - labelDiv.clientWidth - 5 - 10)
    cHeight.value = (window_height.value - 88)
  }
  duration.value = constants.INITDURATION
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})

// Expose methods that might be called from parent components
defineExpose({
  openEditAnnotationDialog,
  confirmDeleteAnnotation,
  selectAnnotation,
  selectChannel,
  selectChannels,
  openLayerWindow,
  openFilterWindow,
  setTimeseriesFilters
})
</script>

<style lang="scss" scoped>
@import '../../../assets/_variables.scss';

.timeseries-viewer {
  display: flex;
  height: 100%;
  flex-direction: column;

  &.preview {
    height: 600px;
    border: 2px solid $gray_3;
  }
}

#channelCanvas {
  display: flex;
  background-color: white;
  flex: 1;
}

#channelLabels {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  line-height: normal;
  margin-bottom: 32px;
  min-width: 75px;
}

.chLabelWrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}

.chLabelIndWrap {
  position: relative;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  width: 100%;
  color: #3c54a4;
}

.chLabelInd {
  font-size: 0.6em;
  min-width: 70px;
  color: rgb(150,150,150);
  text-align: right;
  white-space: nowrap;
}

.labelDiv[selected] {
  color:#295eff;
}

.chLabelIndWrap[selected]{
  color:#295eff;
}

.labelDiv {
  align-self: flex-end;
  white-space: nowrap;
  color: var(--neuron);
}
</style>