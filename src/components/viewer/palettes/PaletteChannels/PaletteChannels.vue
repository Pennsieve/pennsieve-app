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
            :height="20"
            :width="20"
          />
        </button>
      </el-tooltip>
    </div>

    <div class="channel-wrap">
      <accordion
        v-for="channelType in channelTypes"
        :key="channelType"
        :ref="`accordion-${channelType}`"
        icon="blackfynn:chevron-down-small"
        :border-color="channelColorMap[channelType]"
        :title="channelType"
        :window-height="windowHeight"
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

<script>
  import { compose, uniq, pluck, pathEq, includes, without, propEq, pathOr, findIndex, propOr } from 'ramda'
  import { mapState, mapActions } from 'vuex'

  import Accordion from '../../../shared/Accordion/Accordion.vue'
  import BfChannel from './BfChannel.vue'
  import BfButton from '../../../shared/bf-button/BfButton.vue'

  import EventBus from '../../../../utils/event-bus'
  import Sorter from '../../../../mixins/sorter'
  import Request from '../../../../mixins/request'
  import IconFilterFilled from "../../../icons/IconFilterFilled.vue";
  import IconEyeball from "../../../icons/IconEyeball.vue";
  import IconPencil from "../../../icons/IconPencil.vue";
  import {useGetToken} from "@/composables/useGetToken";
  import {useSendXhr} from "@/mixins/request/request_composable";

  export default {
    name: 'PaletteChannels',

    components: {
      IconPencil,
      IconEyeball,
      IconFilterFilled,
      Accordion,
      BfChannel,
      BfButton
    },

    props: {
      windowHeight: {
        type: Number,
        default: 0
      }
    },

    mixins: [
      Sorter,
      Request
    ],

    data: function() {
      return {
         channelColorMap: {
          'CONTINUOUS': '#6D48CE',
          'NEURAL': '#08B3AF'
        },
        allVisible: true,
        hiddenGroups: [],
        isSavingChanges: false
      }
    },

    computed: {
      ...mapState('viewerModule', ['activeViewer', 'viewerSidePanelView', 'viewerChannels']),
      ...mapState([
        'bulkEditingChannels',
        'config',
      ]),

      /**
       * Compute sorted channels by `rank`
       * @returns {Array}
       */
      sortedChannels: function() {
        const channels = this.viewerChannels
        return this.returnSort('rank', channels, 'asc')
      },

      /**
       * Compute channels
       * @returns {Array}
       */
      channelTypes: function() {
        return compose(
          uniq,
          pluck('type')
        )(this.viewerChannels)
      },

    },

    beforeDestroy() {
      this.setBulkEditingChannels(false)
      this.reset()
    },

    methods: {
      ...mapActions('viewerModule', ['setChannels','updateChannel']),
      ...mapActions(['setBulkEditingChannels']),
      /**
       * Updates sortedChannels
       * @param {Object} channel
       */
      updateChannelLabel: function(channel) {
        const id = propOr(0, 'id', channel)
        // get channel by id
        const channelIdx = findIndex(propEq('id', id), this.sortedChannels)
        // update channel
        const newChannel = this.sortedChannels[channelIdx]
        newChannel.label = channel.label
        // update list
        //TODO this mutation should be handled in vuex to keep things consistent
        this.viewerChannels.splice(channelIdx, 1, newChannel)
      },
      /**
       * Toggles visibility of all groups
       */
       toggleAllVisibility: function() {
        this.allVisible = !this.allVisible
        let updatedChannels = this.viewerChannels
        for (let ch in updatedChannels) {
          updatedChannels[ch].visible = this.allVisible
          this.updateChannel(updatedChannels[ch], ch)
        }
      },

      computeIsHidden: function(channelType) {
        return includes(channelType, this.hiddenGroups)
      },

      /**
       * Toggle visibilty for a group
       * @params {String} channelType
       */
      toggleGroupVisibility: function(channelType) {
        const isHidden = includes(channelType, this.hiddenGroups)

        if (isHidden) {
          this.hiddenGroups = without(channelType, this.hiddenGroups)
        } else {
          this.hiddenGroups.push(channelType)
        }

        EventBus.$emit('active-viewer-action', {
          method: 'toggleGroupVisibility',
          payload: {
            channelType: channelType,
            visible: isHidden
          }
        })
      },

      /**
       * Gets channels by type
       * @param {String} type
       * @returns {Array}
       */
      getChannelsByType: function(type) {
        return this.sortedChannels.filter(channel => pathEq(['content', 'channelType'], type))
      },

      /**
       * Toggles filter window
       */
      openFilterMenu: function() {
        // Get selected channels
        const selectedChannels = this.viewerChannels.filter(channel => {
          return propEq('selected', true, channel)
        })

        // Send selected channels if there are any, if not send all channels
        let channelList = selectedChannels.length > 0 ?
          selectedChannels :
          this.viewerChannels

        EventBus.$emit('active-viewer-action', {
          method: 'openFilterWindow',
          payload: {
            channels: pluck('id', channelList),
            filter: {}
          }
        })
      },

      /**
       * Toggles bulk edit mode
       * @param {String} channelType
       */
      toggleBulkEdit: function(channelType) {
        const accordion = pathOr(null, [`accordion-${channelType}`, 0], this.$refs)

        if (!accordion) {
          return
        }

        if (!accordion.open) {
          accordion.toggle()
        }

        this.setBulkEditingChannels(!this.bulkEditingChannels)
          .then(() => {
            const channels = this.viewerChannels.map(channel => {
              // short ciruit if bulk editing and channel is in edit state
              if (this.bulkEditingChannels && channel.isEditing) {
                return channel
              }
              channel.isEditing = !channel.isEditing
              return channel
            })
            this.setChannels(channels)
          })
      },

      /**
       * Handle save changes event
       */
      onSaveChanges: function() {
        const channels = this.sortedChannels.map(channel => {
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

        useGetToken()
          .then(token => {
            const timeseriesId = pathOr('', ['content', 'id'], this.activeViewer)
            const url =  `${this.config.apiUrl}/timeseries/${timeseriesId}/channels?api_key=${token}`

            return useSendXhr(url, {
              method: 'PUT',
              body: channels
            })
              .then(() => {
                this.isSavingChanges = false

                // update channels in vuex
                const updatedChannels = this.sortedChannels.map(channel => {
                  channel.isEditing = false
                  return channel
                })

                return this.setChannels(updatedChannels)
                  .then(() => {
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
                  })
              })
          })
          .catch(err => {
            this.isSavingChanges = false
            this.handleXhrError(err)

            EventBus.$emit('toast', {
              detail: {
                type: 'error',
                msg: 'There was an error saving changes.'
              }
            })
          })
          .finally(() => this.setBulkEditingChannels(false))
      },

      /**
       * Handle cancel changes event
       */
      onCancel: function() {
        this.toggleBulkEdit('CONTINUOUS')
      },

      /**
       * Reset state of all channels
       */
      reset: function() {
        const channels = this.viewerChannels.map(channel => {
          channel.isEditing = false
          return channel
        })
        this.setChannels(channels)
      }
    }
  }
</script>

<style lang="scss" scoped>
  @import '../../../../assets/_variables.scss';

  .palette-channels {
    background: #fff;
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
  }
  .channels-heading {
    align-items: center;
    background: #f7f7f7;
    border-bottom: solid 1px $gray_2;
    box-sizing: border-box;
    display: flex;
    justify-content: flex-end;
    min-height: 33px;
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
