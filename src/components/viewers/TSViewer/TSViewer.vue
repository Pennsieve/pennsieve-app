<template>
  <div
    id="ts_viewer"
    ref="ts_viewer"
    :class="[isPreview ? 'timeseries-viewer preview' : 'timeseries-viewer']"
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
      :config="config"
      :active-viewer="activeViewer"
      @setStart="updateStart"
    />

    <div id="channelCanvas">
      <!--       Channel labels-->
      <div id="channelLabels" ref="channelLabels">
        <div
          v-for="item in visibleChannels"
          :key="item.displayName"
          class="chLabelWrap"
          :data-id="item.id"
          @tap="onLabelTap"
        >
          <div :class="[item.selected ? 'labelDiv selected' : 'labelDiv']">
            {{ item.displayName }}
          </div>
          <div
            class="chLabelIndWrap"
            :hidden="hideLabelInfo"
            :class="[item.selected ? 'selected' : '']"
          >
            <div class="chLabelInd" :hidden="hideLabelInfo">
              {{ _computeLabelInfo(item, globalZoomMult, item.rowScale) }}
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
        @addAnnotation="onAddAnnotation"
        @updateAnnotation="onUpdateAnnotation"
      />
    </div>

    <TimeseriesViewerToolbar
      v-if="!isPreview"
      :constants="constants"
      :duration="duration"
      :start="start"
      :global-zoom-mult="globalZoomMult"
      @update:global-zoom-mult="globalZoomMult = $event"
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

    <TsViewerLayerWindow
      :visible="annotationLayerWindowOpen"
      @close-window="onCloseAnnotationLayerWindow"
      @create-layer="onCreateAnnotationLayer"
    />
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
  defineAsyncComponent,
} from "vue";
import { storeToRefs } from "pinia";
import { propOr, isEmpty } from "ramda";

import { useViewerStore } from "@/stores/tsviewer";
import { useTsAnnotation } from "@/composables/useTsAnnotation";

// Component imports (required for <script setup>)
const TimeseriesScrubber = defineAsyncComponent(() =>
  import("@/components/viewers/TSViewer/TSScrubber.vue")
);
const TimeseriesViewerCanvas = defineAsyncComponent(() =>
  import("@/components/viewers/TSViewer/TSViewerCanvas.vue")
);
const TimeseriesViewerToolbar = defineAsyncComponent(() =>
  import("@/components/viewers/TSViewer/TSViewerToolbar.vue")
);
const TimeseriesFilterModal = defineAsyncComponent(() =>
  import("@/components/viewers/TSViewer/TSFilterModal.vue")
);
const TimeseriesAnnotationModal = defineAsyncComponent(() =>
  import("@/components/viewers/TSViewer/TSAnnotationModal.vue")
);
const TsAnnotationDeleteDialog = defineAsyncComponent(() =>
  import(
    "@/components/viewers/TSViewer/TSAnnotationDeleteDialog/TsAnnotationDeleteDialog.vue"
  )
);
const TsViewerLayerWindow = defineAsyncComponent(() =>
  import("@/components/viewers/TSViewer/TSViewerLayerWindow.vue")
);
// Constants
const constants = {
  TIMEUNIT: "microSeconds", // Basis for time
  XOFFSET: 0, // X-offset of graph in canvas
  XGRIDSPACING: 1000000, // Time in microseconds between vertical lines
  NRPXPERLABEL: 150, // Number of pixels per label on x-axis
  USEREALTIME: true, // If true than interpret timepoints as UTC microseconds.
  DEFAULTDPI: 96, // Default pixels per inch
  ANNOTATIONLABELHEIGHT: 20, // Height of annotation label
  ROUNDDATAPIXELS: false, // If true, canvas point will be rounded to integer pixels for faster render (faster)
  MINMAXPOLYGON: true, // If true, then polygon is rendered thru minMax values, otherwise vertical lines (faster)
  PAGESIZEDIVIDER: 0.5, // Number of pages that span the current canvas.
  PREFETCHPAGES: 5, // Number of pages to read ahead of view.
  LIMITANNFETCH: 500, // Maximum number of annotations that are fetched per request
  USEMEDIAN: false, // Use Median instead of mean for centering channels
  CURSOROFFSET: 5, // Offset of cursor canvas
  SEGMENTSPAN: 1209600000000, // One week of gap-data is returned per request.
  MAXRECURSION: 20, // Maximum recursion depth of gap-data requests (max 2 years)
  MAXDURATION: 600000000, // Maximum duration window (5min)
  INITDURATION: 15000000, // Initial duration window  (15sec)
};

