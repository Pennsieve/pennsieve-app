<template>
  <div class="timeseries-scrubber">
    <div class="dateWrap">
      <div>{{ ts_start_str }}</div>
      <div>{{ fullDateStr }}</div>
      <div>{{ ts_end_str }}</div>
    </div>
    <div class="noselect">
      <div id="scrubber" noselect>
        <div id="canvasWrap" ref="canvasWrap">
          <canvas
            id="segmentsCanvas"
            class="canvas"
            ref="segmentsCanvas"
            :width="_cpCanvasScaler(cWidth, pixelRatio, 0)"
            :height="_cpCanvasScaler(viewportHeight - 2, pixelRatio, 0)"
            :style="canvasStyle"
          ></canvas>
          <canvas
            id="annotationCanvas"
            class="canvas"
            ref="annotationCanvas"
            :width="_cpCanvasScaler(cWidth, pixelRatio, 0)"
            :height="_cpCanvasScaler(viewportHeight - 2, pixelRatio, 0)"
            :style="canvasStyle"
          ></canvas>
          <canvas
            id="iCanvas"
            class="canvas"
            ref="iCanvas"
            :width="_cpCanvasScaler(cWidth, pixelRatio, 0)"
            :height="_cpCanvasScaler(viewportHeight, pixelRatio, 0)"
            @click="_onTap"
            @mousemove="_onMouseMove"
            @mousedown="_onMouseDown"
            @mouseup="_onMouseUp"
            @mouseenter="_onMouseEnter"
            @mouseout="_onMouseOut"
            :style="iCanvasStyle"
          ></canvas>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useViewerStore } from "@/stores/tsviewer";
import { useGetToken } from "@/composables/useGetToken";
import {
  useHandleXhrError,
  useSendXhr,
} from "@/mixins/request/request_composable";
import { map } from "ramda";

// Props
const props = defineProps({
  ts_start: Number,
  ts_end: Number,
  cWidth: Number,
  constants: Object,
  start: Number,
  duration: Number,
  cursorLoc: Number,
  labelWidth: Number,
  config: Object,
  activeViewer: Object,
});

// Emits
const emit = defineEmits(["setStart"]);

// Store
const viewerStore = useViewerStore();

// Template refs
const canvasWrap = ref(null);
const segmentsCanvas = ref(null);
const annotationCanvas = ref(null);
const iCanvas = ref(null);

// Reactive data
const pixelRatio = ref(1);
const scrubberHeight = ref(28);
const viewportHeight = ref(30);
const mouseDown = ref(false);
const hoverTxt = ref("");
const pointerMode = ref("point");
const patternCnvs = ref(null);
const annotations = ref([]);
const segmentSpans = ref([]);
const segments = ref([]);
const isInitializing = ref(false);

// Additional mouse tracking data
const clickX = ref(0);
const startDragTime = ref(0);
const cStart = ref(0);
const cDuration = ref(0);

// Computed properties
const ts_start_str = computed(() => {
  return getUTCTimeString(props.ts_start);
});

const ts_end_str = computed(() => {
  return getUTCTimeString(props.ts_end);
});

const fullDateStr = computed(() => {
  if (hoverTxt.value !== "") {
    return hoverTxt.value;
  } else if (props.start > 0) {
    const d = new Date(props.start / 1000).toUTCString();
    return d.substring(0, d.length - 3);
  }
  return "";
});

const canvasStyle = computed(() => {
  return {
    width: props.labelWidth + props.cWidth - 8 + 5 + "px",
    height: "28px",
  };
});

const iCanvasStyle = computed(() => {
  return {
    width: props.labelWidth + props.cWidth - 8 + 5 + "px",
    height: "30px",
  };
});

const scrubberCWidth = computed(() => {
  return props.cWidth + props.labelWidth - 8 + 5;
});

const period = computed(() => {
  return Math.floor((props.ts_end - props.ts_start) / props.cWidth);
});

// Watchers
watch(
  () => props.start,
  () => {
    render();
  }
);

watch(
  () => props.duration,
  () => {
    render();
  }
);

watch(
  () => props.cWidth,
  () => {
    render();
  }
);

