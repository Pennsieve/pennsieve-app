<!-- TimeseriesPlotCanvas.vue -->
<template>
  <div class="timeseries-plot-canvas">
    <canvas
      ref="blurCanvasRef"
      class="canvas"
      :width="canvasWidth"
      :height="canvasHeight"
      :style="canvasStyle">
    </canvas>

    <slot name="axisCanvas"></slot>
    <slot name="annCanvas"></slot>

    <canvas
      ref="plotCanvasRef"
      class="canvas"
      :width="canvasWidth"
      :height="canvasHeight"
      :style="canvasStyle">
    </canvas>
  </div>
</template>

<script setup>
import { computed, watch, onMounted, onUnmounted, reactive, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useViewerStore } from '@/stores/viewerStore'
import { useWebSocket } from '@/composables/useWebSocket'
import { useCanvasRenderer } from '@/composables/useCanvasRenderer'
import { useTimeSeriesData } from '@/composables/useTimeSeriesData'
import { useDataRequests } from '@/composables/useDataRequests'
import { useChannelProcessing } from '@/composables/useChannelProcessing'
import { createThrottle } from '@/utils/throttle'
import {useGetToken} from "@/composables/useGetToken";

// Props (from original)
const props = defineProps({
  cHeight: { type: Number, required: true },
  cWidth: { type: Number, required: true },
  start: { type: Number, required: true },
  duration: { type: Number, required: true },
  constants: { type: Object, required: true },
  rsPeriod: { type: Number, required: true },
  ts_start: { type: Number, required: true },
  ts_end: { type: Number, required: true },
  globalZoomMult: { type: Number, required: true }
})

// Emits (from original)
const emit = defineEmits(['channelsInitialized', 'setGlobalZoom'])

// Pinia Store
const viewerStore = useViewerStore()
const {
  activeViewer,
  viewerChannels,
  viewerMontageScheme,
  workspaceMontages,
  config
} = storeToRefs(viewerStore)


// Base channels computed property
const baseChannels = computed(() => activeViewer.value?.channels || [])

// Initialize composables
const {
  websocket,
  connectionStatus,
  openWebsocket,
  send,
  sendMontageMessage,
  sendFilterMessage,
  disconnect,
  setClearChannelsCallback,
  setPackageId,
  setUseMedian,
  onSegment,
  onEvent,
  onChannelDetails,
  onError
} = useWebSocket()

const {
  plotCanvasRef,
  blurCanvasRef,
  initializeCanvases,
  renderData,
  cpCanvasScaler
} = useCanvasRenderer()

// Define pixelRatio directly in main component to avoid dependency issues
const pixelRatio = ref(1)

const {
  chData,
  requestedPages,
  viewData,
  channelsReady,
  autoScale,
  pageSize,
  initChannels,
  dataCallback,
  invalidate,
  autoScaleViewData,
  segmIndexOf
} = useTimeSeriesData()

const {
  aSyncRequests,
  aSyncPreRequests,
  isPrefetching,
  initializePrefetch,
  generatePoints,
  requestDataFromServer,
  startPrefetching,
  stopPrefetching,
  clearRequests,
  getViewportRequests
} = useDataRequests()

// Initialize channel processing composable with baseChannels
const {
  getChannelId,
  processChannelData,
  createMontagePayload
} = useChannelProcessing(baseChannels, viewerMontageScheme, workspaceMontages)

// Component state
const renderCounter = ref(0)
const lastDataRender = ref(null)

// Computed properties (from original) - moved after composable initialization
const canvasWidth = computed(() => pixelRatio.value * props.cWidth)
const canvasHeight = computed(() => cpCanvasScaler(props.cHeight, pixelRatio.value, 0))
const pHeight = computed(() => props.cHeight - 20)

const canvasStyle = computed(() => ({
  width: props.cWidth + 'px',
  height: pHeight.value + 'px'
}))

// Viewport object
const viewport = reactive({
  start: props.start,
  duration: props.duration,
  cWidth: props.cWidth,
  cHeight: props.cHeight,
  pHeight: pHeight.value,
  rsPeriod: props.rsPeriod,
  nrVisibleChannels: 0
})

const computedRsPeriod = computed(() => {
  // Use props value if valid
  if (props.rsPeriod > 0) {
    return props.rsPeriod
  }

  // Calculate from viewport as fallback
  if (viewport.duration > 0 && viewport.cWidth > 0) {
    const calculated = viewport.duration / viewport.cWidth
    console.log('📐 Calculated rsPeriod locally:', calculated)
    return calculated
  }

  // Safe fallback
  console.warn('⚠️ Using fallback rsPeriod = 1')
  return 1
})

// Main methods (from original) - Define these first before throttled functions
const renderDataInternal = () => {
  if (!channelsReady.value) return

  // Update visible channel count
  viewport.nrVisibleChannels = viewerChannels.value?.reduce((count, ch) => {
    return ch.visible ? count + 1 : count
  }, 0) || 0

  renderData(
    viewData,
    viewerChannels.value || [],
    props.constants,
    viewport,
    props.globalZoomMult,
    pixelRatio.value
  )
}