// Define props
const props = defineProps({
  pkg: {
    type: Object,
    default: () => {},
  },
  isPreview: {
    type: Boolean,
    default: false,
  },
  sidePanelOpen: {
    type: Boolean,
    default: false,
  },
});

// Store setup
const viewerStore = useViewerStore();
const { viewerChannels, needsRerender } = storeToRefs(viewerStore);

// TsAnnotation composable setup
const {
  addAnnotation,
  updateAnnotation,
  removeAnnotation,
  getChannelId: getChannelIdFromAnnotation,
} = useTsAnnotation();

// Template refs
const ts_viewer = ref(null);
const scrubber = ref(null);
const channelLabels = ref(null);
const viewerCanvas = ref(null);
const filterWindow = ref(null);
const annotationModal = ref(null);

// Reactive
const ts_start = ref(null);
const ts_end = ref(null);
const window_height = ref(0);
const window_width = ref(0);
const start = ref(0); // Start Timestamp of viewer in microseconds
const duration = ref(0); // Length of data in viewer in microseconds (ignore gaps)
const cWidth = ref(0);
const cHeight = ref(0);
const labelWidth = ref(0);
const globalZoomMult = ref(1);
const cursorLoc = ref(1 / 10);
const filterWindowOpen = ref(false);
const annotationWindowOpen = ref(false);
const annotationLayerWindowOpen = ref(false);
const annotationDelete = ref(null);
const isTsAnnotationDeleteDialogVisible = ref(false);

// Computed properties
const activeViewer = computed(() => props.pkg);
const viewerSidePanelOpen = computed(() => props.sidePanelOpen);
const config = computed(() => viewerStore.config);

const reactiveViewerChannels = computed(() => {
  return viewerChannels.value.map((channel) => ({
    ...channel,
    selected: Boolean(channel.selected),
  }));
});

const visibleChannels = computed(() => {
  return reactiveViewerChannels.value.filter((channel) => channel.visible);
});

const hideLabelInfo = computed(() => {
  let hide = false;
  if (cHeight.value / nrVisChannels.value < 30) {
    hide = true;
  }
  return hide;
});

const nrVisChannels = computed(() => {
  return visibleChannels.value.length;
});

// Methods that need to be defined early (used in watchers)
const onResize = async () => {
  console.log("onresize...");
  if (!ts_viewer.value) {
    return;
  }

  const element = document.getElementById("ts_viewer");
  if (!element) {
    return;
  }

  const style = window.getComputedStyle(element, null);
  const hhh = parseInt(style.getPropertyValue("height"));

  const toolbarOffset = props.isPreview ? 0 : 100;

  window_height.value = hhh - toolbarOffset;

  await nextTick();
  window_width.value = ts_viewer.value.offsetWidth;

  const labelDiv = channelLabels.value;
  if (!labelDiv) {
    return;
  }

  labelWidth.value = labelDiv.clientWidth;
  cWidth.value = window_width.value - labelDiv.clientWidth - 16;
  cHeight.value = window_height.value - 40;
};

// Watchers
watch(
  () => activeViewer.value,
  async (newValue, oldValue) => {
    if (scrubber.value?.resetComponentState) {
      scrubber.value.resetComponentState();
    }

    if (newValue && newValue.channels && newValue.channels.length > 0) {
      initTimeRange();
    }

    initCanvasRenderer();

    await nextTick();

    if (scrubber.value?.initSegmentSpans) {
      scrubber.value.initSegmentSpans();
    }
    if (scrubber.value?.getAnnotations) {
      scrubber.value.getAnnotations();
    }
  },
  { immediate: false, deep: true }
);

watch(
  viewerSidePanelOpen,
  () => {
    // Only call onResize if component is mounted and elements exist
    if (ts_viewer.value) {
      onResize();
    }
  },
  { immediate: false }
);

// Watch for changes in number of visible channels
watch(nrVisChannels, (newCount, oldCount) => {
  if (oldCount !== undefined && newCount !== oldCount) {
    console.log(
      `Number of visible channels changed from ${oldCount} to ${newCount}`
    );
    // Add a small delay to ensure DOM has updated
    setTimeout(() => {
      onResize();
      if (viewerCanvas.value?.renderAll) {
        viewerCanvas.value.renderAll();
      }
    }, 20);
  }
});

