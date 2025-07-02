<!-- TSPlotCanvas.vue -->
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
import { computed, watch, onMounted, onUnmounted, reactive, ref,nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useViewerStore } from '@/stores/tsviewer'
import { useWebSocket } from '@/composables/useWebSocket'
import { useCanvasRenderer } from '@/composables/useCanvasRenderer'
import { useTimeSeriesData } from '@/composables/useTimeSeriesData'
import { useDataRequests } from '@/composables/useDataRequests'
import { useChannelProcessing } from '@/composables/useChannelProcessing'
import { createThrottle } from '@/utils/throttle'
import {useGetToken} from "@/composables/useGetToken";

const props = defineProps({
  cHeight: { type: Number, required: true },
  cWidth: { type: Number, required: true },
  start: { type: Number, required: true },
  duration: { type: Number, required: true },
  constants: { type: Object, required: true },
  rsPeriod: { type: Number, required: true },
  ts_start: { type: Number, required: true },
  ts_end: { type: Number, required: true },
  globalZoomMult: { type: Number, required: true },
  activeViewer: { type: Object, required: true },
  config: { type: Object, required: true }
})

const emit = defineEmits(['channelsInitialized', 'setGlobalZoom'])


const config = computed(() => props.config || {})
const activeViewer = computed( () => props.activeViewer || {})
const baseChannels = computed(() => activeViewer.value?.channels || [])

// Pinia Store
const viewerStore = useViewerStore()
const {
  viewerChannels,
  viewerMontageScheme,
  workspaceMontages,
} = storeToRefs(viewerStore)

// Initialize composables
const {
  websocket,
    connectionStatus,
    openWebsocket,
    send,
    sendFilterMessage,
    sendDumpBufferRequest,
    disconnect,
    setClearChannelsCallback,
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
  cpCanvasScaler,
  computeChannelViews
} = useCanvasRenderer()

// Define pixelRatio directly in main component to avoid dependency issues
const pixelRatio = ref(1)

const isDumpingBuffer = ref(false)

const {
  chData,
  requestedPages,
  viewData,
  channelsReady,
  autoScale,
  initChannels,
  dataCallback,
  invalidate,
  autoScaleViewData,
  segmIndexOf,
  updateCurrentRequestedSamplePeriod,
  currentRequestedSamplePeriod,
  isDataCurrentForViewport
} = useTimeSeriesData()

const {
  aSyncRequests,
  aSyncPreRequests,
  isPrefetching,
  initializePrefetch,
  generatePoints,
  requestDataFromServer,
  startPrefetching,
  clearRequests,
} = useDataRequests()

// Initialize channel processing composable with baseChannels
const {
  getChannelId,
  processChannelData,
  createMontagePayload
} = useChannelProcessing(baseChannels, viewerMontageScheme, workspaceMontages, activeViewer)

const prefetchStats = ref({
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  montageRequests: 0,
  singleChannelRequests: 0,
  lastPrefetchTime: null,
  averageResponseTime: 0
})

const lastRequestedSamplePeriod = ref(null)
const lastRequestStart = ref(null)
const lastRequestDuration = ref(null)
const staleDataCounter = ref(0)

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
    // console.log('📐 Calculated rsPeriod locally:', calculated)
    return calculated
  }

  // Safe fallback
  console.warn('⚠️ Using fallback rsPeriod = 1')
  return 1
})

// ✅ NEW: Watch for rsPeriod changes and update requestedSamplePeriod validation
watch(computedRsPeriod, (newRsPeriod) => {
  if (newRsPeriod > 0) {
    updateCurrentRequestedSamplePeriod(newRsPeriod)
    // console.log('🎯 Updated requestedSamplePeriod validation for rsPeriod:', newRsPeriod)
  }
}, { immediate: true })

