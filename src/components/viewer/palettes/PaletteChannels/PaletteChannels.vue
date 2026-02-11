<template>
  <div class="palette-channels">
    <div
      class="channels-heading"
      :class="{ 'all-visible': allVisible }"
    >
      <div class="left">
        {{ selectedString }}
      </div>
      <div class="right">
        <el-tooltip
          placement="top"
          content="Filter all channels"
          :popper-options="{ boundariesElement: 'window' }"
          :show-after="300"
        >
          <button
            class="mr-8"
            @click.stop="openFilterMenu"
          >
            <IconFilterFilled
              class="menu-item"
              :height="20"
              :width="20"
            />
          </button>
        </el-tooltip>
        <el-tooltip
          placement="top"
          :content="toggleVisibilityString"
          :popper-options="{ boundariesElement: 'window' }"
          :show-after="300"
        >
          <button @click="toggleAllVisibility">
            <IconEyeball
              class="menu-item"
              :height="20"
              :width="20"
            />
          </button>
        </el-tooltip>
      </div>

    </div>

    <div class="channel-wrap">
      <accordion
        v-for="(channelType, index) in channelTypes"
        :key="channelType"
        :ref="`accordion-${channelType}`"
        icon="blackfynn:chevron-down-small"
        :border-color="channelColorMap[channelType]"
        :title="channelType"
        :window-height="windowHeight"
        :default-open="index === 0"
      >
        <template #items>
          <div>
            <bf-channel
              v-for="channel in getChannelsByType(channelType)"
              :key="channel.id"
              :channel="channel"
              @channel-selected="onChannelSelected"
              @channel-visibility-toggled="onChannelVisibilityToggled"
            />
          </div>
        </template>
      </accordion>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useStore } from 'vuex'
import {
  compose,
  uniq,
  pluck,
  pathEq,
  propOr
} from 'ramda'

import { useViewerInstance } from '@/composables/useViewerInstance'
import Accordion from '../../../shared/Accordion/Accordion.vue'
import BfChannel from './BfChannel.vue'
import BfButton from '../../../shared/bf-button/BfButton.vue'
import EventBus from '../../../../utils/event-bus'
import IconFilterFilled from "../../../icons/IconFilterFilled.vue"
import IconEyeball from "../../../icons/IconEyeball.vue"
import IconPencil from "../../../icons/IconPencil.vue"
import { useGetToken } from "@/composables/useGetToken"
import { useSendXhr } from "@/mixins/request/request_composable"

// Props
const props = defineProps({
  windowHeight: {
    type: Number,
    default: 0
  },
  activeViewer: {
    type: Object,
    default: ()=>{},
  }
})

// Viewer controls from library (new 1.1.0 API)
const viewerControls = useViewerInstance()
const { channels: viewerChannels, selectedChannels } = viewerControls

// State
const channelColorMap = ref({
  'CONTINUOUS': '#6D48CE',
  'NEURAL': '#08B3AF'
})

const allVisible = ref(true)

const toggleVisibilityString = computed( () => {
  if (numberSelectedChannels.value > 0 ){
    return "Toggle Selected Channels"
  } else {
    return "Toggle All Channels"
  }
})
const selectedString = computed(() => {

  if (numberSelectedChannels.value > 0 ){
    const isOne = numberSelectedChannels.value === 1? " ": "s "
    return numberSelectedChannels.value + " channel" + isOne + "selected"
  } else {
    return " "
  }
})

const numberSelectedChannels = computed(() => {
  return selectedChannels.value.length
})

// Local computed properties
const sortedChannels = computed(() => {
  const channels = viewerChannels.value
  return returnSort('rank', channels, 'asc')
})

const channelTypes = computed(() => {
  return compose(
    uniq,
    pluck('type')
  )(viewerChannels.value)
})

// Sorter mixin functions (converted to local functions)
const returnSort = (sortBy, list, dir) => {
  // Implementation from the Sorter mixin
  const sorted = [...list].sort((a, b) => {
    const aVal = propOr(0, sortBy, a)
    const bVal = propOr(0, sortBy, b)

    if (dir === 'asc') {
      return aVal - bVal
    } else {
      return bVal - aVal
    }
  })
  return sorted
}


// Methods
const toggleAllVisibility = () => {
  allVisible.value = !allVisible.value

  if (numberSelectedChannels.value > 0) {
    // Toggle visibility only for selected channels
    selectedChannels.value.forEach(channel => {
      viewerControls.setChannelVisibility(channel.id, allVisible.value)
    })
  } else {
    // Toggle visibility for all channels
    if (allVisible.value) {
      viewerControls.showAllChannels()
    } else {
      viewerControls.hideAllChannels()
    }
  }

  viewerControls.triggerRerender('channel-visibility')
}

const onChannelSelected = (selectionData) => {
  const { channelId, append } = selectionData

  // Find the clicked channel to check its current state
  const clickedChannel = viewerChannels.value.find(ch => ch.id === channelId)
  const isCurrentlySelected = clickedChannel?.selected || false

  if (isCurrentlySelected && !append) {
    // Clicking on already selected channel - deselect it
    viewerControls.clearChannelSelection()
  } else if (append) {
    // Cmd/Ctrl+click - toggle the clicked channel, keep others
    viewerControls.selectChannels([channelId], true)
  } else {
    // Regular click - select only this channel
    viewerControls.selectChannels([channelId], false)
  }

  viewerControls.triggerRerender('channel-selection')
}

const onChannelVisibilityToggled = (visibilityData) => {
  viewerControls.setChannelVisibility(visibilityData.channelId, visibilityData.visible)
  viewerControls.triggerRerender('channel-visibility')
}


const getChannelsByType = (type) => {
  return sortedChannels.value.filter(channel => pathEq(['content', 'channelType'], type))
}

const openFilterMenu = () => {
  // Send selected channels if there are any, if not send all channels
  const channelList = selectedChannels.value.length > 0
    ? selectedChannels.value
    : viewerChannels.value

  EventBus.$emit('active-viewer-action', {
    method: 'openFilterWindow',
    payload: {
      channels: pluck('id', channelList),
      filter: {}
    }
  })
}

// Lifecycle - no cleanup needed, state persists in library store
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme';


.menu-item {
  color: theme.$purple_3
}
.palette-channels {
  background: #fff;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.channels-heading {
  align-items: center;
  background: theme.$purple_0_7;
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  min-height: 42px;
  overflow: hidden;
  padding: 0 10px;
  width: 100%;

  .left {
    font-weight: 300;
    color: theme.$purple_3;
  }

  &.all-visible {
    button {
      color: #000
    }
  }

  button {
    color: #9b9b9b;
    &:hover, &:focus {
      color: theme.$app-primary-color;
    }
  }
}

button {
  &.visible {
    color: #000
  }
  &:hover, &:focus {
    color: theme.$app-primary-color;
  }
}

.channel-wrap {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  position: relative;
}

.btn-toggle-channel {
  color: #9b9b9b;
  display: none;
  margin-right: 10px;

  .accordion:hover & {
    display: block;
  }
}

.save-changes-wrapper {
  border-top: solid 1px theme.$gray_2;
  position: absolute;
  bottom: 0;
  background: white;
  padding: 16px;
  width: 100%;
  box-sizing: border-box;

  .save-changes {
    &:hover, &:focus {
      color: white;
    }
  }
}
</style>