const openEditAnnotationDialog = (annotation) => {
  store.dispatch("viewerModule/setActiveAnnotation", annotation).then(() => {
    viewerCanvas.value.renderAnnotationCanvas();
    annotationWindowOpen.value = true;
  });
};

watch(
  needsRerender,
  (renderData) => {
    if (renderData) {
      console.log(
        `TSViewer: Re-rendering due to: ${renderData.cause} (${renderData.timestamp})`
      );

      nextTick(() => {
        // If channels visibility changed, we need to recalculate layout
        if (renderData.cause === "channel-visibility") {
          // Add a small delay to ensure DOM has fully updated after v-if changes
          setTimeout(() => {
            onResize();
            // Re-render after layout recalculation
            if (viewerCanvas.value?.renderAll) {
              viewerCanvas.value.renderAll();
            }
          }, 10);
        } else {
          if (viewerCanvas.value?.renderAll) {
            viewerCanvas.value.renderAll();
          }
        }
      });

      viewerStore.resetRerenderTrigger(null);
    }
  },
  { deep: true }
);

const onUpdateAnnotation = (annotation) => {
  openEditAnnotationDialog(annotation);
};

const onCreateUpdateAnnotation = async (annotation) => {
  console.log("📍 TSViewer: onCreateUpdateAnnotation received:", annotation);

  if (!annotation || Object.keys(annotation).length === 0) {
    console.error("🚨 TSViewer: Received empty annotation!");
    return;
  }

  // Validate required fields
  if (!annotation.layer_id) {
    console.error("🚨 TSViewer: annotation.layer_id is missing!", annotation);
    return;
  }

  annotationWindowOpen.value = false;

  try {
    if (annotation.id) {
      // FIX: Pass annotation parameter to composable
      console.log("📍 TSViewer: Updating annotation via composable");
      await updateAnnotation(annotation); // ✅ Pass the annotation!
      onAnnotationUpdated();
    } else {
      // FIX: Pass annotation parameter to composable
      console.log("📍 TSViewer: Creating annotation via composable");
      await addAnnotation(annotation); // ✅ Pass the annotation!
      onAnnotationCreated();
    }

    console.log("📍 TSViewer: Annotation operation completed successfully");
  } catch (error) {
    console.error("📍 TSViewer: Error creating/updating annotation:", error);

    // Re-open modal on error so user can retry
    annotationWindowOpen.value = true;
  }
};

const onAnnotationUpdated = () => {
  viewerCanvas.value.renderAnnotationCanvas();
};

const confirmDeleteAnnotation = (annotation) => {
  annotationDelete.value = annotation;
  isTsAnnotationDeleteDialogVisible.value = true;
};

const deleteAnnotation = async (annotation) => {
  isTsAnnotationDeleteDialogVisible.value = false;
  try {
    // FIX: The composable now has better validation
    await removeAnnotation(annotation);
    onAnnotationDeleted();
    console.log("📍 TSViewer: Annotation deleted successfully");
  } catch (error) {
    console.error("📍 TSViewer: Error deleting annotation:", error);
    // Show error to user
  }
};

const onAnnotationDeleted = () => {
  viewerCanvas.value.renderAnnotationCanvas();
};

const onAddAnnotation = (
  startTime,
  duration,
  allChannels,
  label,
  description,
  layer
) => {
  console.log("📍 TSViewer: onAddAnnotation called with:", {
    startTime,
    duration,
    allChannels,
    label,
    description,
    layer,
  });

  // Validate inputs
  if (!layer || !layer.id) {
    console.error("Invalid layer provided to onAddAnnotation:", layer);
    return;
  }

  // Get selected channels
  const selectedChannels = viewerStore.viewerSelectedChannels || [];
  const channelIds = allChannels ? [] : selectedChannels.map((ch) => ch.id);

  // Create the annotation object with proper structure
  const annotation = {
    id: null,
    label: label || "Event",
    description: description || "",
    start: Math.floor(startTime),
    end: Math.floor(startTime + duration),
    duration: Math.floor(duration),
    channelIds: channelIds,
    allChannels: allChannels,
    layer_id: layer.id,
    selected: true,
    userId: null,
  };

  console.log("📍 TSViewer: Created annotation object:", annotation);

  // Set the annotation in the store
  viewerStore.setActiveAnnotation(annotation);

  // Verify it was set
  console.log("📍 TSViewer: Store now contains:", viewerStore.activeAnnotation);

  // Open the modal
  annotationWindowOpen.value = true;
  console.log("📍 TSViewer: Modal opened with annotation data");
};