// Main methods (from original) - Define these first before throttled functions
const renderDataInternal = () => {
  // console.log('🎨 renderDataInternal ENTRY')

  try {
    if (!channelsReady.value) {
      console.log('⏳ Render skipped - channels not ready')
      return
    }

    // console.log('📊 Render state check:', {
    //   channelsReady: channelsReady.value,
    //   viewDataChannelsCount: viewData.channels.length,
    //   viewerChannelsCount: viewerChannels.value?.length || 0,
    //   pixelRatio: pixelRatio.value
    // })

    // Update visible channel count
    viewport.nrVisibleChannels = viewerChannels.value?.reduce((count, ch) => {
      return ch.visible ? count + 1 : count
    }, 0) || 0

    // console.log('👁️ Visible channels:', viewport.nrVisibleChannels)

    // Check what data is available for rendering
    let totalDataBlocks = 0
    let channelsWithData = 0

    // console.log('📋 Checking viewData.channels:')
    viewData.channels.forEach((ch, idx) => {
      const blocks = ch.blocks || []
      const dataPoints = blocks.reduce((sum, b) => sum + (b.nrPoints || 0), 0)

      if (blocks.length > 0) {
        channelsWithData++
        totalDataBlocks += blocks.length

        // console.log(`  📊 Channel ${idx} (${ch.id}):`, {
        //   blocks: blocks.length,
        //   dataPoints: dataPoints,
        //   blockTypes: blocks.map(b => b.type),
        //   firstBlockRange: blocks[0] ? { start: blocks[0].startTs, points: blocks[0].nrPoints } : null
        // })
      } else {
        // console.log(`  ⚠️ Channel ${idx} (${ch.id}): NO DATA`)
      }
    })

    // console.log('📈 RENDER SUMMARY:', {
    //   totalChannelsWithData: channelsWithData,
    //   totalDataBlocks: totalDataBlocks,
    //   viewport: {
    //     start: viewport.start,
    //     duration: viewport.duration,
    //     width: viewport.cWidth,
    //     height: viewport.cHeight,
    //     nrVisibleChannels: viewport.nrVisibleChannels
    //   }
    // })

    if (channelsWithData === 0) {
      // console.warn('❌ NO DATA TO RENDER - all channels empty')
      return
    }

    // console.log('🖼️ Checking canvas refs:', {
    //   plotCanvasRef: !!plotCanvasRef.value,
    //   blurCanvasRef: !!blurCanvasRef.value
    // })

    // console.log('✅ CALLING renderData with:', {
    //   channelsWithData: channelsWithData,
    //   constantsKeys: Object.keys(props.constants),
    //   globalZoomMult: props.globalZoomMult
    // })

    renderData(
      viewData,
      viewerChannels.value || [],
      props.constants,
      viewport,
      props.globalZoomMult,
      pixelRatio.value
    )

    // console.log('🎨 RENDER COMPLETE')

  } catch (error) {
    console.error('💥 ERROR in renderDataInternal:', error)
    console.error('💥 Stack trace:', error.stack)
  }
}

const PrefetchInterval = ref()
const monitorPrefetchActivity = () => {
  PrefetchInterval.value = setInterval(() => {
    if (!channelsReady.value) return

    const stats = {
      timestamp: new Date().toISOString(),
      requestedPagesSize: requestedPages.value.size,
      isPrefetching: isPrefetching.value,
      pendingAsyncRequests: aSyncRequests.value.length,
      pendingPreRequests: aSyncPreRequests.value.length,
      currentMontage: viewerMontageScheme.value,
      channelCount: viewerChannels.value?.length || 0,
      visibleChannelCount: viewerChannels.value?.filter(ch => ch.visible).length || 0,
      connectionStatus: connectionStatus.value,
      requestedPages: Array.from(requestedPages.value.entries()).map(([pageStart, info]) => ({
        pageStart,
        channelCount: info.count,
        inViewport: info.inViewport,
        age: Date.now() - info.ts,
        channels: info.channels?.map(ch => ch.id) || Array.from(info.counter.keys())
      }))
    }

    // console.log('📊 Prefetch Monitor:', stats)

    // Check for stuck requests (older than 10 seconds)
    const stuckRequests = stats.requestedPages.filter(page => page.age > 10000)
    if (stuckRequests.length > 0) {
      console.warn('⚠️ Detected stuck requests:', stuckRequests)

    }

    // Check if prefetch is blocked
    if (stats.pendingPreRequests > 0 && !stats.isPrefetching) {
      console.warn('⚠️ Prefetch is blocked with pending requests:', {
        pendingPreRequests: stats.pendingPreRequests,
        requestedPagesSize: stats.requestedPagesSize
      })
    }

  }, 5000) // Log every 5 seconds

  // Clear interval on unmount
  // onUnmounted(() => {
  //   clearInterval(interval)
  // })
}

