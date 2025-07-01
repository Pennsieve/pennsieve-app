<template>
  <canvas
    id="annLabelArea"
    ref="annLabelArea"
    class="timeseries-annotation-canvas"
    :width="_cpCanvasScaler(cWidth, pixelRatio, 0)"
    :height="_cpCanvasScaler(pHeight, pixelRatio,0)"
    :style="canvasStyle"
  />
</template>

<script setup>
import {ref, computed, onMounted, nextTick, watch} from 'vue'
import { useStore } from 'vuex'
import { useViewerStore } from '@/stores/tsviewer'
import { storeToRefs } from 'pinia'
import EventBus from '@/utils/event-bus'

import { defaultTo, find, head, pathOr, prop, propEq, propOr } from 'ramda'
import { useGetToken } from "@/composables/useGetToken"
import { useHandleXhrError, useSendXhr } from "@/mixins/request/request_composable"

// Define props
const props = defineProps({
  cWidth: {
    type: Number,
    default: 0
  },
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
  viewerActiveTool: String
})

// Define emits
const emit = defineEmits([
  'annLayersInitialized',
  'annotationsReceived',
  'closeAnnotationLayerWindow',
  'updateAnnotation'
])

// Store setup
const store = useStore() // Vuex store for activeViewer and config
const viewerStore = useViewerStore()
const {
  viewerChannels,
  viewerAnnotations,
  viewerMontageScheme,
  getViewerActiveLayer
} = storeToRefs(viewerStore)

// Template refs
const annLabelArea = ref(null)

// Reactive data
const defaultColors = ref([
  '#18BA62', '#FFBC27', '#E94B4B', '#0D4EFF', '#FF4FFF', '#50FFFF', '#FFFF4E', '#512BAF',
  '#8A6ECF', '#389BAD', '#187D46', '#B12800', '#0C2475', '#FF5321', '#FF99CC', '#DCC180',
  '#FF6C21', '#000000', '#9B9B9B', '#00FF00', '#FA8072', '#808000', '#A0522D', '#2760FF'
])

const annLayerInfo = ref([])
const hoverOffsets = ref([])
const cachedAnnRange = ref([])
const a11yList = ref(['#FFFF4E'])
const focusedAnn = ref(null)
const renderAnn = ref([])
const mouseDownPosition = ref([0, 0])

// Computed properties
const activeViewer = computed(() => store.state.viewerModule.activeViewer)
const config = computed(() => store.state.config)

const pHeight = computed(() => {
  return props.cHeight - 20
})

const canvasStyle = computed(() => {
  return {
    width: props.cWidth + 'px',
    height: pHeight.value + 'px'
  }
})

// Methods
const _cpCanvasScaler = (sz, pixelRatio, offset) => {
  return pixelRatio * (sz + offset)
}

const _getLayerResponse = async (resp) => {
  // reset layers list
  const annLayers = []

  // If there is no layer present, create a default layer.
  if (resp.results.length === 0) {
    const payload = {
      name: 'Default',
      color: '#18BA62',
      description: 'Default Annotation Layer'
    }

    await createAnnotationLayer(payload)
  } else {
    // get the layers from the response
    for (let i = 0; i < resp.results.length; i++) {
      let layerColor = resp.results[i].color
      if (!layerColor) {
        layerColor = defaultColors.value[i % defaultColors.value.length]
      }
      const layer = {
        id: resp.results[i].id,
        name: resp.results[i].name,
        description: resp.results[i].description,
        visible: true,
        selected: false,
        annotations: [],
        color: hexToRgbA(layerColor, 0.7),
        hexColor: layerColor,
        bkColor: hexToRgbA(layerColor, 0.15),
        selColor: hexToRgbA(layerColor, 0.9)
      }

      annLayers.push(layer)
    }

    if (annLayers.length > 0) {
      annLayers[0].selected = true
    }

    // Use Pinia store instead of Vuex
    viewerStore.setAnnotations(annLayers)
    emit('annLayersInitialized')
  }

  annLayerInfo.value = resp.results
  return Promise.resolve()
}

const hexToRgbA = (hex, opacity) => {
  let c
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('')
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]]
    }
    c = '0x' + c.join('')
    return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + opacity + ')'
  }
  throw new Error('Bad Hex')
}

const sortAnns = (annArray) => {
  annArray.sort(function Comparator(a, b) {
    if (a.start < b.start) return -1
    if (a.start > b.start) return 1
    return 0
  })
}

