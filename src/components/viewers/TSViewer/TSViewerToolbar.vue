<template>
  <div class="timeseries-viewer-toolbar">
    <div id="left-controls">
      <el-tooltip
        placement="top-end"
        content="Toggle Time Zoom Controls">
        <button
          class="btn-icon"
          @click="toggleTimeZoom()">
          <IconTimescale
            :height="20"
            :width="20"/>
        </button>
      </el-tooltip>

      <el-input-number
        v-model="durationInSeconds"
        v-if="showTimeZoom"
        :precision="1"
        :step="5"
        :max="constants['MAXDURATION']"
        controls-position="right">
      </el-input-number>

      <el-tooltip
        placement="top-end"
        content="Toggle Vertical Zoom Controls">
        <button
          class="btn-icon"
          @click="toggleVerticalZoom()">
        </button>
      </el-tooltip>

      <el-button-group v-if="showVertZoom">
        <el-button icon="el-icon-plus" size="small" @click="incrementZoom"></el-button>
        <el-button icon="el-icon-minus" size="small" @click="decrementZoom"></el-button>
      </el-button-group>
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
  }
})

// Emits
const emit = defineEmits([
  'pageBack',
  'pageForward',
  'incrementZoom',
  'decrementZoom',
  'updateDuration',
  'nextAnnotation',
  'previousAnnotation',
  'setStart'
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

const durationInSeconds = computed({
  // getter
  get() {
    return props.duration / 1e6
  },
  // setter
  set(newValue) {
    emit('updateDuration', newValue)
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