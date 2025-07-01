<template>
  <div class="timeseries-viewer-canvas">
    <div id="canvasWrapper">
      <TSPlotCanvas
        ref="plotCanvas"
        :c-width="cWidth"
        :c-height="cHeight"
        :start="start"
        :ts_start="tsStart"
        :ts_end="tsEnd"
        :duration="duration"
        :constants="constants"
        :rs-period="rsPeriod"
        :global-zoom-mult="globalZoomMult"
        :active-viewer="activeViewer"
        :config="config"
        @channelsInitialized="channelsInitialized"
        @setGlobalZoom="setGlobalZoom"
      >
        <template #axisCanvas>
          <canvas
            id="axisArea"
            ref="axisArea"
            class="canvas"
            :width="_cpCanvasScaler(cWidth, pixelRatio, 0)"
            :height="_cpCanvasScaler(cHeight, pixelRatio, 0)"
            :style="canvasStyle1"
          />
        </template>

        <template #annCanvas>
          <canvas
            id="annArea"
            ref="annArea"
            class="canvas"
            :width="_cpCanvasScaler(cWidth, pixelRatio, 0)"
            :height="_cpCanvasScaler(pHeight, pixelRatio, 0)"
            :style="canvasStyle2"
          />
        </template>
      </TSPlotCanvas>

      <canvas
        id="cursorArea"
        ref="cursorArea"
        class="canvas"
        :width="_cpCanvasScaler(cWidth + 5, pixelRatio, 0)"
        :height="_cpCanvasScaler(cHeight, pixelRatio, 0)"
        :style="canvasStyle3"
      />

      <TimeseriesAnnotationCanvas
        ref="annCanvas"
        :c-width="cWidth"
        :c-height="cHeight"
        :constants="constants"
        :annotations-canvas="annArea"
        :pixel-ratio="pixelRatio"
        :rs-period="rsPeriod"
        :start="start"
        :duration="duration"
        :ts-end="tsEnd"
        :pointer-mode="pointerMode"
        :viewer-active-tool="viewerActiveTool"
        @annLayersInitialized="onAnnLayersInitialized"
        @annotationsReceived="onAnnotationsReceived"
        @closeAnnotationLayerWindow="onCloseAnnotationLayerWindow"
        @updateAnnotation="onUpdateAnnotation"
      />

      <canvas
        id="iArea"
        ref="iArea"
        class="canvas"
        :width="_cpCanvasScaler(cWidth, pixelRatio, 0)"
        :height="_cpCanvasScaler(cHeight, pixelRatio, 0)"
        :style="canvasStyle1"
        tabindex="-1"
        @wheel="_onMouseWheel"
        @mousemove="_onMouseMove"
        @mousedown="_onMouseDown"
        @mouseup="_onMouseUp"
        @mouseout="_onMouseOut"
        @mouseenter="_onMouseEnter"
      />
    </div>
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
  defineAsyncComponent
} from 'vue'
import { useStore } from 'vuex'
import { storeToRefs } from 'pinia'
import { find, propEq } from 'ramda'

import TSPlotCanvas from "@/components/viewers/TSViewer/TSPlotCanvas.vue"
import { useViewerStore } from "@/stores/tsviewer"

// Import TimeseriesAnnotationCanvas properly
const TimeseriesAnnotationCanvas = defineAsyncComponent(() =>
  import('@/components/viewers/TSViewer/TSAnnotationCanvas.vue')
)

// Define props
const props = defineProps({
  windowHeight: Number,
  windowWidth: Number,
  duration: Number,
  start: Number,
  cHeight: Number,
  cWidth: Number,
  globalZoomMult: Number,
  constants: Object,
  tsStart: Number,
  tsEnd: Number,
  cursorLoc: Number,
  activeViewer: { type: Object, required: true },
  config: { type: Object, required: true }
})

// Define emits
const emit = defineEmits([
  'setDuration',
  'setGlobalZoom',
  'setStart',
  'addAnnotation',
  'updateAnnotation',
  'closeAnnotationLayerWindow',
  'channelsInitialized',
  'annLayersInitialized'
])

// Store setup
const store = useStore()
const viewerStore = useViewerStore()
const { viewerChannels, viewerAnnotations } = storeToRefs(viewerStore)