const _computeRenderOptions = (anns) => {
  const annotationHeight = props.constants?.['ANNOTATIONLABELHEIGHT'] || 20
  const halfAnnotationHeight = (annotationHeight / 2) | 0
  const xOffset = props.constants?.['XOFFSET'] || 0
  const remIdx = []

  for (let annIdx = 0; annIdx < anns.length; annIdx++) {
    const curAnn = anns[annIdx]

    // Invert if duration is negative
    let viewStart = curAnn.start
    let viewDuration = curAnn.duration
    if (curAnn.duration < 0) {
      viewStart = (curAnn.start + curAnn.duration)
      viewDuration = -curAnn.duration
    }

    const curAnnStart = xOffset + (viewStart - props.start) / props.rsPeriod
    curAnn.cStart = curAnnStart | 0

    if (curAnn.duration !== 0) {
      const curAnnEnd = xOffset + (viewStart + viewDuration - props.start) / props.rsPeriod
      curAnn.cEnd = curAnnEnd | 0          // round to integer
    } else {
      curAnn.cEnd = (curAnn.cStart + props.cWidth / 40) | 0   // round to integer
    }

    if (!curAnn.allChannels) {
      curAnn.allOffsets = []
      curAnn.minOffset = props.cHeight | 0
      curAnn.maxOffset = 0

      const channelConfig = viewerChannels.value
      for (let ch1 in curAnn.channelIds) {
        if (curAnn.channelIds.hasOwnProperty(ch1)) {
          // find channel
          let channelOffset = null
          for (let ch2 in channelConfig) {
            if (channelConfig.hasOwnProperty(ch2)) {
              const curChannelView = channelConfig[ch2]
              if (curChannelView.id === curAnn.channelIds[ch1] && curChannelView.visible) {
                channelOffset = curChannelView.rowBaseline | 0
                if (channelOffset < curAnn.minOffset) { curAnn.minOffset = channelOffset }
                if (channelOffset > curAnn.maxOffset) { curAnn.maxOffset = channelOffset }
                curAnn.allOffsets.push(channelOffset)
                break
              }
            }
          }
        }
      }

      // Add to hoverOffsets
      if (hoverOffsets.value.indexOf(curAnn.minOffset) < 0) {
        hoverOffsets.value.push(curAnn.minOffset)
      }
      curAnn.cY = curAnn.minOffset  // set renderOffset

    } else {
      curAnn.allOffsets = [halfAnnotationHeight]
      curAnn.cY = halfAnnotationHeight  // set renderOffset
    }
  }

  for (let j = (remIdx.length - 1); j >= 0; j--) {
    anns.splice(remIdx[j], 1)
  }
}

const getChannelId = (channel) => {
  const isViewingMontage = viewerMontageScheme.value !== 'NOT_MONTAGED'
  let id = propOr('', 'id', channel)
  let list = []
  if (isViewingMontage) {
    list = id.split('_')
    id = list.length ? head(list) : id // remove channel name from id
  }
  return id
}

// ANNOTATIONS
const findNextAnnotation = (curTime) => {
  let annLayer = viewerStore.getViewerActiveLayer()
  console.log(annLayer)
  const index = annIndexOf(annLayer.annotations, curTime, false)

  console.log(index)

  if (index < annLayer.annotations.length) {
    // If current time is before this annotation's start, this is the next annotation
    if (annLayer.annotations[index].start > curTime) {
      return annLayer.annotations[index]
    }
    // Otherwise, return the next annotation (or current if no next exists)
    return annLayer.annotations[index + 1] || annLayer.annotations[index]
  } else {
    return annLayer.annotations[index]
  }
}

const findPreviousAnnotation = (curTime) => {
  let annLayer = viewerStore.getViewerActiveLayer()
  const index = annIndexOf(annLayer.annotations, curTime, true)

  if (annLayer.annotations[index].start < curTime) {
    return annLayer.annotations[index]
  }

  if (index > 0) {
    return annLayer.annotations[index -1 ]
  } else {
    return annLayer.annotations[index]
  }
}

