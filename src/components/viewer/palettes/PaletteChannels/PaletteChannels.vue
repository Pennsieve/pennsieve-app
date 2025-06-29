<template>
  <div class="palette-channels">
    <div
      class="channels-heading"
      :class="{ 'all-visible': allVisible }"
    >
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
        content="Hide all channels"
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
        <el-tooltip
          placement="top"
          content="Edit channel-labels"
          :popper-options="{ boundariesElement: 'window' }"
          :open-delay="300"
        >
          <template #content>
            <button
              class="btn-toggle-channel"
              :class="{ visible: !computeIsHidden(channelType) }"
              @click="toggleBulkEdit(channelType)"
            >
              <IconPencil
                :height="20"
                :width="20"
              />
            </button>
          </template>
        </el-tooltip>

        <el-tooltip
          placement="top"
          content="Hide channels"
          :popper-options="{ boundariesElement: 'window' }"
          :open-delay="300"
        >
          <template #content>
            <button
              class="btn-toggle-channel"
              :class="{ visible: !computeIsHidden(channelType) }"
              @click="toggleGroupVisibility(channelType)"
            >
              <IconEyeball
                :height="20"
                :width="20"
              />
            </button>
          </template>
        </el-tooltip>

        <template #items>
          <div>
            <bf-channel
              v-for="channel in getChannelsByType(channelType)"
              :key="channel.id"
              :channel="channel"
              @update-channel-label="updateChannelLabel"
              @channel-selected="onChannelSelected"
              @channel-visibility-toggled="onChannelVisibilityToggled"
            />
          </div>
        </template>
      </accordion>
    </div>

    <div
      v-if="bulkEditingChannels"
      class="save-changes-wrapper"
    >
      <bf-button
        class="secondary compact cancel-bulk-editing"
        @click="onCancel"
      >
        Cancel
      </bf-button>
      <bf-button
        class="primary compact save-changes"
        @click="onSaveChanges"
      >
        Save All Changes
      </bf-button>
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
  }
})

// Stores
const vuexStore = useStore()
const viewerStore = useViewerStore()
const { viewerChannels } = storeToRefs(viewerStore)

// State
const channelColorMap = ref({
  'CONTINUOUS': '#6D48CE',
  'NEURAL': '#08B3AF'
})

const allVisible = ref(true)
const hiddenGroups = ref([])
const isSavingChanges = ref(false)

// Computed properties from Vuex store
const activeViewer = computed(() => vuexStore.state.viewerModule.activeViewer)
const viewerSidePanelView = computed(() => vuexStore.state.viewerModule.viewerSidePanelView)
const bulkEditingChannels = computed(() => vuexStore.state.bulkEditingChannels)
const config = computed(() => vuexStore.state.config)

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

// Request mixin function (converted to local function)
const handleXhrError = (error) => {
  // Implementation from the Request mixin
  console.error('XHR Error:', error)
  // Add appropriate error handling logic here
}

// Methods
const updateChannelLabel = (channel) => {
  const id = propOr(0, 'id', channel)
  // get channel by id
  const channelIdx = findIndex(propEq('id', id), sortedChannels.value)
  // update channel
  const newChannel = sortedChannels.value[channelIdx]
  newChannel.label = channel.label
  // update list
  //TODO this mutation should be handled in vuex to keep things consistent
  viewerChannels.value.splice(channelIdx, 1, newChannel)
}

