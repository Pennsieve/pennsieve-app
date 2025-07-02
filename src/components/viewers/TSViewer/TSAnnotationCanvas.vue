<template>
  <canvas
    id="annLabelArea"
    ref="annLabelArea"
    class="timeseries-annotation-canvas"
    :width="canvasScaler(cWidth, pixelRatio, 0)"
    :height="canvasScaler(pHeight, pixelRatio, 0)"
    :style="canvasStyle"
  />
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue'
import { useAnnotationData } from '@/composables/useAnnotationData'
import { useAnnotationRendering } from '@/composables/useAnnotationRendering'
import { useAnnotationInteraction } from '@/composables/useAnnotationInteraction'
import { useAnnotationLayers } from '@/composables/useAnnotationLayers'
import { canvasScaler } from '@/utils/annotationUtils'
import EventBus from '@/utils/event-bus'

// Define props
const props = defineProps({
  cWidth: { type: Number, default: 0 },
  cHeight: Number,
  start: Number,
  duration: Number,
  tsEnd: Number,
  rsPeriod: Number,
  pixelRatio: Number,
  constants: {
    type: Object,
    default: () => ({
      ANNOTATIONLABELHEIGHT: 20,
      XOFFSET: 0,
      LIMITANNFETCH: 500
    })
  },
  pointerMode: String,
  annotationsCanvas: [HTMLCanvasElement, Object],
  activeViewer: { type: Object, required: true },
  viewerActiveTool: String
})

// Define emits
const emit = defineEmits([
  'annLayersInitialized',
  'annotationsReceived',
  'closeAnnotationLayerWindow',
  'updateAnnotation'
])

// Template refs
const annLabelArea = ref(null)

// Composables
const {
  checkAnnotationRange,
  findNextAnnotation,
  findPreviousAnnotation
} = useAnnotationData()

const {
  renderAnn,
  hoverOffsets,
  focusedAnn,
  render
} = useAnnotationRendering()

const {
  resetFocusedAnnotation,
  selectFocusedAnnotation,
  onMouseDown: handleMouseDown,
  onMouseMove: handleMouseMove,
  onMouseUp: handleMouseUp
} = useAnnotationInteraction(focusedAnn, renderAnn, hoverOffsets)

const {
  createAnnotationLayer,
  loadLayers
} = useAnnotationLayers()

// Computed properties
const pHeight = computed(() => props.cHeight - 20)

const canvasStyle = computed(() => ({
  width: props.cWidth + 'px',
  height: pHeight.value + 'px'
}))

// Public methods for parent component
const renderCanvas = () => {
  render(props, props.annotationsCanvas, annLabelArea.value, pHeight.value)
}

const onMouseDown = (mX, mY) => {
  handleMouseDown(mX, mY, props.pointerMode)
}

const onMouseMove = (mX, mY, pointerMode, mouseDown) => {
  return handleMouseMove(mX, mY, pointerMode, mouseDown, props)
}

const onMouseUp = () => {
  handleMouseUp(props.pointerMode, emit)
}

const selectFocusedAnn = () => {
  if (selectFocusedAnnotation()) {
    nextTick(() => renderCanvas())
  }
}

const createLayer = async (newLayer) => {
  try {
    await createAnnotationLayer(newLayer, props.activeViewer, emit)
  } catch (error) {
    console.error('Error creating layer:', error)
  }
}

// Watch for activeViewer changes
watch(
  () => props.activeViewer,
  async (newValue) => {
    try {
      await loadLayers(newValue, emit)
      await checkAnnotationRange(
        props.start,
        props.start + props.duration,
        props,
        newValue,
        emit
      )
    } catch (error) {
      console.error('Error loading annotations for new viewer:', error)
    }
  }
)

// Lifecycle
onMounted(async () => {
  console.log('TSAnnotationCanvas mounted with props:', {
    constants: props.constants,
    annotationsCanvas: props.annotationsCanvas,
    viewerActiveTool: props.viewerActiveTool
  })

  EventBus.$on('active-viewer-action', (action) => {
    if (action.method === 'renderCanvas') {
      console.log('Re-rendering canvas due to layer visibility change')
      renderCanvas()
    }
  })

  try {
    await loadLayers(props.activeViewer, emit)
    await checkAnnotationRange(
      props.start,
      props.start + props.duration,
      props,
      props.activeViewer,
      emit
    )
  } catch (error) {
    console.error('Error initializing annotations:', error)
  }
})

onUnmounted(() => {
  EventBus.$off('active-viewer-action')
})

// Expose methods for parent component
defineExpose({
  render: renderCanvas,
  resetFocusedAnnotation,
  findNextAnnotation,
  findPreviousAnnotation,
  checkAnnotationRange: (start, end) =>
    checkAnnotationRange(start, end, props, props.activeViewer, emit),
  selectFocusedAnn,
  createAnnotationLayer: createLayer,
  onMouseDown,
  onMouseMove,
  onMouseUp
})
</script>

<style lang="scss" scoped>
@import '../../../assets/_variables.scss';

.timeseries-annotation-canvas {
  position: absolute;
  top: 0;
  left: 0;
  margin-left: 5px;
  cursor: ew-resize;
  outline: none;
}
</style>