const checkAnnotationRange = (RStart, REnd) => {
  // If part of the viewport is not cached, request up to limit.
  // Start with full width --> split on existing ranges
  const reqRange = []
  reqRange.push({ start: RStart, end: props.tsEnd })

  // check if viewport is cached
  let firstIndex = 0
  for (let i = 0; i < cachedAnnRange.value.length; i++) {
    const curBlock = cachedAnnRange.value[i]
    if (RStart >= curBlock.start && REnd <= curBlock.end) {
      // annotations in current viewport are cached
      return
    } else if (reqRange[0].start > REnd) {
      break
    } else if (curBlock.start <= reqRange[0].start && curBlock.end >= RStart) {
      // existing cached partly in viewport
      firstIndex = i + 1
      reqRange[0].start = curBlock.end
    } else if (curBlock.start > reqRange[0].start) {
      // block start is beyond viewport
      firstIndex = i
      break
    }
  }

  // check if layers have annotations
  const annotationsTotal = viewerAnnotations.value.reduce((acc, li) => acc = li.annotations.length)

  // If all in memory, return
  if (reqRange[0].start >= reqRange[0].end && annotationsTotal > 0) {
    return
  }

  // Now find ranges
  const curRequestIndex = 0
  for (let i = firstIndex; i < cachedAnnRange.value.length; i++) {
    if (cachedAnnRange.value[i].start >= reqRange[curRequestIndex].start) {
      reqRange[curRequestIndex].end = cachedAnnRange.value[i].start
      // Only add new request if within viewport
      if (cachedAnnRange.value[i].end < REnd) {
        reqRange.push({ start: cachedAnnRange.value[i].end, end: props.tsEnd })
      } else {
        break
      }
    }
  }

  // If all in viewport in memory, return
  if (reqRange[0].start >= reqRange[0].end && annotationsTotal > 0) {
    return
  }

  // Request annotations from server if any need to be requested.
  if ((reqRange.length > 0)) {
    const channelIds = []
    for (let i = 0; i < viewerChannels.value.length; i++) {
      const channel = viewerChannels.value[i]
      const id = getChannelId(channel)
      channelIds.push(id)
    }

    // Request new range
    for (let cur in reqRange) {
      if (reqRange.hasOwnProperty(cur)) {
        const curRange = reqRange[cur]
        for (let lyr = 0; lyr < viewerAnnotations.value.length; lyr++) {
          const curLayer = viewerAnnotations.value[lyr]

          // FIX: Check if curLayer.id exists before making API call
          if (!curLayer.id) {
            console.warn('Layer ID is undefined, skipping annotation request for layer:', curLayer)
            continue
          }

          const endTime = Math.floor(curRange.end)
          const params = {
            id: activeViewer.value.content.id,
            start: Math.floor(curRange.start),
            end: endTime,
            layerId: curLayer.id,
            limit: props.constants['LIMITANNFETCH']
          }

          useGetToken()
            .then(token => {
              const apiUrl = config.value.apiUrl
              const baseUrl = `${apiUrl}/timeseries/${activeViewer.value.content.id}/layers/${curLayer.id}/annotations?api_key=${token}`
              const urlParams = Object.keys(params).map(k => `&${k}=${params[k]}`).join('')
              const url = `${baseUrl}${urlParams}`

              return fetch(url, {
                method: 'GET',
                headers: {
                  'Content-type': 'application/json'
                }
              })
                .then(response => {
                  const { status } = response
                  if (status >= 400) {
                    throw new Error(status)
                  }
                  return response.json()
                })
                .then(_getAnnResponse)
            })
            .catch(err => {
              useHandleXhrError(err)
            })
        }
        cachedAnnRange.value.push({ start: Math.floor(curRange.start), end: Math.floor(curRange.end) })
      }
    }

    // Sort the returned annotations by end-time
    cachedAnnRange.value.sort(function Comparator(a, b) {
      if (a.start < b.start) return -1
      if (a.start > b.start) return 1
      return 0
    })
  }
}

const _getAnnResponse = (e) => {
  const linkedPackages = propOr({}, 'linkedPackages', e)
  let resp = pathOr([], ['annotations', 'results'], e)

  // Set requested range to last annstart.
  if (resp.length >= (props.constants?.['LIMITANNFETCH'] || 500)) {
    // find max start time
    let maxStart = 0
    for (let j = 0; j < resp.length; j++) {
      if (resp[j].start > maxStart) {
        maxStart = resp[j].start
      }
    }
    // find range
    for (let i = 0; i < cachedAnnRange.value.length; i++) {
      if (cachedAnnRange.value[i].end > maxStart && cachedAnnRange.value[i].start < maxStart) {
        cachedAnnRange.value[i].end = maxStart
        break
      }
    }
  }

  const isViewingMontage = viewerMontageScheme.value !== 'NOT_MONTAGED'

  if (resp.length > 0) {
    const annotations = []
    for (let i = 0; i < resp.length; i++) {
      const curAnn = resp[i]
      const newAnn = {
        name: '',
        id: curAnn.id,
        label: curAnn.label,
        description: curAnn.description,
        start: curAnn.start,
        duration: curAnn.end - curAnn.start,
        end: curAnn.end,
        cStart: null,
        cEnd: null,
        selected: false,
        channelIds: curAnn.channelIds,
        allChannels: false,
        layer_id: curAnn.layerId,
        userId: curAnn.userId
      }

      if (curAnn.linkedPackage) {
        const pkgId = curAnn.linkedPackage
        newAnn.linkedPackage = pathOr('', ['content', 'id'], linkedPackages[pkgId])
        newAnn.linkedPackageDTO = linkedPackages[pkgId]
      }

      // Check if all channels are selected
      if (!isViewingMontage && newAnn.channelIds.length === viewerChannels.value.length) {
        newAnn.allChannels = true
      } else if (isViewingMontage && newAnn.channelIds.length > viewerChannels.value.length) {
        newAnn.allChannels = true
      }

      // Find layer
      let curLIndex = null
      for (let j = 0; j < viewerAnnotations.value.length; j++) {
        if (viewerAnnotations.value[j].id === curAnn.layerId) {
          curLIndex = j
          break
        }
      }

      if (curLIndex === null) {
        const newLayer = {
          id: viewerAnnotations.value.length,
          color: null,
          visible: true,
          selected: false,
          annotations: [],
          userId: curAnn.userId
        }
        viewerStore.createLayer(newLayer)
        curLIndex = viewerAnnotations.value.length - 1
      }
      annotations.push(newAnn)
    }

    // get layers
    viewerAnnotations.value.forEach(layer => {
      // get annotations for layer
      const layerAnns = layer.annotations
      const filteredAnns = annotations.filter(ann => layer.id === ann.layer_id)
      layer.annotations = layerAnns.concat(filteredAnns)
      // get all annotations per layer
      viewerStore.updateLayer(layer)
    })
  }

  emit('annotationsReceived')
}

