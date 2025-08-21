<template>
  <el-dialog
    class="timeseries-annotation-modal"
    ref="annotation-modal"
    :title="dialogTitle"
    :modelValue="localVisible"
    @update:modelValue="
      (value) => {
        localVisible = value;
        if (!value) emit('closeWindow');
      }
    "
    @close="close"
    @closed="onClosed"
  >
    <div slot="body">
      <div class="select-wrapper">
        <div class="range-type-selector">
          <div class="select-label">Range?</div>
          <el-switch
            v-model="hasRangeValue"
            active-color="#5039F7"
            inactive-color="#CAC5BF"
          >
          </el-switch>
        </div>

        <el-date-picker
          v-model="selectedRange"
          class="date-time-picker"
          :type="datePickerType"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="x"
          range-separator="To"
          start-placeholder="Start date/time"
          end-placeholder="End date/time"
        >
        </el-date-picker>
      </div>
      <div class="select-wrapper">
        <div>
          <div class="select-label">Annotation Layer</div>
          <el-select v-model="activeAnnotation.layer_id" placeholder="Select">
            <el-option
              v-for="item in viewerAnnotations"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            >
            </el-option>
          </el-select>
        </div>
        <div>
          <div class="select-label">Annotation Type</div>
          <el-select v-model="activeAnnotation.label" placeholder="Select">
            <el-option
              v-for="item in defaultLabels"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            >
            </el-option>
          </el-select>
        </div>
      </div>

      <div class="description-wrapper">
        <div class="select-label">Description</div>
        <el-input
          ref="input"
          v-model="activeAnnotation.description"
          placeholder="Please provide additional information..."
          type="textarea"
          :rows="5"
        />
      </div>
    </div>

    <div slot="footer">
      <div class="button-wrapper">
        <div class="channels-selected">
          <IconSelection class="inline-icon" :height="16" :width="16" />

          {{ channelSelectionStr }}
        </div>
        <div class="buttons">
          <bf-button @click="submitForm"> {{ actionButtonText }} </bf-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, defineAsyncComponent } from "vue";
import { propOr } from "ramda";
import { useViewerStore } from "@/stores/tsviewer.js";
import { storeToRefs } from "pinia";
import IconSelection from "../../icons/IconSelection.vue";

// Async component imports
const BfButton = defineAsyncComponent(() =>
  import("@/components/shared/bf-button/BfButton.vue")
);

// Define props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
});

const localVisible = ref(false);

watch(
  () => props.visible,
  (newValue) => {
    localVisible.value = newValue;

    if (!newValue) return;

    // Convert microseconds to milliseconds for JavaScript Date
    // Assuming annotation times are stored in microseconds
    const startMs = activeAnnotation.value.start / 1000;
    const endMs = activeAnnotation.value.end / 1000;

    initialTimeRange.value = {
      start: activeAnnotation.value.start,
      end: activeAnnotation.value.end,
    };

    if (activeAnnotation.value.duration == 0) {
      hasRangeValue.value = false;
      selectedRange.value = startMs;
    } else {
      hasRangeValue.value = true;
      selectedRange.value = [startMs, endMs];
    }
  },
  { immediate: true }
);

// Define emits
const emit = defineEmits(["closeWindow", "createUpdateAnnotation"]);

// Pinia store setup
const viewerStore = useViewerStore();
const { activeAnnotation, viewerChannels, viewerAnnotations } =
  storeToRefs(viewerStore);

// Template refs
const annotationModal = ref(null);
const input = ref(null);

// Reactive data
const isProcessing = ref(false);
const selectedRange = ref(null);
const initialTimeRange = ref({
  start: 0,
  end: 0,
});
const hasRangeValue = ref(true);

const defaultLabels = ref([
  { value: "Event", label: "Event" },
  { value: "Artifact", label: "Artifact" },
  { value: "Seizure", label: "Seizure" },
  { value: "Mark", label: "Mark" },
  { value: "Stim On", label: "Stim On" },
  { value: "Stim Off", label: "Stim Off" },
  { value: "Start", label: "Start" },
  { value: "Stop", label: "Stop" },
]);

// Computed properties
const dialogTitle = computed(() => {
  return activeAnnotation.value.id ? "Edit Annotation" : "Create Annotation";
});

const actionButtonText = computed(() => {
  return activeAnnotation.value.id ? "Update" : "Create";
});

