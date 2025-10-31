<template>
  <div>
    <el-dialog
      :modelValue="dialogVisible"
      @update:modelValue="dialogVisible = $event"
      :show-close="false"
      @close="closeDialog"
    >
      <template #header>
        <bf-dialog-header
          slot="title"
          title="Activity Details"
        />
      </template>


      <dialog-body ref="dialogBody">
        <h3>{{ renderActivityType(event.eventType) }}</h3>
        <ul class="member-list unstyled">
          <li
            v-for="(member, idx) in orgMembers"
            :key="member.id"
          >
            {{ member.firstName }} {{ member.lastName }}
            <span v-if="idx < orgMembers.length - 1">
            ,
          </span>
          </li>
        </ul>
        <p>{{ formatDateRange(event.timeRange.start, event.timeRange.end) }}</p>
        <div class="activity-list">
          <div
            v-for="eventDetail in activity.events"
            :key="eventDetail.id"
            class="dataset-activity-panel-dropdown-list"
          >
            <dataset-activity-detail
              :event-detail="eventDetail"
              :event="event"
            />
          </div>
          <a
            v-if="activity.cursor"
            href="#"
            class="see-more-link"
            @click.prevent="loadMoreEvents"
          >
            {{ btnLoadMoreText }}
          </a>
        </div>
      </dialog-body>

      <template #footer>
        <bf-button
          class="secondary"
          @click="closeDialog"
        >
          Close
        </bf-button>
      </template>

    </el-dialog>
  </div>

</template>

<script>
import { mapGetters } from 'vuex'

import BfButton from '../../shared/bf-button/BfButton.vue'
import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../shared/dialog-body/DialogBody.vue'
import DatasetActivityDetail from '../DatasetActivity/DatasetActivityDetail/DatasetActivityDetail.vue'

import formatDateRange from '../../../mixins/format-date'
import { ChangelogMessage } from '../../../utils/constants'

export default {
  name: 'DatasetActivityDialog',

  components: {
    BfButton,
    BfDialogHeader,
    DialogBody,
    DatasetActivityDetail
  },

  mixins: [formatDateRange],

  props: {
    dialogVisible: {
      type: Boolean,
      default: false
    },
    activity: {
      type: Object,
      default: ()  => {}
    },
    event: {
      type: Object,
      default: () => {}
    },
    totalCount: {
      type: Number,
      default: 0
    },
    isLoading: {
      type: Boolean,
      default:  false
    }
  },

  computed: {
    ...mapGetters([
      'getOrgMembersByIntId',
    ]),

    /**
     * Compute org members that were part of this activity
     * @returns {Array}
     */
    orgMembers: function() {
      return this.getOrgMembersByIntId(this.event.userIds)
    },

    /**
     * Compute load more button text
     * @returns {String}
     */
    btnLoadMoreText: function() {
      return this.isLoading
        ? 'Loading More...'
        : 'See More'
    }
  },

  watch: {

  },

  methods: {

    /**
     * Renders activity based on event type
     * @param {String} eventType
     * @returns {String}
     */
    renderActivityType: function(eventType) {
      if (ChangelogMessage.PUBLISHING.hasOwnProperty(eventType)) {
          const publishing = this.ChangelogMessage.PUBLISHING
          return publishing[eventType]
        }
        if (typeof ChangelogMessage[eventType] === 'object' && ChangelogMessage[eventType] !== null) {
          // this is a singular or plural eventtype
          if (this.totalCount > 1) {
            return `${this.totalCount} ${ChangelogMessage[eventType].plural}`
          } else {
            return ChangelogMessage[eventType].singular
          }
        }
        return ChangelogMessage[eventType]
    },


    /**
     * Emit event to update the synced property
     */
    closeDialog: function() {
      this.$emit('close')
    },

    /**
     * Load more events
     */
    loadMoreEvents: function()  {
      if (this.isLoading) {
        return
      }
      this.$emit('load-more-events', this.activity.cursor)
    },

  }
}
</script>

<style lang="scss" scoped>
@use '../../../styles/theme';
@use '../../../styles/element/dialog';

    .dataset-activity-panel-dropdown-list {
      padding-bottom: 10px;
      padding-top: 10px;
      border-bottom: solid 1px theme.$gray_2;

      &:last-child {
        border-bottom: none;
      }

      a {
        margin-left: 52px;
      }

    }


h3 {
  color: #000;
  font-size: 16px;
  font-weight: 400;
  margin: 0 0 8px;
}
.member-list {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 8px;
  li {
    display: inline-flex;
    margin-right: 4px;
  }
}
.see-more-link {
  display: block;
  margin-top: 16px;
  text-decoration: none;
  font-size: 14px;
  &:hover,
  &:focus {
    text-decoration: underline;
  }
}
</style>