// Template refs
const plotCanvas = ref(null)
const axisArea = ref(null)
const annArea = ref(null)
const cursorArea = ref(null)
const annCanvas = ref(null)
const iArea = ref(null)

// Reactive data
const summary = reactive({})
const rsPeriod = ref(0)
const pageSize = ref(0)
const lastrRsUpdate = ref(0)
const pixelRatio = ref(1)
const mouseDown = ref(false)
const resizeClicked = ref(false)
const pointerMode = ref('pointer') // Start with a neutral default
const trackDirection = ref(false)
const startDragCoord = reactive({ x: 0, y: 0 })
const startDragTimeStamp = ref(0)
const defaultLabels = ref(['Event', 'Artifact', 'Seizure', 'Mark', 'Stim On', 'Stim Off', 'Start', 'Stop'])
const labelSelect = ref(0)

// Render function refs
const renderFnc = ref(null)
const renderThrottle = ref(0)
const requestLeadingEdge = ref(true)

// Define functions that will be used in methodMap first
const ensureActiveAnnotationLayer = () => {
  // If no layer is selected, select the first available layer
  if (viewerAnnotations.value.length > 0) {
    const hasSelected = viewerAnnotations.value.some(layer => layer.selected)
    if (!hasSelected) {
      console.log('No layer selected, selecting first layer:', viewerAnnotations.value[0])
      // FIX: Make sure the layer ID exists before setting it as active
      const firstLayer = viewerAnnotations.value[0]
      if (firstLayer && firstLayer.id) {
        viewerStore.setActiveAnnotationLayer(firstLayer.id)
      } else {
        console.error('First layer has no ID:', firstLayer)
      }
    }
  } else {
    console.warn('No annotation layers available - waiting for layers to load')
    // Try again after a short delay to allow layers to load
    setTimeout(() => {
      if (viewerAnnotations.value.length > 0) {
        ensureActiveAnnotationLayer()
      }
    }, 500)
  }
}

// ViewerActiveTool functionality - dynamically invoke tool methods
const setActiveTool = (activeTool) => {
  console.log('TSViewerCanvas: setActiveTool called with:', activeTool)
  if (activeTool) {
    // Set first character of tool to be capitalized so the method is camel case
    const methodName = 'set' + activeTool.charAt(0).toUpperCase() + activeTool.slice(1)

    // Check if the method exists and call it
    const method = methodMap[methodName]
    if (typeof method === 'function') {
      method()
    }
  }
}

// Map of dynamic methods that can be called by setActiveTool
const methodMap = {
  setPan: () => {
    console.log('Pan tool activated')
  },
  setPointer: () => {
    console.log('Pointer tool activated')
  },
  setAnnotate: () => {
    console.log('Annotate tool activated')
    // Ensure we have a selected annotation layer for creating annotations
    ensureActiveAnnotationLayer()
  }
}

// Computed properties
const viewerActiveTool = computed(() => store.state.viewerModule.viewerActiveTool)
const nrVisibleChannels = computed(() => {
  return viewerChannels.value.filter(channel => channel.visible).length
})

const pHeight = computed(() => props.cHeight - 20)

const cursorWidth = computed(() => props.cWidth + props.constants['CURSOROFFSET'])

const blurCanvas = computed(() => axisArea.value)

const canvasStyle1 = computed(() => ({
  width: props.cWidth + 'px',
  height: props.cHeight + 'px'
}))

const canvasStyle2 = computed(() => ({
  width: props.cWidth + 'px',
  height: pHeight.value + 'px'
}))

const canvasStyle3 = computed(() => ({
  width: cursorWidth.value + 'px',
  height: props.cHeight + 'px'
}))

// Watchers
watch(() => props.cHeight, () => {
  resize()
})

watch(() => props.cWidth, () => {
  resize()
})

watch(() => props.start, () => {
  renderAll()
})

watch(() => props.duration, () => {
  plotCanvas.value?.invalidate()
  updateRsPeriod(props.cWidth, props.duration)
  renderAll()
})

watch(() => props.globalZoomMult, () => {
  nextTick(() => {
    plotCanvas.value?.throttledDataRender()
  })
})