const annIndexOf = (annArray, val, first, startAtIndex, checkEnd) => {
  if (!startAtIndex) {
    startAtIndex = 0
  }

  let index
  if (checkEnd) {
    index = _indexOfEnd(annArray, val, startAtIndex, annArray.length - 1, first)
  } else {
    index = _indexOfStart(annArray, val, startAtIndex, annArray.length - 1, first)
  }

  if (index === -1) {
    index = 0
  } else if (index < 0) {
    index = -index - 2
  }
  return index
}

const _indexOfStart = (annArray, val, min, max, firstIndex) => {
  if (max < min) {
    let pred
    if (max >= 0) {
      pred = max
    } else {
      pred = -max - 2
    }
    if (pred === -1) {
      return pred
    }
    const predVal = annArray[pred].start
    while (pred >= 0 && annArray[pred].start === predVal) {
      pred--
    }
    pred++
    return -pred - 2
  }

  const mid = parseInt((min + max) / 2)

  if (annArray[mid].start > val) {
    return _indexOfStart(annArray, val, min, mid - 1, firstIndex)
  } else if (annArray[mid].start < val) {
    return _indexOfStart(annArray, val, mid + 1, max, firstIndex)
  } else {
    let index = mid
    if (firstIndex) {
      while (index >= 0 && annArray[index].start === val) {
        index--
      }
      index++
    } else {
      while (index < annArray.length && annArray[index].start === val) {
        index++
      }
      index--
    }
    return index
  }
}

const _indexOfEnd = (annArray, val, min, max, firstIndex) => {
  if (max < min) {
    let pred
    if (max >= 0) {
      pred = max
    } else {
      pred = -max - 2
    }
    if (pred === -1) {
      return pred
    }
    const predVal = annArray[pred].start + annArray[pred].duration
    while (pred >= 0 && (annArray[pred].start + annArray[pred].duration) === predVal) {
      pred--
    }
    pred++
    return -pred - 2
  }

  const mid = parseInt((min + max) / 2)

  if ((annArray[mid].start + annArray[mid].duration) > val) {
    return _indexOfEnd(annArray, val, min, mid - 1, firstIndex)
  } else if ((annArray[mid].start + annArray[mid].duration) < val) {
    return _indexOfEnd(annArray, val, mid + 1, max, firstIndex)
  } else {
    let index = mid
    if (firstIndex) {
      while (index >= 0 && (annArray[index].start + annArray[index].duration) === val) {
        index--
      }
      index++
    } else {
      while (index < annArray.length && (annArray[index].start + annArray[index].duration) === val) {
        index++
      }
      index--
    }

    return index
  }
}

const getLayer = (annotation) => {
  const layerId = propOr(0, 'layer_id', annotation)
  return defaultTo({}, find(propEq('id', layerId), viewerAnnotations.value))
}