const onAnnotationCreated = () => {
  viewerCanvas.value.renderAnnotationCanvas();
};

const onCreateAnnotationLayer = (newLayer) => {
  viewerCanvas.value.createAnnotationLayer(newLayer);
};

const onCloseAnnotationLayerWindow = () => {
  annotationLayerWindowOpen.value = false;
};

const onCloseAnnotationWindow = () => {
  viewerCanvas.value.resetFocusedAnnotation();
  viewerCanvas.value.renderAnnotationCanvas();
  annotationWindowOpen.value = false;
};

const onCloseFilterWindow = () => {
  filterWindowOpen.value = false;
};

const onLabelTap = (e) => {
  e.stopPropagation();
  e.preventDefault();

  const append = e.detail.sourceEvent.metaKey;
  selectChannel({ channelId: e.currentTarget.dataset.id, append: append });
  viewerCanvas.value.renderAll();
};

const onNextAnnotation = () => {
  start.value = viewerCanvas.value.getNextAnnotation();
};

const onPreviousAnnotation = () => {
  start.value = viewerCanvas.value.getPreviousAnnotation();
};

const onUpdateDuration = (value) => {
  setDuration(value * 1e6);
};

const onIncrementZoom = () => {
  globalZoomMult.value = globalZoomMult.value * 1.25;
};

const onDecrementZoom = () => {
  globalZoomMult.value = globalZoomMult.value * 0.8;
};

const onAnnLayersInitialized = () => {
  scrubber.value.getAnnotations();
};

const onChannelsInitialized = () => {
  console.log("Channels Initialized in TSViewer");

  // Set Vertical Scale in toolbar based on first visible channel
};

const onPageBack = () => {
  console.log("Page forward triggered from toolbar");

  // Calculate new start position (go back by current duration)
  const newStart = Math.max(
    start.value - (3 / 4) * duration.value,
    ts_start.value
  );

  updateStart(newStart);

  // Trigger re-render
  nextTick(() => {
    viewerCanvas.value?.renderAll();
  });
};

const onPageForward = () => {
  console.log("Page forward triggered from toolbar");

  // Calculate new start position
  const newStart = Math.min(
    start.value + (3 / 4) * duration.value,
    ts_end.value - duration.value
  );

  console.log(`Moving from ${start.value} to ${newStart}`);

  // Update start position
  updateStart(newStart);

  // Force canvas to invalidate cache and fetch new data
  nextTick(() => {
    if (viewerCanvas.value?.invalidate) {
      viewerCanvas.value.invalidate();
    }
    if (viewerCanvas.value?.renderAll) {
      viewerCanvas.value.renderAll();
    }
  });
};

const selectAnnotation = (payload) => {
  let rsPeriod = viewerCanvas.value.rsPeriod;
  updateStart(
    payload.annotation.start -
      (cursorLoc.value * cWidth.value - constants.CURSOROFFSET) * rsPeriod
  );

  // Trigger re-render
  nextTick(() => {
    viewerCanvas.value?.renderAll();
  });
};

const selectChannel = (payload) => {
  const _channels = viewerChannels.value.map((channel) => {
    const selected = channel.selected;

    if (payload.append === false) {
      channel.selected = false;
    }

    if (payload.channelId === channel.id) {
      channel.selected = !selected;
    }

    return channel;
  });

  viewerStore.setChannels(_channels);
};

const selectChannels = (ids, append) => {
  const channels = viewerChannels.value.map((channel) => {
    if (append === false) {
      channel.selected = false;
    }
    if (channel.id in ids) {
      channel.selected = true;
    }
    return channel;
  });

  viewerStore.setChannels(channels);
};

const updateStart = (value) => {
  start.value = value;
};

const setCursor = (value) => {
  // set the cursor location as a fraction of the width of the canvas
  cursorLoc.value = value;
};

const setGlobalZoom = (value) => {
  globalZoomMult.value = value;
};

const setDuration = (value) => {
  if (value > constants.MAXDURATION) {
    duration.value = constants.MAXDURATION;
  } else {
    duration.value = value;
  }
};

const getChannelId = (channel) => {
  // Use the method from the TsAnnotation composable
  return getChannelIdFromAnnotation(channel);
};

