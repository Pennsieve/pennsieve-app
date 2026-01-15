<template>
  <div class="timeseries-viewer-toolbar">
    <div id="left-controls">

      <el-input-number
        v-model="durationInSeconds"
        v-if="showTimeZoom"
        :precision="durationPrecision"
        :step="durationStep"
        :min="0.01"
        :max="constants['MAXDURATION']"
        controls-position="right">

        <template #suffix>
          seconds
        </template>

      </el-input-number>


        <el-input-number
          v-model="zoomMult"
          :precision="2"
          :step="5"
          controls-position="right">

          <template #suffix>
            uV/mm
          </template>
        </el-input-number>

    </div>

    <div id="center-controls">
      <el-tooltip
        placement="top-end"
        content="Page Back">
        <button
          class="btn-icon"
          @click="pageBack()">
          <IconPreviousPage
            :height="12"
            :width="12"/>
        </button>
      </el-tooltip>
      <el-tooltip
        placement="top-end"
        content="Previous Annotation">
        <button
          class="btn-icon"
          @click="previousAnnotation()">
          <IconNextAnnotationLeftFacing
            :height="12"
            :width="18"/>
        </button>
      </el-tooltip>
      <el-tooltip
        placement="top-end"
        content="Automatic Forward">
        <button
          class="btn-icon"
          @click="togglePlayback()">
          <component :is="iconPlay" :height="12"
                     :width="18"/>
        </button>
      </el-tooltip>
      <el-tooltip
        placement="top-end"
        content="Next Annotation">
        <button
          class="btn-icon"
          @click="nextAnnotation()">
          <IconNextAnnotationRightFacing
            name="next-annotation-right-facing"
            :height="12"
            :width="18"/>
        </button>
      </el-tooltip>
      <el-tooltip
        placement="top-end"
        content="Next Page">
        <button
          class="btn-icon"
          @click="pageForward()">
          <IconNextPage
            name="icon-next-page"
            :height="12"
            :width="18"/>
        </button>
      </el-tooltip>
    </div>
    <div id="right-controls">

      <el-tooltip
        placement="top-end"
        content="Toggle Play Back Speed Controls">
        <button
          class="btn-icon"
          @click="togglePlaybackSpeed()">
          <IconStopwatch
            :height="20"
            :width="22"/>
        </button>
      </el-tooltip>

      <el-select
        v-model="selectedPlaySpeed"
        v-if="showPlaybackSpeed"
        placeholder="Select"
        size="small"
        class="playSelect">
        <el-option
          v-for="item in playSpeedOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value">
        </el-option>
      </el-select>
    </div>
    <div>

    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import IconTimescale from "../../icons/IconTimeschale.vue"
import IconPreviousPage from "../../icons/IconPreviousPage.vue"
import IconNextAnnotationLeftFacing from "../../icons/IconNextAnnotationLeftFacing.vue"
import IconNextAnnotationRightFacing from "@/components/icons/IconNextAnnotationRightFacing.vue"
import IconNextPage from "../../icons/IconNextPage.vue"
import IconStopwatch from "../../icons/IconStopwatch.vue"
import IconControllerPlay from "@/components/icons/IconControllerPlay.vue"
import IconControllerPause from "@/components/icons/IconControllerPause.vue"