const createAnnotationLayer = async (newLayer) => {
  try {
    const token = await useGetToken()
    const url = `${config.value.apiUrl}/timeseries/${activeViewer.value.content.id}/layers?api_key=${token}`

    const resp = await useSendXhr(url, {
      method: "POST",
      body: {
        name: newLayer.name,
        color: newLayer.color,
        description: newLayer.name
      }
    })

    let layer = resp
    layer.annotations = []

    const hexColor = layer.color
    layer.hexColor = hexColor
    layer.color = hexToRgbA(hexColor, 0.7)
    layer.bkColor = hexToRgbA(hexColor, 0.15)
    layer.selColor = hexToRgbA(hexColor, 0.9)
    layer.visible = true

    viewerStore.createLayer(layer)
    viewerStore.setActiveAnnotationLayer(layer.id)

    EventBus.$emit('toast', {
      detail: {
        msg: `'${layer.name}' Layer Created`
      }
    })
  } catch (error) {
    useHandleXhrError(error)
  } finally {
    emit('closeAnnotationLayerWindow')
  }
}

const resetFocusedAnnotation = () => {
  if (prop('oldStart', focusedAnn.value)) {
    focusedAnn.value.start = focusedAnn.value.oldStart
    focusedAnn.value.duration = focusedAnn.value.oldDuration
    focusedAnn.value.end = focusedAnn.value.start + focusedAnn.value.duration
  }
}

// RENDER METHODS
const render = () => {
  // console.log('TSAnnotationCanvas: render() called', {
  //   annotationsCanvas: props.annotationsCanvas,
  //   viewerAnnotations: viewerAnnotations.value?.length,
  //   cWidth: props.cWidth,
  //   cHeight: props.cHeight
  // })

  if (!props.annotationsCanvas || props.annotationsCanvas === undefined) {
    console.warn('TSAnnotationCanvas: annotationsCanvas prop is undefined or null')
    return
  }

  const ctxBk = props.annotationsCanvas.getContext('2d')
  const ctxLb = annLabelArea.value.getContext('2d')
  ctxBk.setTransform(props.pixelRatio, 0, 0, props.pixelRatio, 0, 0)
  ctxLb.setTransform(props.pixelRatio, 0, 0, props.pixelRatio, 0, 0)

  // Init hover offsets --> used to track which channels contain individual annotations.
  hoverOffsets.value = [(props.constants?.['ANNOTATIONLABELHEIGHT'] || 20) / 2]

  // clear canvas
  ctxBk.clearRect(0, 0, props.cWidth, props.cHeight)
  ctxLb.clearRect(0, 0, props.cWidth, props.cHeight)

  // clear Render Annotations Array
  renderAnn.value = []

  // Iterate over visible layers and populate render array
  for (let iL in viewerAnnotations.value) {
    if (viewerAnnotations.value.hasOwnProperty(iL)) {
      const curLayer = viewerAnnotations.value[iL]

      if (curLayer.visible && curLayer.annotations && curLayer.annotations.length > 0) {
        // Get last index in (start-sorted) array of annotations that start before end of window
        const lastIndex = annIndexOf(curLayer.annotations, props.start + props.duration, false, 0, false)

        const priorAnns = []
        for (let iAnn = 0; iAnn <= lastIndex; iAnn++) {
          priorAnns.push(curLayer.annotations[iAnn])
        }

        // Sort the returned annotations by end-time
        priorAnns.sort(function Comparator(a, b) {
          if ((a.start + a.duration) < (b.start + b.duration)) return -1
          if ((a.start + a.duration) > (b.start + b.duration)) return 1
          return 0
        })

        // Find the first index in (end-sorted) array of annotations that end after start of window
        const first = annIndexOf(priorAnns, props.start, true, 0, true)

        // Populate renderArray of annotations.
        for (let iAnn = first; iAnn <= priorAnns.length - 1; iAnn++) {
          const curAnn = priorAnns[iAnn]
          renderAnn.value.push(curAnn)
        }
      }
    }
  }

  // Sort rendered annotations
  sortAnns(renderAnn.value)

  // Compute all render-variables
  _computeRenderOptions(renderAnn.value)

  // Render all backGrounds
  _renderAnnotationAreas(ctxBk, renderAnn.value)

  // Render focus backGround
  _renderAnnotationLabels(ctxLb, renderAnn.value, true)

  // Render focus Label
  if (focusedAnn.value !== null) {
    _renderAnnotationLabels(ctxLb, [focusedAnn.value], false)
  }
}