// Watch for changes in activeViewer (package switching)
watch(
  () => props.activeViewer,
  (newViewer, oldViewer) => {
    if (newViewer && newViewer !== oldViewer) {
      console.log(
        "TSScrubber: ActiveViewer changed, resetting component state"
      );
      isInitializing.value = true;
      resetComponentState();

      // Re-initialize if we have valid data
      if (newViewer.content?.id) {
        nextTick(() => {
          // Only fetch annotations immediately (doesn't need channels)
          getAnnotations();

          // Wait for channels to be populated before initializing segments
          // This will be handled by the viewerChannels watcher
          isInitializing.value = false;
        });
      } else {
        isInitializing.value = false;
      }
    }
  },
  { deep: true }
);

// Watch for changes in viewer channels (only if not currently initializing)
watch(
  () => viewerStore.viewerChannels,
  (newChannels, oldChannels) => {
    if (newChannels && newChannels.length > 0 && !isInitializing.value) {
      // Check if this is a significant change (different count or package switch)
      const hasSignificantChange =
        !oldChannels ||
        newChannels.length !== oldChannels.length ||
        newChannels[0]?.id !== oldChannels[0]?.id;

      if (hasSignificantChange) {
        console.log(
          "TSScrubber: Viewer channels changed, re-initializing segments"
        );
        resetSegmentState();
        nextTick(() => {
          initSegmentSpans();
        });
      }
    }
  },
  { deep: true }
);

// Watch for changes in viewer annotations (only if not currently initializing)
watch(
  () => viewerStore.viewerAnnotations,
  (newAnnotations, oldAnnotations) => {
    if (
      newAnnotations &&
      newAnnotations !== oldAnnotations &&
      !isInitializing.value
    ) {
      console.log(
        "TSScrubber: Viewer annotations changed independently, re-fetching annotations"
      );
      nextTick(() => {
        getAnnotations();
      });
    } else if (
      newAnnotations &&
      newAnnotations.length > 0 &&
      !oldAnnotations &&
      props.activeViewer?.content?.id
    ) {
      // Special case: annotation layers just became available and we have an active viewer
      console.log(
        "TSScrubber: Annotation layers now available, fetching annotations"
      );
      nextTick(() => {
        getAnnotations();
      });
    }
  },
  { deep: true }
);

// Helper methods for state management
const resetComponentState = () => {
  console.log("TSScrubber: Resetting component state");

  // Reset annotation data
  annotations.value = [];

  // Reset segment data
  resetSegmentState();

  // Reset mouse/interaction state
  mouseDown.value = false;
  hoverTxt.value = "";
  pointerMode.value = "point";

  // Clear any existing renders
  clearCanvases();
};

const resetSegmentState = () => {
  console.log("TSScrubber: Resetting segment state");

  // Reset segments array
  segments.value = new Array(5000);
  segments.value = segments.value.fill(0, 0, 4999);

  // Reset segment spans
  segmentSpans.value = [];
};

const clearCanvases = () => {
  // Clear all canvases
  nextTick(() => {
    const canvases = [
      segmentsCanvas.value,
      annotationCanvas.value,
      iCanvas.value,
    ];
    canvases.forEach((canvas) => {
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    });
  });
};
const _cpCanvasScaler = (sz, pixelRatio, offset) => {
  return pixelRatio * (sz + offset);
};

const getScreenPixelRatio = () => {
  const ctx = iCanvas.value.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const bsr =
    ctx.webkitBackingStorePixelRatio ||
    ctx.mozBackingStorePixelRatio ||
    ctx.msBackingStorePixelRatio ||
    ctx.oBackingStorePixelRatio ||
    ctx.backingStorePixelRatio ||
    1;

  return dpr / bsr;
};

const getUTCTimeString = (d) => {
  if (d > 0) {
    d = d / 1000;
    d = new Date(d);
    return (
      ("0" + d.getUTCHours()).slice(-2) +
      ":" +
      ("0" + d.getUTCMinutes()).slice(-2) +
      ":" +
      ("0" + d.getUTCSeconds()).slice(-2)
    );
  }
};

const getUTCDateString = (d, s, c) => {
  if (s !== "") {
    return s;
  } else if (d > 0) {
    d = new Date(d / 1000);
    return d.toDateString();
  }
};

// Mouse Interactions
// const _onTap = (e) => {
//   const cCoord = iCanvas.value.getBoundingClientRect()
//   const cClickOffset = e.clientX - cCoord.left
//   const realStart = (cClickOffset / scrubberCWidth.value) * (props.ts_end - props.ts_start)
//   emit('setStart', realStart + props.ts_start)
// }