const generateAndProcessRequests = async () => {
  if (!viewerChannels.value) {
    return
  }

  const showChannels = chData.value.filter(channel => {
    const channelConfig = viewerChannels.value.find(config =>
      config.id === channel.id  // Direct id comparison (both are unique)
    )
    return channelConfig && channelConfig.visible
  })

  const currentRsPeriod = computedRsPeriod.value

  const requests = generatePoints(
    showChannels,
    props.start,
    props.duration,
    viewData,
    requestedPages.value,
    props.constants,
    currentRsPeriod,
    props.ts_end,
    segmIndexOf,
    getChannelId
  )

  const currentRequestedSamplePeriod = Math.ceil(currentRsPeriod)
  let shouldDumpBuffer = false
  let dumpReason = ''

  // Check for ANY rsPeriod change (any resolution change makes pending requests stale)
  if (lastRequestedSamplePeriod.value !== null && currentRequestedSamplePeriod !== lastRequestedSamplePeriod.value) {
    shouldDumpBuffer = true
    dumpReason = `rsPeriod changed: ${lastRequestedSamplePeriod.value} → ${currentRequestedSamplePeriod} (resolution change)`
  }

  // Check for large time jump
  if (lastRequestStart.value !== null) {
    const timeJump = Math.abs(props.start - lastRequestStart.value)
    const windowSize = Math.max(props.duration, lastRequestDuration.value || props.duration)
    if (timeJump > windowSize * 2) {
      shouldDumpBuffer = true
      dumpReason = `Large time jump: ${timeJump} > ${windowSize * 2} (${(timeJump / windowSize).toFixed(1)}x window)`
    }
  }

  // Check for too many pending requests
  const MAX_PENDING_REQUESTS = 15
  if (requestedPages.value.size > MAX_PENDING_REQUESTS) {
    shouldDumpBuffer = true
    dumpReason = `Too many pending requests: ${requestedPages.value.size} > ${MAX_PENDING_REQUESTS}`
  }

  // Check for high stale data rate
  if (staleDataCounter.value >= 5) {
    shouldDumpBuffer = true
    dumpReason = `High stale data rate: ${staleDataCounter.value} consecutive stale segments`
  }

  // ✅ RACE CONDITION PROTECTION: Only one dump at a time
  if (shouldDumpBuffer && !isDumpingBuffer.value) {
    isDumpingBuffer.value = true
    console.log('🚨 Dumping server buffer before new requests:', dumpReason)

    try {
      if (sendDumpBufferRequest()) {
        // Clear client state after successful dump
        requestedPages.value.clear()
        clearRequests()
        staleDataCounter.value = 0

        // Brief delay to let server process dump request
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    } finally {
      isDumpingBuffer.value = false
    }
  } else if (shouldDumpBuffer && isDumpingBuffer.value) {
    // Another dump is already in progress, skip this one
    console.log('⏭️ Skipping duplicate dump request (already in progress)')
    return
  }

  // Update state tracking
  lastRequestedSamplePeriod.value = currentRequestedSamplePeriod
  lastRequestStart.value = props.start
  lastRequestDuration.value = props.duration



  const userToken = await useGetToken()

  if (requests.asyncRequests.length > 0) {
    // console.log('📤 Making requests with currentRequestedSamplePeriod:', currentRequestedSamplePeriod)
    const success = requestDataFromServer(
      requests.asyncRequests,
      0,
      websocket.value,
      userToken,
      activeViewer.value,
      currentRsPeriod,
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
  // console.log('🔄 renderDataOnMessage called')
  generateAndProcessRequests()

  if (autoScale.value === 0) {
    autoScale.value--
    // console.log('🎯 Triggering auto scale')
    handleAutoScale()
  } else {
    // console.log('🎨 Calling renderDataInternal')
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
watch(() => props.rsPeriod, (newRsPeriod, oldRsPeriod) => {
  // console.log('🔄 rsPeriod prop changed:', { old: oldRsPeriod, new: newRsPeriod })

  if (newRsPeriod > 0) {
    updateCurrentRequestedSamplePeriod(newRsPeriod)
  }

  invalidate()
  requestedPages.value.clear()
  // console.log('✅ rsPeriod change - cleared caches and updated requestedSamplePeriod validation')
})

watch(() => props.duration, (newDuration, oldDuration) => {
  // console.log('🔄 Duration changed:', { old: oldDuration, new: newDuration })

  // Only clear caches, don't reject responses
  invalidate()  // This clears chData segments + viewData blocks
  // console.log('✅ Duration change - invalidated data caches only')
})

watch(() => viewerMontageScheme.value, (newScheme) => {

  if (websocket.value && websocket.value.readyState === 1) {
    console.log('🔄 Montage changing to:', newScheme)

    // Clear all pending requests and data
    requestedPages.value.clear()
    clearRequests()
    invalidate()

    // Reset stale data tracking
    staleDataCounter.value = 0
    lastRequestedSamplePeriod.value = null
    lastRequestStart.value = null
    lastRequestDuration.value = null

    // Clear channels to force re-initialization
    channelsReady.value = false

    // Create the proper payload using createMontagePayload
    const montagePayload = createMontagePayload(newScheme)
    console.log('📡 Sending montage payload:', montagePayload)

    if (montagePayload) {
      send(montagePayload)
    }
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
  // 🔍 ADD MONITORING LOGIC HERE (before existing logic)
  const isOutsideViewport = segmentData.pageStart >= (props.start + props.duration)

  if (isOutsideViewport) {
    // console.log('📦 Prefetch data received:', {
    //   pageStart: segmentData.pageStart,
    //   channelId: segmentData.data?.chId || segmentData.data?.source,
    //   channelName: segmentData.data?.label || segmentData.data?.name,
    //   type: segmentData.type,
    //   nrPoints: segmentData.data?.nrPoints,
    //   viewportStart: props.start,
    //   viewportEnd: props.start + props.duration
    // })

    prefetchStats.value.totalRequests++
    if (viewerMontageScheme.value !== 'NOT_MONTAGED') {
      prefetchStats.value.montageRequests++
    } else {
      prefetchStats.value.singleChannelRequests++
    }
  }

  // 🔄 EXISTING LOGIC (unchanged)
  // console.log('✅ SEGMENT RECEIVED:', {
  //   pageStart: segmentData.pageStart,
  //   type: segmentData.type,
  //   channelId: segmentData.data?.chId || segmentData.data?.source || segmentData.data?.id,
  //   channelName: segmentData.data?.label || segmentData.data?.name,
  //   nrPoints: segmentData.data?.nrPoints,
  //   startTs: segmentData.data?.startTs,
  //   hasValidation: typeof isDataCurrentForViewport === 'function'
  // })

  dataCallback(segmentData)

  // Check if returned page falls in viewport
  if (segmentData.pageStart < (props.start + props.duration)) {
    throttledGetRenderData()
  }
})

onEvent((eventData) => {
  // console.log('✅ REQUEST SUCCESS - Received event:', {
  //   pageStart: eventData.pageStart,
  //   channelId: eventData.data.chId || eventData.data.source,
  //   dataType: eventData.type,
  //   nrResponses: eventData.nrResponses
  // })

  if (!isDataCurrentForViewport(eventData.data)) {
    staleDataCounter.value++
    // console.log(`🗑️ Discarding stale event (${staleDataCounter.value}/5)`)
    return
  }

  staleDataCounter.value = 0
  dataCallback(eventData)

  if (eventData.pageStart < (props.start + props.duration)) {
    // console.log('🎯 Event in viewport - triggering render')
    throttledGetRenderData()
  }
})

onChannelDetails((channelDetails) => {
  // console.log('📡 RECEIVED CHANNEL DETAILS:', {
  //   channelCount: channelDetails.length,
  //   channels: channelDetails.map(ch => ({
  //     id: ch.content?.id,
  //     name: ch.content?.name,
  //     type: ch.content?.channelType
  //   }))
  // })

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

const initPlotCanvas = async () => {
  const initialRsPeriod = computedRsPeriod.value
  updateCurrentRequestedSamplePeriod(initialRsPeriod)

  // Configure WebSocket
  setClearChannelsCallback(() => {
    if (viewerChannels.value?.length) {
      const chIds = viewerChannels.value.map(ch => ch.id)
      const message = { 'channelFiltersToClear': chIds }
      sendFilterMessage(message)
    }
  })

  const userToken = await useGetToken()

  // Initialize prefetch function - create a wrapper that captures current values
  initializePrefetch(
    (requests) => {
      const currentRsPeriod = computedRsPeriod.value
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
    requestedPages
  )

  if (activeViewer.value?.content?.id) {
    try {
      console.log('🔄 Opening WebSocket connection for package:', activeViewer.value.content.id)

      // Make sure this waits for the connection to complete
      await openWebsocket(
        config.value.timeSeriesUrl,
        activeViewer.value.content.id,
        userToken,
      )

      console.log('✅ WebSocket connection established')

      // Only start monitoring after successful connection
      monitorPrefetchActivity()

    } catch (error) {
      console.error('❌ Failed to establish WebSocket connection:', error)
      // Handle connection failure gracefully
      return
    }
  }

  console.log('🚀 TSPlotCanvas mounted with config:', {
    activeViewerId: activeViewer.value?.content?.id,
    initialMontage: viewerMontageScheme.value,
    baseChannelCount: baseChannels.value?.length || 0,
    viewport: {
      start: props.start,
      duration: props.duration,
      width: props.cWidth,
      height: props.cHeight,
      rsPeriod: props.rsPeriod
    }
  })
}
// Lifecycle (from original mounted/unmounted logic)
onMounted(async () => {
  pixelRatio.value = 1
  initializeCanvases(pixelRatio.value)

  initPlotCanvas()
})

onUnmounted(() => {

  clearInterval(PrefetchInterval.value)

  if (requestedPages.value.size > 0) {
    sendDumpBufferRequest()
  }
  viewerStore.resetViewer()
  clearRequests()
  disconnect()
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
  sendFilterMessage,
  viewData,
  requestedPages,
  chData,
  viewerChannels,
  currentRequestedSamplePeriod,
  initPlotCanvas
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