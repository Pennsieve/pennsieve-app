<template>
  <div
    :id="channel.id"
    class="bf-channel"
    :class="{ visible: isChannelVisible, editing: channel.isEditing}"
    @click="toggleChannelSelect"
  >
    <div class="channel-info">
      <!-- default view -->
      <div class="label-group">
        <h2
          v-if="!channel.isEditing"
          :class="{selected: channel.selected}"
        >
          {{ channelLabel }}
        </h2>
        <IconFilterFilled
          class="filter-present"
          v-if="hasFilter"
          :height="12"
          :width="12"
        />
      </div>
      <!-- inline editing -->
      <div
        v-if="channel.isEditing && !bulkEditingChannels"
        class="channel-input-wrapper"
      >
        <el-input v-model="newLabel" />
        <el-tooltip
          placement="top"
          content="Save"
          :open-delay="300"
        >
          <button @click="saveChanges">
            <IconCheck
              :height="16"
              :width="16"
            />
          </button>
        </el-tooltip>
        <el-tooltip
          placement="top"
          content="Cancel"
          :open-delay="300"
        >
          <button @click="cancelChanges">
            <IconRemove
              :height="8"
              :width="8"
            />
          </button>
        </el-tooltip>
      </div>
      <!-- bulk editing -->
      <div
        v-if="channel.isEditing && bulkEditingChannels"
        class="channel-input-wrapper"
      >
        <el-input v-model="newLabel" />
        <a
          v-if="hasLabelChanged"
          href="#"
          class="revert"
          @click.prevent="onRevert"
        >
          Revert
        </a>
      </div>
      <div>{{ sampleFrequency }}</div>
    </div>
    <div class="channel-controls">
<!--      <el-tooltip-->
<!--        placement="top"-->
<!--        content="Edit"-->
<!--        :open-delay="300"-->
<!--      >-->
<!--        <button-->
<!--          class="mr-8"-->
<!--          @click="onEditChannel"-->
<!--        >-->
<!--          <IconPencil-->
<!--            :height="16"-->
<!--            :width="16"-->
<!--          />-->
<!--        </button>-->
<!--      </el-tooltip>-->
      <el-tooltip
        placement="top"
        content="Filter"
        :open-delay="300"
      >
        <button
          class="mr-8"
          @click="openFilterMenu"
        >
          <IconFilterFilled
            :height="16"
            :width="16"
          />
        </button>
      </el-tooltip>
      <el-tooltip
        placement="top"
        content="Hide"
        :open-delay="300"
      >
        <button @click="toggleChannel">
          <IconEyeball
            :height="16"
            :width="16"
          />
        </button>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useStore } from 'vuex'
import { propOr, mergeRight, pathOr, isEmpty } from 'ramda'
import EventBus from '../../../../utils/event-bus'
import IconCheck from "../../../icons/IconCheck.vue"
import IconRemove from "../../../icons/IconRemove.vue"
import IconPencil from "../../../icons/IconPencil.vue"
import IconFilterFilled from "../../../icons/IconFilterFilled.vue"
import IconEyeball from "../../../icons/IconEyeball.vue"
import { useSendXhr } from "@/mixins/request/request_composable"
import { useGetToken } from "@/composables/useGetToken"

// Props
const props = defineProps({
  channel: {
    type: Object,
    default: () => ({})
  }
})

// Emits
const emit = defineEmits(['update-channel-label', 'channel-selected', 'channel-visibility-toggled'])

// Store
const store = useStore()

// State
const newLabel = ref('')

// Computed properties
const activeViewer = computed(() => store.state.viewerModule.activeViewer)
const config = computed(() => store.state.config)
const bulkEditingChannels = computed(() => store.state.bulkEditingChannels)

const hasFilter = computed(() => {
  return !isEmpty(props.channel.filter)
})

const channelLabel = computed(() => {
  return propOr('', 'label', props.channel)
})

const sampleFrequency = computed(() => {
  const frequency = propOr(0, 'sf', props.channel)
  return `${frequency} Hz`
})

const isChannelVisible = computed(() => {
  return propOr(true, 'visible', props.channel)
})

const channelUrl = computed(() => {
  const timeseriesId = pathOr('', ['content', 'id'], activeViewer.value)
  const channelId = propOr('', 'id', props.channel)

  if (!timeseriesId || !channelId) {
    return ''
  }

  return `${config.value.apiUrl}/timeseries/${timeseriesId}/channels/${channelId}`
})

const hasLabelChanged = computed(() => {
  return newLabel.value !== channelLabel.value
})

// Watchers
watch(channelLabel, (val) => {
  newLabel.value = val
}, { immediate: true })