const datePickerType = computed(() => {
  return hasRangeValue.value ? "datetimerange" : "datetime";
});

const channelSelectionStr = computed(() => {
  let str = "";
  if (activeAnnotation.value.allChannels) {
    str = "Adding to all channels";
  } else if (propOr([], "channelIds", activeAnnotation.value).length == 1) {
    str = "Adding to single channel";
  } else {
    str = `Adding to ${
      propOr([], "channelIds", activeAnnotation.value).length
    } channels`;
  }
  return str;
});

// Watchers
watch(
  () => props.visible,
  (newValue) => {
    if (!newValue) return;

    // Convert microseconds to milliseconds for JavaScript Date
    // Assuming annotation times are stored in microseconds
    const startMs = activeAnnotation.value.start / 1000;
    const endMs = activeAnnotation.value.end / 1000;

    initialTimeRange.value = {
      start: activeAnnotation.value.start,
      end: activeAnnotation.value.end,
    };

    if (activeAnnotation.value.duration == 0) {
      hasRangeValue.value = false;
      selectedRange.value = startMs;
    } else {
      hasRangeValue.value = true;
      selectedRange.value = [startMs, endMs];
    }
  }
);

watch(hasRangeValue, (value) => {
  // Convert microseconds to milliseconds for the date picker
  const startMs = activeAnnotation.value.start / 1000;
  const endMs = activeAnnotation.value.end / 1000;

  if (value) {
    // Range mode: set array of start and end times
    selectedRange.value = [startMs, endMs];
  } else {
    // Single point mode: set duration to 0 and use start time
    activeAnnotation.value.duration = 0;
    selectedRange.value = startMs;
  }
});

// Methods
const submitForm = () => {
  // Validate inputs before proceeding
  if (!activeAnnotation.value.layer_id) {
    console.error("No layer selected for annotation");
    return;
  }

  if (!selectedRange.value) {
    console.error("No time range selected for annotation");
    return;
  }

  // Update active annotation object
  if (hasRangeValue.value) {
    // Convert milliseconds back to microseconds
    // selectedRange is [startMs, endMs] in range mode
    if (Array.isArray(selectedRange.value) && selectedRange.value.length >= 2) {
      activeAnnotation.value.start = selectedRange.value[0] * 1000;
      activeAnnotation.value.end = selectedRange.value[1] * 1000;
      activeAnnotation.value.duration =
        activeAnnotation.value.end - activeAnnotation.value.start;
    } else {
      console.error("Invalid range value for range mode:", selectedRange.value);
      return;
    }
  } else {
    // Convert milliseconds back to microseconds
    // selectedRange is a single timestamp in single point mode
    if (typeof selectedRange.value === "number") {
      activeAnnotation.value.start = selectedRange.value * 1000;
      activeAnnotation.value.end = selectedRange.value * 1000;
      activeAnnotation.value.duration = 0;
    } else {
      console.error("Invalid range value for point mode:", selectedRange.value);
      return;
    }
  }

  // Use Pinia store instead of Vuex dispatch
  viewerStore.setActiveAnnotation(activeAnnotation.value);
  emit("createUpdateAnnotation", activeAnnotation.value);

  // Close the modal
  close();
};

const close = () => {
  localVisible.value = false;
  emit("closeWindow");
};

const onClosed = () => {
  isProcessing.value = false;
};

const getUTCDateString = (d) => {
  if (d > 0) {
    d = new Date(d / 1000);
    return d.toDateString();
  } else {
    return "unknown";
  }
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

// Register components
const components = {
  IconSelection,
  "bf-button": BfButton,
};
</script>

<style lang="scss" scoped>
@use "../../../styles/theme";

.timeseries-annotation-modal {
  display: block;
  box-sizing: border-box;
}

.select-wrapper {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 16px;
  align-items: center;
}

.description-wrapper {
}

.button-wrapper {
  min-width: 500px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.channels-selected {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.date-time-picker {
  width: 100%;
}

.select-label {
  font-weight: 500;
  margin-bottom: 5px;
}

.inline-icon {
  margin-right: 8px;
}

.range-type-selector {
  margin-right: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mb-16 {
  color: theme.$red_1;
}

h2 {
  color: #000;
  font-size: 14px;
  list-style: 16px;
  margin: 0 0 8px;
}

.layerSelect {
}
</style>