// ViewerActiveTool functionality - watch for active tool changes
watch(viewerActiveTool, (val) => {
  if (val) {
    setActiveTool(val)
    // Set pointer mode to match the active tool when not doing specific interactions
    if (!mouseDown.value && !['annResize-left', 'annResize-right', 'annSelect'].includes(pointerMode.value)) {
      pointerMode.value = val
    }
  }
}, { immediate: true })

// Watch for annotation layers being loaded
watch(viewerAnnotations, (annotations) => {
  if (annotations.length > 0 && viewerActiveTool.value === 'annotate') {
    // Ensure we have an active layer when layers become available
    ensureActiveAnnotationLayer()
  }
}, { immediate: true })

watch(pointerMode, () => {
  const iAreaEl = iArea.value
  if (!iAreaEl) return

  iAreaEl.removeAttribute('col_resize')
  iAreaEl.removeAttribute('active')
  iAreaEl.removeAttribute('point')

  switch (pointerMode.value) {
    case 'cursor_hover':
      iAreaEl.removeAttribute('point')
      iAreaEl.setAttribute('cursor_hover', true)
      break
    case 'annResize-left':
    case 'annResize-right':
      iAreaEl.setAttribute('col_resize', true)
      break
    case 'annSelect':
      iAreaEl.setAttribute('active', true)
      break
    case 'pan':
    case 'pan':
      break
    case 'pointer':
    case 'annotate':
      iAreaEl.setAttribute('point', true)
      break
    default:
      iAreaEl.removeAttribute('point')
      iAreaEl.removeAttribute('cursor_hover')
      break
  }

  nextTick(() => {
    renderAnnotationCanvas()
  })
})

// Methods
const resetFocusedAnnotation = () => {
  annCanvas.value?.resetFocusedAnnotation()
}

const createAnnotationLayer = (newLayer) => {
  annCanvas.value?.createAnnotationLayer(newLayer)
}

const getNextAnnotation = () => {
  let cursorOffset = (props.cursorLoc * props.cWidth - props.constants['CURSOROFFSET']) * rsPeriod.value
  let nextAnn = annCanvas.value?.findNextAnnotation(props.start + cursorOffset)
  return nextAnn.start - cursorOffset
}

const getPreviousAnnotation = () => {
  let cursorOffset = (props.cursorLoc * props.cWidth - props.constants['CURSOROFFSET']) * rsPeriod.value
  let nextAnn = annCanvas.value?.findPreviousAnnotation(props.start + cursorOffset)
  return nextAnn.start - cursorOffset
}

const onUpdateAnnotation = (annotation) => {
  emit('updateAnnotation', annotation)
}

const onCloseAnnotationLayerWindow = () => {
  emit('closeAnnotationLayerWindow')
}

const onAnnotationsReceived = () => {
  renderAll(100)
}

const onAnnLayersInitialized = () => {
  console.log('Annotation layers initialized, ensuring active layer for annotate tool')
  // Ensure we have an active layer when layers are initialized
  if (viewerActiveTool.value === 'annotate') {
    ensureActiveAnnotationLayer()
  }
  emit('annLayersInitialized')
}

const setGlobalZoom = (value) => {
  emit('setGlobalZoom', value)
}

const channelsInitialized = () => {
  emit('channelsInitialized')
}

const _onMouseWheel = (e) => {
  e.stopPropagation()
  e.preventDefault()

  if (e.shiftKey) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      if (e.deltaY > 0) {
        emit('setDuration', props.duration * 1.1)
      } else {
        emit('setDuration', props.duration / 1.1)
      }
    }
  } else {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      if (e.deltaY > 0) {
        emit('setGlobalZoom', props.globalZoomMult * 1.2)
      } else {
        emit('setGlobalZoom', props.globalZoomMult / 1.2)
      }
    }
  }
}