const _renderAnnotationAreas = (ctx, anns) => {
  const annotationHeight = props.constants?.['ANNOTATIONLABELHEIGHT'] || 20
  const halfAnnotationHeight = (annotationHeight / 2) | 0
  ctx.setTransform(props.pixelRatio, 0, 0, props.pixelRatio, 0, 0)

  ctx.save()
  ctx.lineWidth = 1
  ctx.setLineDash([8, 5])
  ctx.strokeStyle = 'rgba(0,0,0, 0.6)'
  ctx.fillStyle = 'rgba(0,0,0,0.05)'

  for (const ann in anns) {
    if (anns.hasOwnProperty(ann)) {
      const curAnn = anns[ann]
      const curAnnLayer = getLayer(curAnn)

      if (curAnn.selected) {
        ctx.save()
        ctx.strokeStyle = curAnnLayer.selColor
        ctx.fillStyle = curAnnLayer.bkColor
        ctx.lineWidth = 1
      }

      // Switch render based on type: 1) global 2) Globalpoint 3) channel 4) channelPoint
      let curAnnStartRounded = Math.round(curAnn.cStart) + 0.5
      let curAnnEndRounded = Math.round(curAnn.cEnd) + 0.5

      if (curAnn.allChannels) {
        // On all channels
        if (curAnn.duration === 0) {
          // No duration
          // Background area
          ctx.beginPath()
          ctx.moveTo(curAnnStartRounded + 1, annotationHeight)
          ctx.lineTo(curAnnStartRounded, pHeight.value)
          ctx.stroke()
        } else {
          // With duration
          // Background area
          ctx.fillRect(curAnnStartRounded, annotationHeight, curAnnEndRounded - curAnnStartRounded, pHeight.value - annotationHeight)
          ctx.beginPath()
          ctx.moveTo(curAnnStartRounded, annotationHeight)
          ctx.lineTo(curAnnStartRounded, pHeight.value)
          ctx.moveTo(curAnnEndRounded, annotationHeight)
          ctx.lineTo(curAnnEndRounded, pHeight.value)
          ctx.stroke()
        }
      } else if (curAnn && curAnn.channelIds && curAnn.channelIds.length === 1) {
        // Flagpole in case of single channel with no duration
        if (curAnn.duration === 0) {
          ctx.beginPath()
          ctx.moveTo(curAnnStartRounded, curAnn.minOffset + halfAnnotationHeight)
          ctx.lineTo(curAnnStartRounded, curAnn.minOffset + halfAnnotationHeight + 8)
          ctx.stroke()
        }
      } else {
        // On multiple channels
        if (curAnn.duration === 0) {
          // No duration
          ctx.beginPath()
          ctx.moveTo(curAnnStartRounded, curAnn.minOffset + halfAnnotationHeight)
          ctx.lineTo(curAnnStartRounded, curAnn.maxOffset - halfAnnotationHeight)
          ctx.stroke()
        } else {
          // With duration
          ctx.fillRect(curAnnStartRounded - 1, curAnn.minOffset + halfAnnotationHeight,
            curAnnEndRounded - curAnnStartRounded + 1, curAnn.maxOffset - curAnn.minOffset - annotationHeight)
          ctx.beginPath()
          ctx.moveTo(curAnnStartRounded, curAnn.minOffset + halfAnnotationHeight)
          ctx.lineTo(curAnnStartRounded, curAnn.maxOffset - halfAnnotationHeight)
          ctx.moveTo(curAnnEndRounded, curAnn.minOffset + halfAnnotationHeight)
          ctx.lineTo(curAnnEndRounded, curAnn.maxOffset - halfAnnotationHeight)
          ctx.stroke()
        }
      }

      if (curAnn.selected) {
        ctx.restore()
      }
    }
  }
  ctx.restore()
}