// Props
const props = defineProps({
  constants: {
    type: Object,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  start: {
    type: Number,
    required: true
  },
  globalZoomMult: {
    type: Number,
    required: true,
  }
})

const zoomMult = computed({
  get() {
    return  (((96 * window.devicePixelRatio) / (props.globalZoomMult * 1)) / 25.4)
  },
  set(newValue) {
    emit('update:globalZoomMult', (((96 * window.devicePixelRatio) / (newValue * 1)) / 25.4)); // Emit an event to update the parent
  },
});

// Emits
const emit = defineEmits([
  'pageBack',
  'pageForward',
  'incrementZoom',
  'decrementZoom',
  'updateDuration',
  'nextAnnotation',
  'previousAnnotation',
  'setStart',
  'update:globalZoomMult'
])


// Reactive data
const showVertZoom = ref(true)
const showTimeZoom = ref(true)
const showPlaybackSpeed = ref(true)
const selectedTimeRange = ref(0)
const isPlaying = ref(false)
const selectedPlaySpeed = ref(null)
const intervalTimer = ref(null)
const intervalPeriod = ref(150)
const intervalPage = ref(1000000)

const playSpeedOptions = [
  {
    value: 0.5,
    label: '0.5x'
  }, {
    value: 1,
    label: '1x'
  }, {
    value: 2,
    label: '2x'
  }, {
    value: 5,
    label: '5x'
  }, {
    value: 10,
    label: '10x'
  }
]

// Computed properties
const iconPlay = computed(() => {
  if (isPlaying.value === true) {
    return IconControllerPause
  } else {
    return IconControllerPlay
  }
})

// Store the previous value to detect direction of change
let previousDuration = ref(props.duration / 1e6)

const durationInSeconds = computed({
  // getter
  get() {
    return props.duration / 1e6
  },
  // setter
  set(newValue) {
    const currentValue = props.duration / 1e6
    const isIncreasing = newValue > currentValue
    const isDecreasing = newValue < currentValue
    
    // Ensure minimum value
    let validValue = Math.max(0.01, newValue)
    
    // Handle boundary transitions specially
    if (currentValue === 0.1 && isIncreasing) {
      validValue = 0.2 // Jump from 0.1 to 0.2 when increasing
    } else if (currentValue === 0.1 && isDecreasing) {
      validValue = 0.09 // Jump from 0.1 to 0.09 when decreasing
    } else if (currentValue === 1 && isIncreasing) {
      validValue = 2 // Jump from 1 to 2 when increasing
    } else if (currentValue === 1 && isDecreasing) {
      validValue = 0.9 // Jump from 1 to 0.9 when decreasing
    } else if (currentValue === 10 && isIncreasing) {
      validValue = 20 // Jump from 10 to 20 when increasing
    } else if (currentValue === 10 && isDecreasing) {
      validValue = 9 // Jump from 10 to 9 when decreasing
    } else {
      // Round to appropriate precision to avoid floating point issues
      if (validValue < 0.095) {
        validValue = Math.round(validValue * 100) / 100 // Round to 0.01
      } else if (validValue < 0.95) {
        validValue = Math.round(validValue * 10) / 10 // Round to 0.1
      } else if (validValue < 9.5) {
        validValue = Math.round(validValue) // Round to 1
      } else if (validValue < 95) {
        validValue = Math.round(validValue / 10) * 10 // Round to 10
      } else {
        validValue = Math.round(validValue / 100) * 100 // Round to 100
      }
    }
    
    previousDuration.value = validValue
    emit('updateDuration', validValue)
  }
})

// Dynamic step size based on current duration
const durationStep = computed(() => {
  const currentDuration = durationInSeconds.value
  
  // Regular step logic
  if (currentDuration < 0.1) {
    return 0.01 // Step by 0.01 second below 0.1 second
  } else if (currentDuration < 1) {
    return 0.1 // Step by 0.1 second below 1 second
  } else if (currentDuration < 10) {
    return 1 // Step by 1 second below 10 seconds
  } else if (currentDuration < 100) {
    return 10 // Step by 10 seconds below 100 seconds
  } else {
    return 100 // Step by 100 seconds for 100+ seconds
  }
})

// Dynamic precision based on current duration
const durationPrecision = computed(() => {
  const currentDuration = durationInSeconds.value
  if (currentDuration < 1) {
    return 2 // Show 2 decimal places below 1 second (0.01, 0.10, etc.)
  } else if (currentDuration < 10) {
    return 1 // Show 1 decimal place below 10 seconds (1.0, 2.0, etc.)
  } else {
    return 0 // Show whole seconds for 10+ seconds
  }
})


const toggleTimeZoom = () => {
  showTimeZoom.value = !showTimeZoom.value
}

const toggleVerticalZoom = () => {
  showVertZoom.value = !showVertZoom.value
}

const togglePlaybackSpeed = () => {
  showPlaybackSpeed.value = !showPlaybackSpeed.value
}

const togglePlayback = () => {
  if (isPlaying.value === false) {
    startPlay()
  } else {
    stopPlay()
  }
}

const pageBack = () => {
  emit('pageBack')
}

const pageForward = () => {
  emit('pageForward')
}

const incrementZoom = () => {
  emit('incrementZoom')
}

const decrementZoom = () => {
  emit('decrementZoom')
}

const updateDuration = () => {
  emit('updateDuration', selectedTimeRange.value)
}

const nextAnnotation = () => {
  emit('nextAnnotation')
}

const previousAnnotation = () => {
  emit('previousAnnotation')
}

const startPlay = () => {
  isPlaying.value = true
  const intervalTimerFnc = () => {
    emit('setStart', props.start + (intervalPage.value * selectedPlaySpeed.value))
    intervalTimer.value = setTimeout(intervalTimerFnc, intervalPeriod.value)
  }
  intervalTimer.value = setTimeout(intervalTimerFnc, intervalPeriod.value)
}

const stopPlay = () => {
  isPlaying.value = false
  intervalPeriod.value = 150
  clearInterval(intervalTimer.value)
}

// Lifecycle
onMounted(() => {
  selectedPlaySpeed.value = 1
})
</script>

<style lang="scss" scoped>
@use '../../../styles/theme';

.el-input-number {
  width: 180px;
  margin: 0 8px
}

.timeseries-viewer-toolbar {
  border-top: 1px solid #DADADA;
  background: #F7F7F7;
  display: flex;
  padding: 8px 0;
  width: 100%;
  justify-content: space-between;
  align-items: center;
}

.btn-icon {
  color: theme.$gray_4;
  margin-left: 8px;
  margin-right: 2px;
  &:last-child {
    margin-right: 8px;
  }
  &.selected, &:hover, &[focused] {
    color: theme.$app-primary-color;
  }
  &[disabled] {
    color: theme.$gray_2;
  }
}

.playSelect {
  width: 70px;
  margin-right: 8px;
}

#right-controls {
  display: flex;
  align-items: center;
  height: 42px;
}
</style>

<style lang="scss">
.playSelect .el-input__inner {
  padding: 8px 4px;
}

.timeseries-viewer-toolbar .el-input-number.is-controls-right {
  .el-input-number__decrease, .el-input-number__increase {
    height: 20px; // since el-input__inner has height of 40px from _el-input.scss
  }
}
</style>