const _onMouseUp = (e) => {
  console.log('TSViewerCanvas: _onMouseUp called with pointerMode:', pointerMode.value, 'viewerActiveTool:', viewerActiveTool.value)

  resizeClicked.value = false
  mouseDown.value = false

  switch (pointerMode.value) {
    case 'pointer':
      clearICanvas()
      const append = e.metaKey
      const yEnd = e.clientY - iArea.value.getBoundingClientRect().top
      const yStart = startDragCoord.y - iArea.value.getBoundingClientRect().top

      const channels = viewerChannels.value.map(channel => {
        if (append === false) {
          channel.selected = false
        }
        if ((channel.rowBaseline > yStart && channel.rowBaseline < yEnd) ||
          (channel.rowBaseline < yStart && channel.rowBaseline > yEnd)) {
          channel.selected = true
        }
        return channel
      })

      viewerStore.setChannels(channels)
      break

    case 'annSelect':
      clearICanvas()
      annCanvas.value?.selectFocusedAnn()
      break

    case 'annotate':
      // Ensure we have a selected layer before creating annotation
      ensureActiveAnnotationLayer()

      let curLIndex = null
      let selectedLayer = null

      // FIX: Find the selected layer more carefully
      for (let i = 0; i < viewerAnnotations.value.length; i++) {
        if (viewerAnnotations.value[i].selected) {
          curLIndex = i
          selectedLayer = viewerAnnotations.value[i]
          break
        }
      }

      console.log('Creating annotation - curLIndex:', curLIndex, 'available layers:', viewerAnnotations.value.length)
      console.log('Selected layer details:', selectedLayer)

      // FIX: Validate that we have a proper layer with an ID
      if (curLIndex === null || !selectedLayer || !selectedLayer.id) {
        console.error('No valid selected annotation layer found for annotation creation', {
          curLIndex,
          selectedLayer,
          allLayers: viewerAnnotations.value
        })
        // Try to set the first available layer
        if (viewerAnnotations.value.length > 0 && viewerAnnotations.value[0].id) {
          viewerStore.setActiveAnnotationLayer(viewerAnnotations.value[0].id)
          selectedLayer = viewerAnnotations.value[0]
          curLIndex = 0
          console.log('Fallback: Selected first layer:', selectedLayer)
        } else {
          console.error('No layers available with valid IDs')
          return
        }
      }

      const selectedChannels = store.getters['viewerModule/viewerSelectedChannels']
      const allChannels = selectedChannels.length === viewerChannels.value.length || selectedChannels.length === 0

      const duration = (e.clientX - startDragCoord.x) * rsPeriod.value
      const startTime = startDragTimeStamp.value + ((startDragCoord.x - iArea.value.getBoundingClientRect().left) * rsPeriod.value)

      console.log('Creating annotation with:', {
        startTime,
        duration,
        allChannels,
        selectedChannels: selectedChannels.length,
        layer: selectedLayer.name,
        layerId: selectedLayer.id, // FIX: Log the layer ID
        pointerMode: pointerMode.value
      })

      // Only create annotation if we actually dragged to create a duration
      if (Math.abs(duration) > 1000) { // Only if duration > 1ms
        const newAnn = {
          name: '',
          id: null,
          label: defaultLabels.value[labelSelect.value],
          description: '',
          start: startTime,
          duration: duration,
          end: startTime + duration,
          cStart: null,
          cEnd: null,
          selected: true,
          channelIds: selectedChannels,
          allChannels: allChannels,
          layer_id: selectedLayer.id, // FIX: Use the validated layer ID
          userId: null
        }

        // Use Pinia store instead of Vuex
        console.log('📍 STEP 1 - TSViewerCanvas created:', newAnn)
        viewerStore.setActiveAnnotation(newAnn)
        console.log('📍 STEP 1 - Store now has:', viewerStore.activeAnnotation)
        emit('addAnnotation', startTime, duration, allChannels, newAnn.label, newAnn.description, selectedLayer)
        break
      } else {
        console.log('Annotation duration too small, not creating annotation')
      }
      break

    case 'annResize-left':
    case 'annResize-right':
      annCanvas.value?.onMouseUp()
      break
  }
}

const clearICanvas = () => {
  const iCanvas = iArea.value
  const ctx = iCanvas.getContext('2d')
  ctx.clearRect(0, 0, props.cWidth, props.cHeight)
}

const _onMouseDown = (evt) => {
  console.log('TSViewerCanvas: _onMouseDown called with pointerMode:', pointerMode.value, 'viewerActiveTool:', viewerActiveTool.value)

  mouseDown.value = true
  startDragTimeStamp.value = props.start
  const cCoord = iArea.value.getBoundingClientRect()
  startDragCoord.x = evt.clientX
  startDragCoord.y = evt.clientY

  // For annotate tool, ensure pointerMode is set to annotate if not doing specific action
  if (viewerActiveTool.value === 'annotate' && !['annResize-left', 'annResize-right', 'annSelect'].includes(pointerMode.value)) {
    console.log('Setting pointerMode to annotate for annotation creation')
    pointerMode.value = 'annotate'
  }

  switch (pointerMode.value) {
    case 'annResize-left':
    case 'annResize-right':
      resizeClicked.value = true
      annCanvas.value?.onMouseDown(evt.clientX - cCoord.left, evt.clientY - cCoord.top)
      break
  }
}