const _renderAnnotationLabels = (ctx, anns, hideFocusedAnn) => {
  const annotationHeight = props.constants?.['ANNOTATIONLABELHEIGHT'] || 20
  const halfAnnotationHeight = (annotationHeight / 2) | 0

  ctx.setTransform(props.pixelRatio, 0, 0, props.pixelRatio, 0, 0)

  ctx.save()
  ctx.lineWidth = 2
  ctx.font = '14px sans-serif'
  ctx.textAlign = 'left'

  for (let iAnn = 0; iAnn < anns.length; iAnn++) {
    const curAnn = anns[iAnn]
    const curAnnLayer = getLayer(curAnn)

    if (curAnn === focusedAnn.value && hideFocusedAnn) {
      continue
    }

    // Set options
    if (curAnn.selected) {
      ctx.fillStyle = curAnnLayer.selColor || 'rgba(51,204,102, 0.8)'
      ctx.strokeStyle = 'white'
    } else {
      ctx.fillStyle = curAnnLayer.color || 'rgba(51,204,102,0.8)'
      if (curAnn === focusedAnn.value) {
        ctx.strokeStyle = 'white'
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      }
    }

    let curAnnStartRounded = Math.round(curAnn.cStart) + 1
    let curAnnEndRounded = Math.round(curAnn.cEnd)

    // Render label background
    let minOffsetIdx = 0
    for (let i = 0; i < curAnn.allOffsets.length; i++) {
      ctx.fillRect(curAnnStartRounded - 1, curAnn.allOffsets[i] -
        halfAnnotationHeight, curAnnEndRounded - curAnnStartRounded + 2, annotationHeight)
      if (curAnn.allOffsets[i] === curAnn.minOffset) {
        minOffsetIdx = i
      }
    }

    // Render Inside lines (resize handles)
    const firstOffset = curAnn.allOffsets[minOffsetIdx]
    if (['annSelect', 'annResize-left', 'annResize-right'].includes(props.pointerMode) && props.viewerActiveTool === "annotate") {
      ctx.beginPath()

      if (curAnn.duration !== 0) {
        ctx.moveTo(curAnnEndRounded - 3, firstOffset - halfAnnotationHeight + 3)
        ctx.lineTo(curAnnEndRounded - 3, firstOffset + halfAnnotationHeight - 3)
      }
      ctx.moveTo(curAnnStartRounded + 3, firstOffset - halfAnnotationHeight + 3)
      ctx.lineTo(curAnnStartRounded + 3, firstOffset + halfAnnotationHeight - 3)
      ctx.stroke()
    }

    // fill text
    if ((curAnnEndRounded - curAnnStartRounded) > ((curAnn.label.length * 8) + 10)) {
      ctx.fillStyle = a11yList.value.indexOf(curAnnLayer.hexColor) >= 0 ? 'black' : 'white'
      if (!curAnn.linkedPackage) {
        ctx.fillText(curAnn.label, curAnnStartRounded + 10, firstOffset + halfAnnotationHeight - 6)
      } else {
        ctx.fillText(curAnn.label, curAnnStartRounded + 30, firstOffset + halfAnnotationHeight - (halfAnnotationHeight / 2))
      }
    }

    const linkedPackageDTO = curAnn.linkedPackageDTO

    if (linkedPackageDTO && (curAnnEndRounded - curAnnStartRounded) >= 30) {
      const preview = pathOr({}, ['objects', 'view', 1, 'content'], linkedPackageDTO)
      const fileType = propOr('', 'fileType', preview)

      const img = new Image()

      // if there's an image preview available
      if (fileType === 'PNG') {
        const { id, packageId } = preview
        const apiUrl = config.value.apiUrl

        useGetToken()
          .then(token => {
            img.src = `${apiUrl}/packages/${packageId}/files/${id}/presign/?api_key=${token}`
            if (!img.complete) {
              img.addEventListener('load', () => render(), { once: true })
            }
            ctx.drawImage(img, curAnnStartRounded, firstOffset - halfAnnotationHeight, 27, annotationHeight)
          })
          .catch(console.log)

      } else {
        img.src = _computeIcon(linkedPackageDTO)
        ctx.drawImage(img, curAnnStartRounded + 5, firstOffset - halfAnnotationHeight, 20, 20)
      }
    }
  }

  ctx.restore()
}

const _computeIcon = (linkedPackageDTO) => {
  // This method should return an appropriate icon based on the package type
  // Implementation depends on your icon system
  return '/path/to/default/icon.png'
}

// MOUSEMOVE METHODS
const onMouseDown = (mX, mY) => {
  console.log('TSAnnotationCanvas: onMouseDown called', { mX, mY, focusedAnn: focusedAnn.value })
  if (focusedAnn.value) {
    switch (props.pointerMode) {
      case 'annResize-left':
      case 'annResize-right':
        focusedAnn.value.oldStart = focusedAnn.value.start
        focusedAnn.value.oldDuration = focusedAnn.value.duration
        mouseDownPosition.value = [mX, mY]
        break
    }
  }
}