const generateAndProcessRequests = async () => {
  if (!viewerChannels.value) {
    return
  }

  const showChannels = chData.value.filter(channel => {
    const channelConfig = viewerChannels.value.find(config => config.id === getChannelId(channel))
    return channelConfig && channelConfig.visible
  })

  // ✅ Use computed rsPeriod instead of props
  const currentRsPeriod = computedRsPeriod.value

  const requests = generatePoints(
    showChannels,
    props.start,
    props.duration,
    viewData,
    requestedPages.value,
    props.constants,
    currentRsPeriod,  // ✅ Use computed value
    props.ts_end,
    segmIndexOf,
    getChannelId
  )

  const userToken = await useGetToken()

  if (requests.asyncRequests.length > 0) {
    const success = requestDataFromServer(
      requests.asyncRequests,
      0,
      websocket.value,
      userToken,
      activeViewer.value,
      currentRsPeriod,  // ✅ Use computed value
      requestedPages.value,
      props.ts_end
    )
  }

  // Start prefetching
  if (requests.asyncPreRequests.length > 0) {
    startPrefetching()
  }
}

const renderAll = () => {
  generateAndProcessRequests()
  renderDataInternal()
}

const renderDataOnMessage = () => {
  generateAndProcessRequests()
  if (autoScale.value === 0) {
    autoScale.value--
    handleAutoScale()
  } else {
    renderDataInternal()
  }
}

const handleAutoScale = () => {
  const autoScaleValue = autoScaleViewData(props.cHeight)
  if (autoScaleValue && !isNaN(autoScaleValue)) {
    emit('setGlobalZoom', autoScaleValue)
  }
  renderDataInternal()
}

// Throttled functions (from original) - Create these AFTER function definitions
const throttledGetRenderData = createThrottle(renderDataOnMessage, 250, { leading: false })
const throttledDataRender = createThrottle(() => renderAll(), 50)

// Watchers (from original)
watch(() => props.rsPeriod, () => {
  invalidate()
  requestedPages.value.clear()
})

watch(() => props.duration, (newDuration, oldDuration) => {
  console.log('🔄 Duration changed:', { old: oldDuration, new: newDuration })

  // Only clear caches, don't reject responses
  invalidate()  // This clears chData segments + viewData blocks

  console.log('✅ Duration change - invalidated data caches only')
})

watch(() => viewerMontageScheme.value, (newScheme) => {
  if (websocket.value && websocket.value.readyState === 1) {
    sendMontageMessage(newScheme)
  }
})

// Update viewport when props change
watch(() => [props.start, props.duration, props.cWidth, props.cHeight, props.rsPeriod], () => {
  viewport.start = props.start
  viewport.duration = props.duration
  viewport.cWidth = props.cWidth
  viewport.cHeight = props.cHeight
  viewport.pHeight = pHeight.value
  viewport.rsPeriod = props.rsPeriod
})

// WebSocket event handlers
onSegment((segmentData) => {
  dataCallback(segmentData)

  // Check if returned page falls in viewport
  if (segmentData.pageStart < (props.start + props.duration)) {
    throttledGetRenderData()
  }
})

onEvent((eventData) => {
  dataCallback(eventData)

  if (eventData.pageStart < (props.start + props.duration)) {
    throttledGetRenderData()
  }
})

onChannelDetails((channelDetails) => {
  // Remove the extra baseChannels parameter - it's already available in the composable
  const virtualChannels = processChannelData(channelDetails)

  initChannels(virtualChannels, viewerStore, getChannelId)
    .then(() => {
      invalidate()
      renderAll()
      emit('channelsInitialized')
    })
})

onError((error) => {
  viewerStore.setViewerErrors(error)
})

// Lifecycle (from original mounted/unmounted logic)
onMounted(async () => {
  pixelRatio.value = 1
  initializeCanvases(pixelRatio.value)

  // Configure WebSocket
  setPackageId(activeViewer.value?.content?.id)
  setClearChannelsCallback(() => {
    if (viewerChannels.value?.length) {
      const chIds = viewerChannels.value.map(ch => ch.id)
      const message = { 'channelFiltersToClear': chIds }
      sendFilterMessage(message)
    }
  })

  const userToken = await useGetToken()

  // Initialize prefetch function - create a wrapper that captures current values
  console.log('onmounted prefetch?')

  console.log(props.rsPeriod)
  initializePrefetch(
    (requests) => {
      const currentRsPeriod = viewport.duration / viewport.cWidth || 1
      return requestDataFromServer(
        requests,
        0,
        websocket.value,
        userToken,
        activeViewer.value,
        currentRsPeriod,
        requestedPages.value,
        props.ts_end
      )
    },
    requestedPages  // ✅ Pass the ref itself, not .value
  )

  // Open WebSocket connection
  if (activeViewer.value?.content?.id) {
    openWebsocket(
      config.value.timeSeriesUrl,
      activeViewer.value.content.id,
      userToken,
    )
  }
})

onUnmounted(() => {
  disconnect()
  clearRequests()
  if (throttledGetRenderData.cancel) {
    throttledGetRenderData.cancel()
  }
  if (throttledDataRender.cancel) {
    throttledDataRender.cancel()
  }
})

// Expose methods (from original)
defineExpose({
  renderAll,
  invalidate,
  throttledDataRender,
  viewData,
  requestedPages,
  chData,
  viewerChannels
})
</script>

<style lang="scss" scoped>
.timeseries-plot-canvas {
  position: relative;
  width: 100%;
  height: 100%;
}

.canvas {
  position: absolute;
  top: 0;
  left: 5px;
  cursor: ew-resize;
  outline: none;
}
</style>