const _onMouseOut = () => {
  mouseDown.value = false
}

const _onMouseEnter = (e) => {
  if (e.buttons === 1) {
    mouseDown.value = true
  } else {
    mouseDown.value = false
  }
}

const _onMouseMove = (e) => {
  e.preventDefault()
  e.stopPropagation()

  const cCoord = iArea.value.getBoundingClientRect()
  const mY = e.clientY - cCoord.top
  const mX = e.clientX - cCoord.left

  // console.log('TSViewerCanvas: _onMouseMove called with tool:', viewerActiveTool.value, 'pointerMode:', pointerMode.value, 'mouseDown:', mouseDown.value)

  switch (viewerActiveTool.value) {
    case 'pan':
      if (mouseDown.value) {
        const setStart = startDragTimeStamp.value - ((e.clientX - startDragCoord.x) * rsPeriod.value)
        emit('setStart', setStart)
      } else {
        const newPointerMode = annCanvas.value?.onMouseMove(mX, mY, pointerMode.value, mouseDown.value)
        pointerMode.value = newPointerMode || 'pan'
      }
      break

    case 'pointer':
      if (mouseDown.value) {
        renderSelectBox(e.clientX, e.clientY)
      } else {
        const newPointerMode = annCanvas.value?.onMouseMove(mX, mY, pointerMode.value, mouseDown.value)
        pointerMode.value = newPointerMode || 'pointer'
      }
      break

    case 'annotate':
      if (mouseDown.value && pointerMode.value === 'annotate') {
        renderAnnotationBox(e.clientX)
      } else if (mouseDown.value && ['annResize-left', 'annResize-right'].includes(pointerMode.value)) {
        const newPointerMode = annCanvas.value?.onMouseMove(mX, mY, pointerMode.value, mouseDown.value)
        pointerMode.value = newPointerMode || pointerMode.value
        renderAll()
      } else {
        const newPointerMode = annCanvas.value?.onMouseMove(mX, mY, pointerMode.value, mouseDown.value)
        if (newPointerMode) {
          console.log('TSViewerCanvas: annCanvas.onMouseMove returned:', newPointerMode)
          pointerMode.value = newPointerMode
        } else {
          pointerMode.value = 'annotate'
        }
      }
      break
  }
}

const resize = () => {
  updateRsPeriod(props.cWidth, props.duration)
  renderAll(25)
}

const updateRsPeriod = (w, d) => {
  const oldRs = rsPeriod.value
  const newPeriod = d / w
  if (newPeriod !== oldRs) {
    lastrRsUpdate.value = Date.now()
    rsPeriod.value = newPeriod
    pageSize.value = Math.floor(d / props.constants['PAGESIZEDIVIDER'])
  }
}

const _cpCanvasScaler = (sz, pixelRatio, offset) => {
  return pixelRatio * (sz + offset)
}

const renderAll = (delay = 0, requestLeadingEdgeParam = true) => {
  if (!renderFnc.value || delay !== renderThrottle.value || requestLeadingEdge.value !== requestLeadingEdgeParam) {
    renderFnc.value = throttle(_renderAll, delay, { leading: requestLeadingEdgeParam })
    renderThrottle.value = delay
    requestLeadingEdge.value = requestLeadingEdgeParam
  }
  renderFnc.value()
}

const throttle = (func, wait, options = {}) => {
  let context
  let args
  let result
  let timeout = null
  let previous = 0

  const later = function() {
    previous = options.leading === false ? 0 : Date.now()
    timeout = null
    result = func.apply(context, args)
    if (!timeout) context = args = null
  }

  return function() {
    const now = Date.now()
    if (!previous && options.leading === false) previous = now
    const remaining = wait - (now - previous)
    context = this
    args = arguments
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = now
      result = func.apply(context, args)
      if (!timeout) context = args = null
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(later, remaining)
    }
    return result
  }
}