const toggleAllVisibility = () => {
  allVisible.value = !allVisible.value
  let updatedChannels = viewerChannels.value
  for (let ch in updatedChannels) {
    updatedChannels[ch].visible = allVisible.value
    updateChannel(updatedChannels[ch], ch)
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

  // 2. Update store with new selection state
  viewerStore.setChannels(updatedChannels)

  // 3. Trigger TSViewer re-render
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

  // 2. Update store with new visibility state
  viewerStore.setChannels(updatedChannels)

  // 3. Trigger TSViewer re-render
  viewerStore.triggerRerender({
    cause: 'channel-visibility'
  })
}

const computeIsHidden = (channelType) => {
  return includes(channelType, hiddenGroups.value)
}

const toggleGroupVisibility = (channelType) => {
  const isHidden = includes(channelType, hiddenGroups.value)

  if (isHidden) {
    hiddenGroups.value = without(channelType, hiddenGroups.value)
  } else {
    hiddenGroups.value.push(channelType)
  }

  EventBus.$emit('active-viewer-action', {
    method: 'toggleGroupVisibility',
    payload: {
      channelType: channelType,
      visible: isHidden
    }
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

const toggleBulkEdit = (channelType) => {
  // Note: In Composition API, template refs need to be handled differently
  // You would need to create refs for each accordion and access them properly
  // For now, commenting out the accordion logic until proper ref handling is implemented

  // const accordion = pathOr(null, [`accordion-${channelType}`, 0], refs)
  // if (!accordion) {
  //   return
  // }
  // if (!accordion.open) {
  //   accordion.toggle()
  // }

  setBulkEditingChannels(!bulkEditingChannels.value)
    .then(() => {
      const channels = viewerChannels.value.map(channel => {
        // short circuit if bulk editing and channel is in edit state
        if (bulkEditingChannels.value && channel.isEditing) {
          return channel
        }
        channel.isEditing = !channel.isEditing
        return channel
      })
      viewerStore.setChannels(channels)
    })
}

const onSaveChanges = async () => {
  const channels = sortedChannels.value.map(channel => {
    return {
      rate: propOr(0, 'sf', channel),
      name: channel.label,
      channelType: channel.type,
      id: channel.id,
      properties: pathOr([], [0, 'properties'], channel),
      end: pathOr(0, ['dataSegments', 1], channel),
      unit: channel.unit,
      lastAnnotation: propOr(0, 'lastAnnotation', channel),
      start: pathOr(0, ['dataSegments', 0], channel)
    }
  })

  try {
    const token = await useGetToken()
    const timeseriesId = pathOr('', ['content', 'id'], activeViewer.value)
    const url = `${config.value.apiUrl}/timeseries/${timeseriesId}/channels?api_key=${token}`

    await useSendXhr(url, {
      method: 'PUT',
      body: channels
    })

    isSavingChanges.value = false

    // update channels in vuex
    const updatedChannels = sortedChannels.value.map(channel => {
      channel.isEditing = false
      return channel
    })

    viewerStore.setChannels(updatedChannels)

    // re-render canvas
    // TODO move to vuex
    EventBus.$emit('active-viewer-action', {
      method: 'updateChannels'
    })

    // display success message
    EventBus.$emit('toast', {
      detail: {
        type: 'success',
        msg: 'Your changes have been saved.'
      }
    })
  } catch (err) {
    isSavingChanges.value = false
    handleXhrError(err)

    EventBus.$emit('toast', {
      detail: {
        type: 'error',
        msg: 'There was an error saving changes.'
      }
    })
  } finally {
    setBulkEditingChannels(false)
  }
}

const onCancel = () => {
  toggleBulkEdit('CONTINUOUS')
}

const reset = () => {
  const channels = viewerChannels.value.map(channel => {
    channel.isEditing = false
    return channel
  })
  viewerStore.setChannels(channels)
}

// Vuex actions (since some are still in Vuex)
const updateChannel = (channel, index) => {
  return vuexStore.dispatch('viewerModule/updateChannel', channel)
}

const setBulkEditingChannels = (value) => {
  return vuexStore.dispatch('setBulkEditingChannels', value)
}

// Lifecycle
onBeforeUnmount(() => {
  setBulkEditingChannels(false)
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
  justify-content: flex-end;
  min-height: 42px;
  overflow: hidden;
  padding: 0 10px;
  width: 100%;

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

  .cancel-bulk-editing {
    margin-right: 16px;
  }

  .save-changes {
    &:hover, &:focus {
      color: white;
    }
  }
}
</style>