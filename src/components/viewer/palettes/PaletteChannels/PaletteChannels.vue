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
          :open-delay="300"
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
          :open-delay="300"
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
import { ref, computed, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { useStore } from 'vuex'
import {
  compose,
  uniq,
  pluck,
  pathEq,
  includes,
  without,
  propEq,
  pathOr,
  findIndex,
  propOr
} from 'ramda'

import { useViewerStore } from '@/stores/tsviewer'
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

// Stores
const viewerStore = useViewerStore()
const { viewerChannels } = storeToRefs(viewerStore)

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

const numberSelectedChannels = computed( () => {
  return viewerChannels.value.filter(channel => {
    return propEq('selected', true, channel)
  }).length
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
  if (numberSelectedChannels.value > 0 ){
    let channels = viewerChannels.value
    for (let ch in channels) {
      if (channels[ch].selected) {
        channels[ch].visible = allVisible.value
      }


    }
  } else {
    let updatedChannels = viewerChannels.value
    for (let ch in updatedChannels) {
      updatedChannels[ch].visible = allVisible.value
    }
  }


}

const onChannelSelected = (selectionData) => {
  console.log('Channel selected:', selectionData)

  // Find the clicked channel to check its current state
  const clickedChannel = viewerChannels.value.find(ch => ch.id === selectionData.channelId)
  const isCurrentlySelected = clickedChannel?.selected || false

  // 1. Update actual channel selection state
  const updatedChannels = viewerChannels.value.map(channel => {
    if (!selectionData.append) {
      // Regular click behavior
      if (channel.id === selectionData.channelId) {
        // Toggle the clicked channel: if selected, deselect; if not selected, select
        channel.selected = !isCurrentlySelected
      } else if (!isCurrentlySelected) {
        // Only deselect others if we're selecting the clicked channel
        channel.selected = false
      }
      // If clicking on already selected channel to deselect it, leave others unchanged
    } else {
      // Cmd/Ctrl+click behavior (unchanged - toggle the clicked channel)
      if (channel.id === selectionData.channelId) {
        channel.selected = !channel.selected
      }
    }

    return { ...channel }
  })

  // 2. Trigger TSViewer re-render
  viewerStore.triggerRerender({
    cause: 'channel-selection'
  })
}

const onChannelVisibilityToggled = (visibilityData) => {
  console.log('Channel visibility toggled:', visibilityData)

  // 1. Update actual channel visibility state
  const updatedChannels = viewerChannels.value.map(channel => {
    if (channel.id === visibilityData.channelId) {
      channel.visible = visibilityData.visible
    }
    return { ...channel }
  })

  // 2. Trigger TSViewer re-render
  viewerStore.triggerRerender({
    cause: 'channel-visibility'
  })
}


const getChannelsByType = (type) => {
  return sortedChannels.value.filter(channel => pathEq(['content', 'channelType'], type))
}

const openFilterMenu = () => {
  // Get selected channels
  const selectedChannels = viewerChannels.value.filter(channel => {
    return propEq('selected', true, channel)
  })

  // Send selected channels if there are any, if not send all channels
  let channelList = selectedChannels.length > 0 ?
    selectedChannels :
    viewerChannels.value

  EventBus.$emit('active-viewer-action', {
    method: 'openFilterWindow',
    payload: {
      channels: pluck('id', channelList),
      filter: {}
    }
  })
}

const reset = () => {
  const channels = viewerChannels.value.map(channel => {
    return channel
  })
  viewerStore.setChannels(channels)
}

// Lifecycle
onBeforeUnmount(() => {
  reset()
})
</script>

<style lang="scss" scoped>
@import '../../../../assets/_variables.scss';


.menu-item {
  color: $purple_3
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
  background: $purple_0_7;
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  min-height: 42px;
  overflow: hidden;
  padding: 0 10px;
  width: 100%;

  .left {
    font-weight: 300;
    color: $purple_3;
  }

  &.all-visible {
    button {
      color: #000
    }
  }

  button {
    color: #9b9b9b;
    &:hover, &:focus {
      color: $app-primary-color;
    }
  }
}

button {
  &.visible {
    color: #000
  }
  &:hover, &:focus {
    color: $app-primary-color;
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
  border-top: solid 1px $gray_2;
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