const renderAnnotationCanvas = () => {
  clearICanvas()
  annCanvas.value?.render()
}

const _renderAll = () => {
  nextTick(() => {
    _renderAxis()
    _renderCursor()
    plotCanvas.value?.renderAll()
    annCanvas.value?.render()
  })
}

const _renderAxis = () => {
  const pa = axisArea.value
  const ctx = pa.getContext('2d')
  ctx.setTransform(pixelRatio.value, 0, 0, pixelRatio.value, 0, 0)

  ctx.clearRect(0, 0, props.cWidth, props.cHeight)
  ctx.stroke()

  ctx.beginPath()
  ctx.lineWidth = 1
  ctx.moveTo(props.constants.XOFFSET + 0.5, 0.5)
  ctx.lineTo(props.constants.XOFFSET + 0.5, pHeight.value + 0.5)
  ctx.lineTo(props.cWidth + 0.5, pHeight.value + 0.5)
  ctx.stroke()

  let tickOffset = (((pHeight.value / (2 * nrVisibleChannels.value)) + 0.5) << 1) >> 1
  ctx.lineWidth = 0.5
  for (let i = 0; i < nrVisibleChannels.value; i++) {
    ctx.beginPath()
    ctx.moveTo(props.constants.XOFFSET - 2, tickOffset)
    ctx.lineTo(props.constants.XOFFSET + 2, tickOffset)
    ctx.stroke()
    tickOffset += pHeight.value / nrVisibleChannels.value
  }

  const gridSpacing = props.constants['XGRIDSPACING'] * Math.ceil(props.duration / 100000000)
  const nrGridLines = Math.ceil(props.duration / gridSpacing) + 1
  const labelDecimator = Math.ceil(props.constants['NRPXPERLABEL'] / (gridSpacing / rsPeriod.value))
  let curXLabelIdx = 1

  const xLoc1 = (gridSpacing - (props.start % gridSpacing)) % gridSpacing

  for (let i = 0; i < nrGridLines; i++) {
    let realX = props.start + xLoc1 + i * gridSpacing
    if (realX > props.tsEnd) {
      break
    }

    const realOffset = realX - props.start
    const curLoc = props.constants['XOFFSET'] + (realOffset / rsPeriod.value)
    const roundedCurLoc = Math.round(curLoc)

    if (roundedCurLoc > 1) {
      ctx.save()
      ctx.beginPath()
      ctx.lineWidth = 0.5
      ctx.strokeStyle = 'rgb(235,235,235)'
      ctx.moveTo(roundedCurLoc + 0.5, 0.5)
      ctx.lineTo(roundedCurLoc + 0.5, pHeight.value - 0.5)
      ctx.stroke()
      ctx.restore()

      const test = (((realX / gridSpacing) + gridSpacing / 10) % labelDecimator) | 0
      if (test === 1 || labelDecimator === 1) {
        ctx.beginPath()
        ctx.lineWidth = 1
        ctx.moveTo(roundedCurLoc + 0.5, pHeight.value - 3)
        ctx.lineTo(roundedCurLoc + 0.5, pHeight.value + 3)
        ctx.stroke()

        const d = new Date(realX / 1000)
        ctx.font = '12px sans-serif'
        ctx.fillStyle = 'rgb(150,150,150)'
        ctx.fillText(getUTCTimeString(d), roundedCurLoc - 20.5, props.cHeight - 0.2)

        curXLabelIdx = curXLabelIdx + 1
      }
    }
  }
}

const renderSelectBox = (curX, curY) => {
  const iCanvas = iArea.value
  const ctx = iCanvas.getContext('2d')
  ctx.setTransform(pixelRatio.value, 0, 0, pixelRatio.value, 0, 0)

  ctx.clearRect(0, 0, props.cWidth, props.cHeight)

  ctx.beginPath()
  ctx.lineWidth = 2
  ctx.strokeStyle = '#295eff'
  ctx.setLineDash([5, 5, 15, 5])

  const xStart = curX - iCanvas.getBoundingClientRect().left
  const yStart = curY - iCanvas.getBoundingClientRect().top

  ctx.rect(xStart, yStart, -curX + startDragCoord.x, -curY + startDragCoord.y)
  ctx.stroke()
}