const verticalScale = (globalZoomMult, rowScale) => {
  return (
    (constants.DEFAULTDPI * window.devicePixelRatio) /
    (globalZoomMult * rowScale) /
    25.4
  ).toFixed(1);
};

const _computeLabelInfo = (item, globalZoomMult, rowscale) => {
  return verticalScale(globalZoomMult, rowscale) + " " + item.unit + "/mm";
};

const initTimeRange = () => {
  const channels = activeViewer.value?.channels;
  console.log("🔄 initTimeRange called with channels:", channels?.length || 0);

  if (channels && channels.length > 0) {
    // Find Global start and end from channel data
    ts_start.value = channels[0].content.start;
    ts_end.value = channels[0].content.end;

    for (let ic = 1; ic < channels.length; ic++) {
      if (channels[ic].content.start < ts_start.value) {
        ts_start.value = channels[ic].content.start;
      }
      if (channels[ic].content.end > ts_end.value) {
        ts_end.value = channels[ic].content.end;
      }
    }

    // Set the initial viewport to the actual data start time
    const oldStart = start.value;
    start.value = ts_start.value;

    console.log("📅 Time range initialized:", {
      ts_start: ts_start.value,
      ts_end: ts_end.value,
      oldStart: oldStart,
      newStart: start.value,
      duration: duration.value,
      startDate: new Date(ts_start.value / 1000).toISOString(),
      endDate: new Date(ts_end.value / 1000).toISOString(),
    });
  } else {
    console.warn("⚠️ initTimeRange: No channels found in activeViewer");
  }
};

// In TSViewer.vue - replace the initChannels method

const initChannels = () => {
  initTimeRange();
};

const openLayerWindow = (payload) => {
  annotationLayerWindowOpen.value = true;
};

const openFilterWindow = (payload) => {
  const channels = propOr([], "channels", payload);
  const filter = propOr("", "filter", payload);
  const filterWindowRef = filterWindow.value;
  filterWindowRef.onChannels = channels;

  if (!isEmpty(filter)) {
    filterWindowRef.input0 = filter.input0;
    filterWindowRef.input1 = filter.input1;
  } else {
    filterWindowRef.input0 = NaN;
    filterWindowRef.input1 = NaN;
    filterWindowRef.selectedFilter = null;
    filterWindowRef.selectedNotch = null;
  }
  filterWindowOpen.value = true;
};

const setTimeseriesFilters = (payload) => {
  viewerCanvas.value.setFilters(payload);
};

const initCanvasRenderer = () => {
  viewerCanvas.value?.initViewerCanvas();
  viewerCanvas.value?.renderAll();
};

// Lifecycle hooks
onMounted(() => {
  initChannels();

  const element = document.getElementById("ts_viewer");
  if (!element) {
    console.warn("ts_viewer element not found");
    return;
  }

  var style = window.getComputedStyle(element, null);
  const hhh = parseInt(style.getPropertyValue("height"));

  const toolbarOffset = props.isPreview ? 0 : 100;

  // Fetch the workspace montages
  viewerStore.fetchWorkspaceMontages();

  window_height.value = hhh - toolbarOffset;
  if (ts_viewer.value) {
    window_width.value = ts_viewer.value.offsetWidth;
  }
  window.addEventListener("resize", onResize);

  const labelDiv = channelLabels.value;
  if (labelDiv) {
    labelWidth.value = labelDiv.clientWidth;
    cWidth.value = window_width.value - labelDiv.clientWidth - 5 - 10;
    cHeight.value = window_height.value - 88;
  }
  duration.value = constants.INITDURATION;

  initCanvasRenderer();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
});

// Expose methods that might be called from parent components
defineExpose({
  openEditAnnotationDialog,
  confirmDeleteAnnotation,
  selectAnnotation,
  selectChannel,
  selectChannels,
  openLayerWindow,
  openFilterWindow,
  setTimeseriesFilters,
});
</script>

<style lang="scss" scoped>
@use "../../../styles/theme";

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
  color: rgb(150, 150, 150);
  text-align: right;
  white-space: nowrap;
}

.labelDiv {
  align-self: flex-end;
  white-space: nowrap;
  color: var(--neuron);

  &.selected {
    color: $orange_1 !important; /* Red color for selected channel labels */
    font-weight: 600; /* Make selected labels slightly bolder */
  }
}

.chLabelIndWrap[selected] {
  color: $purple_2;
}

.labelDiv {
  align-self: flex-end;
  white-space: nowrap;
  color: var(--neuron);
}
</style>