watch(hasLabelChanged, (val) => {
  emit('update-channel-label', { label: newLabel.value, id: props.channel.id })
  EventBus.$emit('data-changed', { changed: val, id: props.channel.id })
})

watch(() => props.channel, (val) => {
  if (!val.isEditing) {
    newLabel.value = channelLabel.value
  }
}, { deep: true })

// Methods
const updateChannel = (channel) => {
  return store.dispatch('viewerModule/updateChannel', channel)
}

const handleXhrError = (error) => {
  // Request mixin functionality converted to local function
  console.error('XHR Error:', error)
  // Add appropriate error handling logic here based on your Request mixin
}

const openFilterMenu = () => {
  EventBus.$emit('active-viewer-action', {
    method: 'openFilterWindow',
    payload: {
      channels: [props.channel.id],
      filter: props.channel.filter
    }
  })
}

const toggleChannel = () => {
  // Emit the visibility toggle event instead of directly updating
  emit('channel-visibility-toggled', {
    channelId: props.channel.id,
    channel: props.channel,
    visible: !props.channel.visible
  })
}

const toggleChannelSelect = (evt) => {
  const append = evt.metaKey

  // Emit the selection event
  emit('channel-selected', {
    channelId: props.channel.id,
    channel: props.channel,
    append
  })

}

const saveChanges = async () => {
  try {
    const channel = activeViewer.value.channels.find(item => (item.content.id === props.channel.id))
    const properties = pathOr([], [0, 'properties'], channel.properties)
    const payload = mergeRight(channel.content, { name: newLabel.value, properties })

    const token = await useGetToken()
    const url = `${channelUrl.value}?api_key=${token}`

    await useSendXhr(url, {
      method: 'PUT',
      body: payload
    })

    EventBus.$emit('toast', {
      detail: {
        type: 'success',
        msg: 'Your changes have been saved.'
      }
    })

    updateViewerChannels()
  } catch (err) {
    handleXhrError(err)

    EventBus.$emit('toast', {
      detail: {
        type: 'error',
        msg: 'There was an error saving changes.'
      }
    })
  }
}

const updateViewerChannels = () => {
  const label = newLabel.value.split("<->", 3)
  const label_prefix = label[0]
  let label_value = ((label.length > 1) ? parseFloat(label[1]) : 0)
  label_value = ((isNaN(label_value) ? label[1] : label_value))

  const changes = {
    label: newLabel.value,
    label_split: label,
    label_prefix: label_prefix,
    label_value: newLabel.value,
    isEditing: false
  }

  const channel = mergeRight(props.channel, changes)

  updateChannel(channel).then(() => {
    EventBus.$emit('active-viewer-action', {
      method: 'updateChannels'
    })
  })
}

const cancelChanges = () => {
  newLabel.value = channelLabel.value
  const channel = mergeRight(props.channel, { isEditing: false })

  updateChannel(channel).then(() => {
    EventBus.$emit('active-viewer-action', {
      method: 'renderAll'
    })
  })
}

const onEditChannel = () => {
  const channel = mergeRight(props.channel, { isEditing: true })

  updateChannel(channel).then(() => {
    EventBus.$emit('active-viewer-action', {
      method: 'renderAll'
    })
  })
}

const onRevert = () => {
  newLabel.value = channelLabel.value
}
</script>

<style lang="scss" scoped>
@import '../../../../assets/_variables.scss';

.bf-channel {
  background: white;
  border-bottom: 1px solid $gray_1;
  box-sizing: border-box;
  display: flex;
  padding: 4px 8px 4px 16px;
  //margin: 8px;
  &:hover {
    background: $purple_tint;
  }
  &:not(.visible) {
    .channel-info {
      opacity: .4
    }
    .svg-icon {
      color: #9b9b9b;
    }
  }
}

.channel-info {
  color: $gray_4;
  flex: 1;
}

.channel-controls {
  align-items: center;
  display: none;
  .bf-channel:hover & {
    display: flex;
  }
  .bf-channel.editing & {
    display: none;
  }

  button {
    color: #000;
  }
}

h2 {
  font-size: 13px;
  margin-bottom: 2px;
}

.selected {
  color: $orange_1
}

button {
  &:hover, &:focus {
    color: $app-primary-color;
  }
}
</style>

<style lang="scss">
.bf-channel {
  .channel-input-wrapper {
    width: 164px;
  }
  .el-input__inner {
    height: 18px !important;
    font-size: 12px;
    padding: 0 4px;
  }
  .revert {
    margin-left: 8px;
  }
  .label-group {
    display: flex;
    flex-direction: row;
    align-items: center;
  }
  .filter-present {
    margin-left: 5px;
  }
}
</style>