const _renderCursor = () => {
  const pa = cursorArea.value
  const ctx = pa.getContext('2d')
  ctx.setTransform(pixelRatio.value, 0, 0, pixelRatio.value, 0, 0)
  ctx.clearRect(0, 0, props.cWidth + props.constants['CURSOROFFSET'], props.cHeight)

  ctx.save()
  ctx.beginPath()
  ctx.fillStyle = 'red'
  const cCursorLoc = props.cursorLoc * props.cWidth
  if (cCursorLoc > props.constants['CURSOROFFSET']) {
    ctx.strokeStyle = 'red'
    ctx.moveTo(cCursorLoc, 0)
    ctx.lineTo(cCursorLoc, pHeight.value)
    ctx.stroke()
  } else {
    ctx.moveTo(cCursorLoc, pHeight.value)
  }

  ctx.beginPath()
  ctx.lineTo(cCursorLoc - 5, pHeight.value + 8)
  ctx.lineTo(cCursorLoc + 5, pHeight.value + 8)
  ctx.lineTo(cCursorLoc, pHeight.value)
  ctx.fill()

  ctx.restore()
}

const renderAnnotationBox = (curX) => {
  const iCanvas = iArea.value
  const ctx = iCanvas.getContext('2d')
  ctx.setTransform(pixelRatio.value, 0, 0, pixelRatio.value, 0, 0)

  const annotationHeight = props.constants['ANNOTATIONLABELHEIGHT']
  const halfAnnotationHeight = (annotationHeight / 2) | 0

  let curLIndex = null
  for (let i = 0; i < viewerAnnotations.value.length; i++) {
    if (viewerAnnotations.value[i].selected) {
      curLIndex = i
      break
    }
  }

  if (curLIndex === null) {
    return
  }

  ctx.save()
  ctx.clearRect(0, 0, props.cWidth, props.cHeight)
  ctx.lineWidth = 1

  const selectedChannels = store.getters['viewerModule/viewerSelectedChannels']
  const allChannels = selectedChannels.length === viewerChannels.value.length || selectedChannels.length === 0

  const xStart = curX - iCanvas.getBoundingClientRect().left
  const dx = -curX + startDragCoord.x

  if (allChannels) {
    ctx.fillStyle = 'rgba(0,0,0,0.1)'
    ctx.fillRect(xStart, 0, dx, pHeight.value)

    ctx.fillStyle = viewerAnnotations.value[curLIndex].color
    ctx.strokeStyle = ctx.fillStyle

    let lblStart = xStart - 1
    let lblEnd = dx + 2
    if (dx < 0) {
      lblStart = xStart + 1
      lblEnd = dx - 2
    }

    ctx.fillRect(lblStart, 0, lblEnd, annotationHeight)

    ctx.setLineDash([5, 5, 5, 5])
    ctx.beginPath()
    ctx.moveTo(xStart, annotationHeight)
    ctx.lineTo(xStart, pHeight.value)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(xStart + dx, annotationHeight)
    ctx.lineTo(xStart + dx, pHeight.value)
    ctx.stroke()
  } else {
    let minOffset = props.cHeight | 0
    let maxOffset = 0
    const channelConfig = viewerChannels.value

    ctx.fillStyle = viewerAnnotations.value[curLIndex].color
    ctx.strokeStyle = ctx.fillStyle

    let lblStart = xStart - 1
    let lblEnd = dx + 2
    if (dx < 0) {
      lblStart = xStart + 1
      lblEnd = dx - 2
    }

    for (let ch = 0; ch < channelConfig.length; ch++) {
      const curChannelView = channelConfig[ch]
      if (curChannelView.selected && curChannelView.visible) {
        const channelOffset = curChannelView.rowBaseline | 0
        if (channelOffset < minOffset) {
          minOffset = channelOffset
        }
        if (channelOffset > maxOffset) {
          maxOffset = channelOffset
        }

        ctx.fillRect(lblStart, channelOffset - halfAnnotationHeight, lblEnd, annotationHeight)
      }
    }

    ctx.fillStyle = 'rgba(0,0,0,0.1)'
    ctx.setLineDash([5, 5, 5, 5])

    ctx.fillRect(
      xStart - 1,
      minOffset + halfAnnotationHeight,
      dx + 2,
      maxOffset - minOffset - annotationHeight
    )
    ctx.beginPath()
    ctx.moveTo(xStart, minOffset + halfAnnotationHeight)
    ctx.lineTo(xStart, maxOffset - halfAnnotationHeight)
    ctx.moveTo(xStart + dx, minOffset + halfAnnotationHeight)
    ctx.lineTo(xStart + dx, maxOffset - halfAnnotationHeight)
    ctx.stroke()
  }
  ctx.restore()
}