const _onMouseMove = (e) => {
  if (!mouseDown.value) {
    const cCoord = iCanvas.value.getBoundingClientRect();
    const cHoverOffset = e.clientX - cCoord.left;
    const cEnd = cStart.value + cDuration.value;
    const oldMode = pointerMode.value;
    const inResizeArea =
      cHoverOffset > cStart.value - 10 && cHoverOffset < cEnd + 10;

    if (inResizeArea) {
      pointerMode.value = "drag";
      iCanvas.value.setAttribute("dragme", true);
      iCanvas.value.removeAttribute("resizeme");
    } else {
      pointerMode.value = "point";
      iCanvas.value.removeAttribute("dragme");
      iCanvas.value.removeAttribute("resizeme");
    }

    // Update hoverTxt
    const realStart =
      (cHoverOffset / props.cWidth) * (props.ts_end - props.ts_start) +
      props.ts_start;
    const d = new Date(realStart / 1000).toUTCString();
    hoverTxt.value = d.substring(0, d.length - 3);

    if (oldMode !== pointerMode.value) {
      render();
    }
  } else {
    // is Dragging
    const _dx = e.clientX - clickX.value;
    const realStart = (_dx / props.cWidth) * (props.ts_end - props.ts_start);
    const setStart = startDragTime.value + realStart;
    emit("setStart", setStart);
    const d = new Date((realStart + props.ts_start) / 1000);
    hoverTxt.value = d.toUTCString();
  }
};

const _onMouseUp = () => {
  mouseDown.value = false;
};

const _onMouseDown = (e) => {
  mouseDown.value = true;
  const cCoord = iCanvas.value.getBoundingClientRect();
  const cClickOffset = e.clientX - cCoord.left;
  clickX.value = e.clientX;

  const realStart =
    (cClickOffset / scrubberCWidth.value) * (props.ts_end - props.ts_start);
  emit("setStart", realStart + props.ts_start);
  startDragTime.value = realStart + props.ts_start;
};

const _onMouseEnter = () => {
  mouseDown.value = false;
};

const _onMouseOut = () => {
  hoverTxt.value = "";
};

// Annotation Functions
const pageInGap = (startEpoch, pageSize) => {
  // Implementation needed
};

const initSegmentSpans = () => {
  // Validate that we have the required data before making API calls
  if (!viewerStore.viewerChannels || viewerStore.viewerChannels.length === 0) {
    console.warn(
      "TSScrubber: Cannot init segment spans - no viewer channels available"
    );
    return;
  }

  if (!props.ts_start || !props.ts_end) {
    console.warn("TSScrubber: Cannot init segment spans - invalid time range");
    return;
  }

  if (!props.config?.timeSeriesApi) {
    console.warn(
      "TSScrubber: Cannot init segment spans - no timeSeriesApi configured"
    );
    return;
  }

  console.log(
    `TSScrubber: Initializing segment spans for ${viewerStore.viewerChannels.length} channels`
  );

  // Reset segment state before fetching new data
  resetSegmentState();

  // GET SEGMENTS AND GAPS
  const fetchSpan = Math.min(
    props.constants["SEGMENTSPAN"],
    props.ts_end - props.ts_start
  );
  const vChans = viewerStore.viewerChannels;

  for (let i = 0; i < vChans.length; i++) {
    _requestSegmentSpan(
      vChans[i].id,
      i,
      props.ts_start,
      props.ts_start + fetchSpan,
      0
    );
  }
};