const onMouseMove = (mX, mY, pointerMode, mouseDown) => {
  let newPointerMode = pointerMode

  if (mouseDown && mouseDownPosition.value) {
    // Dragging and updating annotation start/duration
    const timeDiff = (mX - mouseDownPosition.value[0]) * props.rsPeriod
    switch (props.pointerMode) {
      case 'annResize-left':
        if (focusedAnn.value.oldDuration > 0) {
          focusedAnn.value.start = (focusedAnn.value.oldStart + timeDiff)
          focusedAnn.value.duration = (focusedAnn.value.oldDuration - timeDiff)
          focusedAnn.value.end = focusedAnn.value.start + focusedAnn.value.duration
        } else {
          focusedAnn.value.start = (focusedAnn.value.oldStart + timeDiff)
        }
        break
      case 'annResize-right':
        focusedAnn.value.duration = (focusedAnn.value.oldDuration + timeDiff)
        focusedAnn.value.end = focusedAnn.value.start + focusedAnn.value.duration
        break
    }

  } else {
    const checkAnns = shouldCheckAnnotationHover(mY)
    // FIX: Use props.viewerActiveTool instead of viewerActiveTool.value
    newPointerMode = props.viewerActiveTool

    if (checkAnns) {
      const annHeight = props.constants?.['ANNOTATIONLABELHEIGHT'] || 20
      const halfAnnHeight = annHeight / 2

      let onAnn = null
      for (let i = 0; i < (renderAnn.value?.length || 0); i++) {
        if ((renderAnn.value[i].cStart) < mX && (renderAnn.value[i].cEnd) > mX) {
          // Now check annotation offset
          if (mY > (renderAnn.value[i].cY - halfAnnHeight) && mY < (renderAnn.value[i].cY + halfAnnHeight)) {
            onAnn = i
          }
        } else if (renderAnn.value[i].cStart > mX) {
          // Break on first annotation where start > mX
          break
        }
      }

      // Setting the cursor pointer
      if (onAnn !== null) {
        const oldFocus = focusedAnn.value

        // If no focus, or focused but now outside range ---> update focus to annotation under cursor
        if (oldFocus === null || (focusedAnn.value && (mX < focusedAnn.value.cStart || mX > focusedAnn.value.cEnd))) {
          focusedAnn.value = renderAnn.value[onAnn]
        }

        // Check which activeArea
        switch (props.viewerActiveTool) {
          case 'annotate':
            if (mX <= (focusedAnn.value.cStart + 10)) {
              newPointerMode = 'annResize-left'
            } else if (mX >= (focusedAnn.value.cEnd - 10) && focusedAnn.value.duration > 0) {
              newPointerMode = 'annResize-right'
            } else {
              newPointerMode = 'annSelect'
            }
            break
          case 'pointer':
            newPointerMode = 'annSelect'
            break
        }

      } else {
        focusedAnn.value = null
      }

    } else {
      focusedAnn.value = null
      newPointerMode = props.viewerActiveTool
    }
  }

  return newPointerMode
}

const onMouseUp = () => {
  if (focusedAnn.value) {
    switch (props.pointerMode) {
      case 'annResize-left':
      case 'annResize-right':
        // update start/duration in case of annotation inversion

        // correct negative durations
        if (focusedAnn.value.duration < 0) {
          const duration = -focusedAnn.value.duration
          const start = focusedAnn.value.start - duration
          focusedAnn.value.start = start
          focusedAnn.value.duration = duration
          focusedAnn.value.end = start + duration
        }

        viewerStore.setActiveAnnotation(focusedAnn.value)
        emit('updateAnnotation', focusedAnn.value)
        break
    }
  }
}

const shouldCheckAnnotationHover = (mY) => {
  const annHeight = props.constants?.['ANNOTATIONLABELHEIGHT'] || 20
  const halfAnnHeight = annHeight / 2

  let checkAnns = false
  for (let o = 0; o < hoverOffsets.value.length; o++) {
    if (mY >= (hoverOffsets.value[o] - halfAnnHeight) && mY <= (hoverOffsets.value[o] + halfAnnHeight)) {
      checkAnns = true
      break
    }
  }
  return checkAnns
}

// ACTION METHODS
const selectFocusedAnn = () => {
  viewerStore.setActiveAnnotation(focusedAnn.value)
  nextTick(() => {
    render()
  })
}

watch( () => activeViewer.value, async (newValue, oldValue ) => {

  useGetToken()
    .then(token => {
      const url = `${config.value.apiUrl}/timeseries/${newValue.content.id}/layers?api_key=${token}`
      return useSendXhr(url)
        .then(resp => {
          _getLayerResponse(resp)
            .then(() => {
              checkAnnotationRange(props.start, props.start + props.duration)
            })
        })
    }).catch(useHandleXhrError)

})




// Lifecycle
onMounted(() => {
  console.log('TSAnnotationCanvas mounted with props:', {
    constants: props.constants,
    annotationsCanvas: props.annotationsCanvas,
    viewerActiveTool: props.viewerActiveTool
  })

  useGetToken()
    .then(token => {
      const url = `${config.value.apiUrl}/timeseries/${activeViewer.value.content.id}/layers?api_key=${token}`
      return useSendXhr(url)
        .then(resp => {
          _getLayerResponse(resp)
            .then(() => {
              checkAnnotationRange(props.start, props.start + props.duration)
            })
        })
    }).catch(useHandleXhrError)
})

// Expose methods for parent component
defineExpose({
  render,
  resetFocusedAnnotation,
  findNextAnnotation,
  findPreviousAnnotation,
  checkAnnotationRange,
  selectFocusedAnn,
  createAnnotationLayer,
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