const initViewerCanvas = () => {
  plotCanvas.value?.initPlotCanvas()
}

const getScreenPixelRatio = () => {
  let ctx = iArea.value.getContext('2d')
  let dpr = window.devicePixelRatio || 1
  let bsr = ctx.webkitBackingStorePixelRatio ||
    ctx.mozBackingStorePixelRatio ||
    ctx.msBackingStorePixelRatio ||
    ctx.oBackingStorePixelRatio ||
    ctx.backingStorePixelRatio || 1

  return dpr / bsr
}

const getUTCTimeString = (d) => {
  return (
    ('0' + d.getUTCHours()).slice(-2) + ':' +
    ('0' + d.getUTCMinutes()).slice(-2) + ':' +
    ('0' + d.getUTCSeconds()).slice(-2)
  )
}

const setFilters = (payload) => {
  let input0 = parseFloat(payload.input0)
  let input1 = parseFloat(payload.input1)
  let message = {}

  switch (payload.filterType) {
    case 'clear':
      message = { 'channelFiltersToClear': payload.selChannels }
      break
    case 'bandpass':
      let bp_center = (input0 + input1) / 2
      let bp_width = Math.abs((input1 - input0) / 2)
      message = {
        'filter': payload.filterType,
        'filterParameters': [4, bp_center, bp_width],
        'channels': payload.selChannels
      }
      break
    case 'highpass':
      message = {
        'filter': payload.filterType,
        'filterParameters': [4, input0],
        'channels': payload.selChannels
      }
      break
    case 'lowpass':
      message = {
        'filter': payload.filterType,
        'filterParameters': [4, input0],
        'channels': payload.selChannels
      }
      break
    case 'bandstop':
      let bs_width = 10
      const bs_center = payload.notchFreq
      message = {
        'filter': payload.filterType,
        'filterParameters': [4, bs_center, bs_width],
        'channels': payload.selChannels
      }
      break
    default:
      return
  }

  plotCanvas.value?.sendFilterMessage(message)

  for (let i = 0; i < payload.selChannels.length; i++) {
    let channelId = payload.selChannels[i]
    let channel = find(propEq('id', channelId), viewerChannels.value)

    if (payload.filterType === 'clear') {
      channel.filter = {}
    } else {
      channel.filter = {
        type: payload.filterType,
        input0: input0,
        input1: input1,
        notchFreq: payload.notchFreq
      }
    }
    store.dispatch('viewerModule/updateChannel', channel)
  }

  plotCanvas.value?.invalidate()
  renderAll()
}

// Lifecycle
onMounted(() => {
  pixelRatio.value = getScreenPixelRatio()
})

// Expose methods that might be called from parent components
defineExpose({
  rsPeriod,

  resetFocusedAnnotation,
  createAnnotationLayer,
  getNextAnnotation,
  getPreviousAnnotation,
  setFilters,
  setActiveTool,
  renderAll,
  renderAnnotationCanvas,
  initViewerCanvas
})
</script>

<style lang="scss" scoped>
@import '../../../assets/_variables.scss';

.timeseries-viewer-canvas {
  display: flex;
  background-color: white;
  flex: 1;
}

#canvasWrapper {
  position: relative;
}

#channelCanvas {
  display: flex;
}

.canvas {
  position: absolute;
  top: 0;
  left: 0;
  margin-left: 5px;
  cursor: ew-resize;
  outline: none;
}

.canvas[active] {
  cursor: pointer;
}

.canvas[col_resize] {
  cursor: col-resize;
}

.canvas[point] {
  cursor: default;
}

.canvas[cursor_hover] {
  cursor: col-resize;
}

#cursorArea {
  margin-left: 0;
}

#annotationPopover {
  position: absolute;
  opacity: 0;
  display: none;
  top: 75px;
  z-index: 1000;
  left: 400px;
}
</style>