const _requestSegmentSpan = async (channel, channelIdx, start, end, ix) => {
  const max_recursion = props.constants["MAXRECURSION"];

  // Validate inputs before making API call
  if (!props.config?.timeSeriesApi) {
    console.warn(
      "TSScrubber: Cannot request segment span - no timeSeriesApi configured"
    );
    return;
  }

  if (!channel) {
    console.warn(
      "TSScrubber: Cannot request segment span - no channel ID provided"
    );
    return;
  }

  try {
    const token = await useGetToken();
    const url = `${props.config.timeSeriesApi}/ts/retrieve/segments?session=${token}&channel=${channel}&start=${start}&end=${end}`;

    console.log(
      `TSScrubber: Fetching segments for channel ${channel} (${channelIdx})`
    );
    const resp = await useSendXhr(url);

    // Validate that we still have the same channels (user might have switched packages)
    if (
      !viewerStore.viewerChannels[channelIdx] ||
      viewerStore.viewerChannels[channelIdx].id !== channel
    ) {
      console.warn(
        "TSScrubber: Channel mismatch detected, ignoring segment response (likely package switched)"
      );
      return;
    }

    // Parse response into vector
    let vector = new Array(resp.length * 2);
    let i = 0;
    for (let j = 0; j < resp.length; j++) {
      vector[i] = resp[j][0];
      vector[i + 1] = resp[j][1];
      i = i + 2;

      // append to global
      const pxStart = Math.floor(
        ((resp[j][0] - props.ts_start) / (props.ts_end - props.ts_start)) * 5000
      );
      const pxEnd = Math.ceil(
        ((resp[j][1] - props.ts_start) / (props.ts_end - props.ts_start)) * 5000
      );
      segments.value.fill(1, pxStart, pxEnd);
    }

    // Find Global spans
    let ii = 0;
    let inSegment = false;
    let startSegment = 0;
    segmentSpans.value = [];
    while (ii < segments.value.length - 1) {
      if (!segments.value[ii] && !inSegment) {
        ii++;
        continue;
      } else if (!segments.value[ii]) {
        // create segment
        segmentSpans.value = segmentSpans.value.concat([startSegment, ii]);
        inSegment = false;
      } else if (!inSegment) {
        startSegment = ii;
        inSegment = true;
      }
      ii++;
    }

    if (inSegment) {
      segmentSpans.value = segmentSpans.value.concat([startSegment, ii]);
    }
    segmentSpans.value = segmentSpans.value.concat([5000]);

    // remove first value if there is overlap with previous request
    let firstValue = vector[0];
    let chConfig = viewerStore.viewerChannels[channelIdx];

    // Double-check that the channel still exists and matches
    if (!chConfig || chConfig.id !== channel) {
      console.warn(
        "TSScrubber: Channel configuration mismatch, skipping update"
      );
      return;
    }

    if (firstValue < chConfig.dataSegments[chConfig.dataSegments.length - 1]) {
      vector.shift();
      vector.shift();
    }

    chConfig.dataSegments = chConfig.dataSegments.concat(
      vector.sort((a, b) => a - b)
    );

    // Update channel in store
    viewerStore.updateChannelProperty(
      chConfig.id,
      "dataSegments",
      chConfig.dataSegments
    );

    // If we did not request all segment-spans yet, get next segment or bail when recursion limit.
    let span = end - start;
    if (start + span < props.ts_end && ix < max_recursion) {
      _requestSegmentSpan(channel, channelIdx, end, end + span, ix + 1);
    } else {
      renderSegments();
    }
  } catch (err) {
    console.error(
      `TSScrubber: Error fetching segments for channel ${channel}:`,
      err
    );
    useHandleXhrError(err);
  }
};

const getAnnotations = async () => {
  // Store the viewer ID at the start to check consistency later
  const currentViewerId = props.activeViewer?.content?.id;

  // Validate that we have the required data before making API call
  if (!currentViewerId) {
    console.warn("TSScrubber: Cannot get annotations - no active viewer ID");
    annotations.value = [];
    return;
  }

  if (!props.config?.apiUrl) {
    console.warn("TSScrubber: Cannot get annotations - no API URL configured");
    annotations.value = [];
    return;
  }

  if (
    !viewerStore.viewerAnnotations ||
    viewerStore.viewerAnnotations.length === 0
  ) {
    console.log(
      "TSScrubber: No annotation layers available, skipping annotation fetch"
    );
    annotations.value = [];
    render();
    return;
  }

  try {
    const token = await useGetToken();
    const layerIds = map((obj) => obj.id, viewerStore.viewerAnnotations);
    const endTime = props.ts_end;
    const baseUrl = `${props.config.apiUrl}/timeseries/${currentViewerId}/annotations/window`;
    let url =
      baseUrl +
      `?api_key=${token}&aggregation=count&start=${props.ts_start}&end=${props.ts_end}&period=${period.value}&mergePeriods=true`;

    for (let i in layerIds) {
      url = url + `&layerIds=${layerIds[i]}`;
    }

    console.log(
      `TSScrubber: Fetching annotations for viewer ${currentViewerId}`
    );
    const resp = await useSendXhr(url);

    // Double-check that we're still on the same viewer (async operations can be overtaken)
    if (props.activeViewer?.content?.id === currentViewerId) {
      annotations.value = resp;
      render();
    } else {
      console.log(
        "TSScrubber: Ignoring annotation response - viewer changed during fetch"
      );
    }
  } catch (err) {
    console.error("TSScrubber: Error fetching annotations:", err);
    annotations.value = [];
    useHandleXhrError(err);
    render(); // Still render even if annotations failed
  }
};

