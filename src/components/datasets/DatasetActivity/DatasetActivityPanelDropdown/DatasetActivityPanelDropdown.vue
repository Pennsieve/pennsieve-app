<template>
  <div class="dataset-activity-panel-dropdown">
    <el-collapse>
      <el-collapse-item>
        <template #title>
          <IconArrowUp
            :class="[ detailsVal === 'Hide details' ? 'svg-flip mr-8' : 'mr-8' ]"
            :height="6"
            :width="9"
          />
          <a

            href="#"
            @click.prevent="expandAccordian"
          >
            {{ detailsVal }}
          </a>
          <div v-loading="isLoadingDetails" />
        </template>
        <div
          v-for="eventDetail in changelogEvents.events.slice(0, 10)"
          :key="eventDetail.id"
          class="dataset-activity-panel-dropdown-list"
        >
          <dataset-activity-detail
            :event-detail="eventDetail"
            :event="event"
          />
        </div>
        <a
          v-if="totalCount > 10"
          href="#"
          class="see-more-link"
          @click.prevent="openDialog"
        >
          See More
        </a>
      </el-collapse-item>
    </el-collapse>
    <dataset-activity-dialog
      :dialog-visible="isVisible"
      :activity="changelogEvents"
      :event="event"
      :total-count="totalCount"
      :is-loading="isLoadingDetails"
      @load-more-events="loadMoreEvents"
      @close="onCloseDialog"
    />
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import { pathOr } from 'ramda'

import DatasetActivityDialog from '../../DatasetActivityDialog/DatasetActivityDialog.vue'
import DatasetActivityDetail from '../DatasetActivityDetail/DatasetActivityDetail.vue'

import Request from '../../../../mixins/request'
import IconArrowUp from "../../../icons/IconArrowUp.vue";

  export default {
    name: 'DatasetActivityPanelDropdown',

    components: {
      IconArrowUp,
      DatasetActivityDialog,
      DatasetActivityDetail
    },

    mixins: [Request],

    props: {
      event: {
        type: Object,
        default: () => {}
      },
      totalCount: {
        type: Number,
        default: 0
      },
      dataset: {
        type: Object,
        default: () => {}
      }
    },
    data() {
      return {
        detailsVal: 'Show details',
        isLoadingDetails: false,
        isVisible: false,
        changelogEvents: {
          cursor: '',
          events: []
        }
      }
    },

    computed: {
      ...mapGetters(['getOrgMemberByIntId']),
      ...mapState(['config', 'userToken']),

      /**
       * Get dataset int id
       * @returns {Number}
       */
      datasetId: function() {
        return pathOr(0, ['content', 'id'], this.dataset)
      },

      /**
       * Returns event
       */
      eventsUrl: function() {
        return `${this.config.apiUrl}/datasets/${this.datasetId}/changelog/events?api_key=${this.userToken}`
      }
    },

    methods: {
      onCloseDialog: function() {
        this.isVisible = false
      },
      /**
       * Loads the event details for a particular changelog item
       *
       */
      loadCursorEvents: function(cursor) {
        this.sendXhr(`${this.eventsUrl}&cursor=${cursor}`).then(resp => {
          this.changelogEvents = resp
        }).catch(this.handleXhrError.bind(this))
      },
      /**
       * Loads the event details for a particular changelog item
       *
       */
      loadMoreEvents: function(cursor) {
        this.isLoadingDetails = true
        this.sendXhr(`${this.eventsUrl}&cursor=${cursor}`)
          .then(resp => {
            const events = this.changelogEvents.events.concat(resp.events)
            this.changelogEvents = {
              cursor: resp.cursor,
              events
            }
          })
          .catch(this.handleXhrError.bind(this))
          .finally(() => {
            this.isLoadingDetails = false
          })
      },

      /**
       * Change event function to expand detail dropdown
       */
      expandAccordian: function() {
        this.isLoadingDetails = true
        if (this.changelogEvents.events.length === 0) {
          this.loadCursorEvents(this.event.eventCursor)
        }
        if (this.detailsVal === 'Show details') {
          this.detailsVal = 'Hide details'
          this.isLoadingDetails = false
        } else {
          this.isLoadingDetails = false
          this.detailsVal = 'Show details'
        }
      },

      /**
       * Opens activity dialog
       */
      openDialog: function() {
        this.isVisible = true
      }
    },
  }
</script>

<style lang="scss" scoped>
@import '../../../../assets/_variables.scss';
.dataset-activity-panel-dropdown {
  .dataset-activity-panel-dropdown-list {
    padding: 10px 16px;
    border-bottom: solid 1px $gray_2;

    &:last-child {
      border-bottom: none;
    }

    &:nth-child(10) {
      border-bottom: none;
    }

    a {
      margin-left: 52px;
    }

    .see-more-link {
      text-decoration: none;
      font-size: 14px;
    }
  }

  .svg-icon {
    color: $purple_1;
    margin-right: 8px;
  }

    :deep(.el-collapse-item__header) {
      background-color: transparent;
      border-bottom: none;
      font-size: 14px;
      height: auto;
      line-height: 1.1;
    }

   :deep(.el-collapse-item__wrap) {
      background: transparent;
      border-bottom: none;
    }
    :deep(.el-collapse-item__content) {
      padding: 0;
    }

}
</style>