// Render Functions
const render = () => {
  renderViewPort();
  renderTimelimeLine();
  renderSegments();
};

const renderViewPort = () => {
  nextTick(() => {
    const canvas = iCanvas.value;
    if (!canvas) {
      console.warn("iCanvas ref is missing, skipping render");
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("2D context is not available");
      return;
    }
    ctx.setTransform(pixelRatio.value, 0, 0, pixelRatio.value, 0, 0);
    ctx.clearRect(0, 0, props.cWidth, viewportHeight.value);

    cStart.value =
      (((props.start - props.ts_start) / (props.ts_end - props.ts_start)) *
        props.cWidth +
        0.5) |
      0;
    cDuration.value =
      ((props.duration / (props.ts_end - props.ts_start)) * props.cWidth +
        0.5) |
      0;

    // Viewport
    ctx.fillStyle = "rgb(80,80,80)";
    ctx.strokeStyle = "rgb(80,80,80)";
    ctx.strokeRect(
      cStart.value + 0.5,
      0.5,
      cDuration.value,
      viewportHeight.value - 1
    );

    ctx.fillRect(cStart.value - 2, (viewportHeight.value / 2 - 5) | 0, 2, 10);
    ctx.fillRect(
      cStart.value + cDuration.value + 1,
      (viewportHeight.value / 2 - 5) | 0,
      2,
      10
    );

    // Cursor
    const cursorCLoc = cStart.value + props.cursorLoc * cDuration.value;
    if (cursorCLoc > cStart.value + 0.5) {
      ctx.strokeStyle = "red";
      ctx.beginPath();
      ctx.moveTo(cursorCLoc, 0);
      ctx.lineTo(cursorCLoc, viewportHeight.value - 1);
      ctx.stroke();
    }
  });
};

const renderSegments = () => {
  nextTick(() => {
    const canvas = segmentsCanvas.value;
    if (!canvas) {
      console.warn("segmentsCanvas ref is missing, skipping renderSegments");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn(
        "Unable to get 2D context for segmentsCanvas, skipping renderSegments"
      );
      return;
    }
    ctx.setTransform(pixelRatio.value, 0, 0, pixelRatio.value, 0, 0);
    ctx.fillStyle = ctx.createPattern(patternCnvs.value, "repeat");
    ctx.clearRect(0, 0, props.cWidth, viewportHeight.value);

    for (let i = 1; i < segmentSpans.value.length; i += 2) {
      const xStart = (props.cWidth * segmentSpans.value[i]) / 5000;
      const xEnd = (props.cWidth * segmentSpans.value[i + 1]) / 5000;
      ctx.fillRect(xStart, 2, xEnd - xStart, viewportHeight.value - 6);
    }
  });
};

const renderTimelimeLine = () => {
  const canvas = annotationCanvas.value;
  if (!canvas) {
    console.warn(
      "annotationCanvas ref is missing, skipping renderTimelimeLine"
    );
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.warn(
      "Unable to get 2D context for annotationCanvas, skipping renderTimelimeLine"
    );
    return;
  }
  ctx.setTransform(pixelRatio.value, 0, 0, pixelRatio.value, 0, 0);

  ctx.clearRect(0, 0, props.cWidth, scrubberHeight.value);
  const xStart = props.ts_start;
  const xEnd = props.ts_end;

  const annotationLayers = annotations.value;
  let annotationIndex = 0;

  const layerSpacing = 0;
  const layerHeight = Math.floor(
    (scrubberHeight.value - 2) / Object.keys(annotationLayers).length -
      layerSpacing
  );
  const annPanelLayers = viewerStore.viewerAnnotations;

  let color = "rgb(0,0,0)";
  for (const annotation in annotationLayers) {
    if (annotationLayers.hasOwnProperty(annotation)) {
      // find color
      for (let i = 0; i < annPanelLayers.length; i++) {
        if (annPanelLayers[i].id === parseInt(annotation)) {
          annotationIndex = i;
          color = annPanelLayers[i].color;
          break;
        }
      }

      plotAnnotations(
        ctx,
        xStart,
        xEnd,
        layerSpacing,
        layerHeight,
        annotationLayers[annotation],
        annotationIndex,
        color
      );
    }
  }
};

const plotAnnotations = (
  ctx,
  xStart,
  xEnd,
  layerSpacing,
  layerHeight,
  annotations,
  rank,
  color
) => {
  nextTick(() => {
    ctx.setTransform(pixelRatio.value, 0, 0, pixelRatio.value, 0, 0);
    ctx.fillStyle = color;
    for (let i = 0; i < annotations.length; i++) {
      if (annotations[i].value > 0) {
        const xPosStart =
          ((annotations[i].start - xStart) / (xEnd - xStart)) * props.cWidth;
        const xPosEnd =
          ((annotations[i].end - xStart) / (xEnd - xStart)) * props.cWidth;
        let cw = xPosEnd - xPosStart;
        if (cw < 1) {
          cw = 1;
        }
        const yPos = 1 + rank * (layerHeight - 1 + layerSpacing) + rank;
        ctx.fillRect(xPosStart, yPos, cw, layerHeight);
      }
    }
  });
};

const createPinstripeCanvas = () => {
  const patternCanvas = document.createElement("canvas");
  const pctx = patternCanvas.getContext("2d", { antialias: true });
  const colour = "rgb(220,220,220)";

  const CANVAS_SIDE_LENGTH = 5;
  const WIDTH = CANVAS_SIDE_LENGTH;
  const HEIGHT = CANVAS_SIDE_LENGTH;
  const DIVISIONS = 10;

  patternCanvas.width = WIDTH;
  patternCanvas.height = HEIGHT;
  pctx.fillStyle = colour;

  // Top line
  pctx.beginPath();
  pctx.moveTo(0, HEIGHT * (1 / DIVISIONS));
  pctx.lineTo(WIDTH * (1 / DIVISIONS), 0);
  pctx.lineTo(0, 0);
  pctx.lineTo(0, HEIGHT * (1 / DIVISIONS));
  pctx.fill();

  // Middle line
  pctx.beginPath();
  pctx.moveTo(WIDTH, HEIGHT * (1 / DIVISIONS));
  pctx.lineTo(WIDTH * (1 / DIVISIONS), HEIGHT);
  pctx.lineTo(0, HEIGHT);
  pctx.lineTo(0, HEIGHT * ((DIVISIONS - 1) / DIVISIONS));
  pctx.lineTo(WIDTH * ((DIVISIONS - 1) / DIVISIONS), 0);
  pctx.lineTo(WIDTH, 0);
  pctx.lineTo(WIDTH, HEIGHT * (1 / DIVISIONS));
  pctx.fill();

  // Bottom line
  pctx.beginPath();
  pctx.moveTo(WIDTH, HEIGHT * ((DIVISIONS - 1) / DIVISIONS));
  pctx.lineTo(WIDTH * ((DIVISIONS - 1) / DIVISIONS), HEIGHT);
  pctx.lineTo(WIDTH, HEIGHT);
  pctx.lineTo(WIDTH, HEIGHT * ((DIVISIONS - 1) / DIVISIONS));
  pctx.fill();

  return patternCanvas;
};

// Lifecycle
onMounted(() => {
  segments.value = new Array(5000);
  segments.value = segments.value.fill(0, 0, 4999);

  pixelRatio.value = getScreenPixelRatio();
  patternCnvs.value = createPinstripeCanvas();
  renderViewPort();
});

// Expose methods for parent component access
defineExpose({
  getAnnotations,
  initSegmentSpans,
  render,
  renderViewPort,
  renderSegments,
  renderTimelimeLine,
  resetComponentState,
  resetSegmentState,
  clearCanvases,
});
</script>

<style lang="scss" scoped>
@use "../../../styles/theme";

.timeseries-scrubber {
  background: theme.$white;
  padding: 0px 8px 8px 8px;
}

.dateWrap {
  padding: 8px 0;
  font-size: 12px;
  text-transform: uppercase;
  color: #71747c;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

#scrubber {
  background: theme.$white;
  box-shadow: 0 0 0px 1px #c5c5c5 inset;
  box-sizing: border-box;
  position: relative;
  display: flex;
}

#canvasWrap {
  height: 30px;
  position: relative;
}

.noselect {
  -webkit-touch-callout: none; /* iOS Safari */
  -webkit-user-select: none; /* Chrome/Safari/Opera */
  -khtml-user-select: none; /* Konqueror */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* Internet Explorer/Edge */
  user-select: none; /* Non-prefixed version, currently not supported by any browser */
}

.canvas {
  position: absolute;
  top: 0;
  left: 0;
  cursor: pointer;
}

.canvas[dragme] {
  cursor: move;
}

.canvas[resizeme] {
  cursor: ew-resize;
}

#annotationCanvas {
  margin-top: 1px;
}

#iCanvas {
  margin-left: 0px;
}
</style>
