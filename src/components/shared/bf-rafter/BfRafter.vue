<script setup>
import { useRoute } from "vue-router";
let route = useRoute();
</script>

<template>
  <header
    class="bf-rafter"
    :class="[$slots['tabs'] ? 'with-tabs' : '', isEditing ? 'editing' : '']"
  >
    <div
      :class="[$slots['tabs'] ? 'rafter-inset with-tabs' : 'rafter-inset']"
    >

      <template v-if="datasetNameVisible">
        <div class="parent">
          <div class="dataset-name">{{ datasetNameDisplay() }}</div>
        </div>
      </template>

      <template v-if="showLinkBack">
        <a @click="backRoute" class="link-back">
          <IconArrowLeft
            :height="10"
            :width="10"
          />
          Back to {{ linkBack.name }}
        </a>
      </template>

      <div
        v-if="$slots.breadcrumb"
        class="row bf-rafter-breadcrumb"
        :class="[$slots['breadcrumb'] ? 'has-breadcrumb' : 'no-breadcrumb']"
      >
        <slot name="breadcrumb" />
      </div>

      <div class="row main">
        <div class="col">
          <h1 v-if="title">{{ title }}</h1>

          <div v-if="$slots['heading']" class="bf-rafter-heading">
            <slot name="heading" />
            <button v-if='!isDatasetOverview && slug' @click="toggleHelp">
              <component
                :is="showHelp?  'IconArrowUp': 'IconHelp' "
                :width="showHelp? 16: 24"
                :height="showHelp? 16: 24"
                color="white"
              />
            </button>
          </div>

          <div v-if="$slots['description']" class="bf-rafter-description">
            <slot name="description" />
          </div>
        </div>
        <div v-if="$slots['buttons']" class="col bf-rafter-buttons">
          <slot name="buttons" />
        </div>
      </div>

      <div v-if="$slots['bottom']" class="row bf-rafter-bottom">
        <slot name="bottom" />
      </div>

      <div :class="[ showHelp ? 'help-wrapper open' : 'help-wrapper']">

        <readme-doc :slug="slug" :show-header=true />

      </div>


      <div class="tabs-stats-wrap">
        <div v-if="$slots['tabs']" class="row bf-rafter-tabs">
          <slot name="tabs" />
        </div>

        <div v-if="$slots['stats']" class="col bf-rafter-stats mb-16">
          <slot name="stats" />
        </div>
      </div>

    </div>

  </header>
</template>



<script>
import { mapState, mapGetters, mapActions } from 'vuex'
import { path, pathOr } from 'ramda'
import EventBus from '../../../utils/event-bus'
import Request from '../../../mixins/request/index'
import BfButton from '../bf-button/BfButton.vue'
import CustomTheme from "../../../mixins/custom-theme";
import IconArrowLeft from "../../icons/IconArrowLeft.vue";
import IconUpload from "../../../components/icons/IconUpload.vue";
import IconArrowUp from "../../icons/IconArrowUp.vue";
import IconHelp from "../../icons/IconHelp.vue";
import ReadmeDoc from "../readme-doc/ReadmeDoc.vue";

export default {
  name: 'BfRafter',

  props: {
    title: {
      type: String,
      default: ''
    },
    size: {
      type: String,
      default: ''
    },
    isEditing: {
      type: Boolean,
      default: false
    },
    linkBack: {
      type: Object,
      default: () => {
        return {}
      }
    },
    orgId: {
      type: String,
      default: ''
    },
    datasetId: {
      type: String,
      default: ''
    }
  },

  components: {
    BfButton,
    IconArrowLeft,
    IconUpload,
    IconArrowUp,
    IconHelp,
    ReadmeDoc
  },

  mixins: [Request, CustomTheme],

  mounted() {
    const r = useRoute()
    if (r.meta.helpSection) {
      this.slug = r.meta.helpSection
    }
  },

  data: function() {
    return {
      datasetNameTruncated: false,
      datasetname: '',
      datasetFilterOpen: false,
      showHelp: false,
      datasetPageList: [
        'upload-manifests',
        'publishing-settings',
        'integrations-settings',
        'embargoed-permissions',
        'relationships',
        'graph',
        'collection-files',
        'records-overview',
        'dataset-files',
        'models',
        'dataset-permissions',
        'activity-log',
        'dataset-settings',
        'metadata',
        'records',
        'user-permissions',
        'embargo-permissions',
        'models-list'
      ],
      slug: ''
    }
  },

  computed: {
    ...mapState([
      'dataset',
      'orgDatasetStatuses',
      'datasetRafterVisStatus',
      'datasetRafterVisStatus2'
    ]),

    docTitle: function() {
      if (this.summary) {
        return this.summary.excerpt
      }
      return ''
    },
    docSummary: function() {
      if (this.summary) {
        return this.summary.body_html
      }
      return ''
    },

    showLinkBack: function() {
      return Object.keys(this.linkBack).length > 0
    },

    getThemeColors: function() {
      return this.getTheme(this.orgId)
    },

    rafterBackgroundStyle: function() {
      const color1 = this.pSBC(0.8, this.getThemeColors[1])
      return `${color1}`

    },

    isFileRecord: function() {
      return this.$route.name === "file-record";
    },

    ...mapGetters(['getPermission', 'userToken', 'config']),
    currentRouteName: function() {
      return this.$route.name
    },

    /**
     * Filters empty status names from orgDatasetStatuses
     * @returns {Array}
     */
    filterOrgStatusList: function() {
      return this.orgDatasetStatuses.filter(status => {
        return status.displayName !== ''
      })
    },

    /**
     * Returns the dataset status displayName
     * @returns {String}
     */
    formatDatasetStatus: function() {
      return pathOr('', ['status', 'displayName'], this.dataset)
    },

    datasetNameDisplay: function() {
      const name = this.datasetName
      this.datasetNameTruncated = false

      return name
    },

    getDatasetUpdateUrl: function() {
      const url = pathOr('', ['config', 'apiUrl'])(this)
      const datasetId = path(['content', 'id'], this.dataset)

      if (!url) {
        return ''
      }

      return `${url}/datasets/${datasetId}?api_key=${this.userToken}`
    },
    /**
     * Returns dataset filter arrow direction
     * @returns {String}
     */
    datasetFilterArrowDir: function() {
      return this.datasetFilterOpen ? 'up' : 'down'
    },
    /**
     * Returns color for dataset status
     * @returns {String}
     */
    checkStatusColor: function() {
      return pathOr('', ['status', 'color'], this.dataset)
    },

    datasetNameVisible: function() {
      if (this.datasetPageList.includes(this.currentRouteName)) {
        return true
      } else {
        return false
      }
    },

    isDatasetOverview: function() {
      return this.currentRouteName === 'dataset-overview'
    },

    onFilesPage: function() {
      let filesTable = 'dataset-files'
      if (filesTable.includes(this.currentRouteName)) {
        return true
      } else {
        return false
      }
    }
  },

  methods: {
    ...mapActions(['updateDataset', 'setDataset']),

    toggleHelp: function () {
      this.showHelp = !this.showHelp
    },

    backRoute: function() {
      this.$router.push({ name: this.linkBack.to, params: { datasetId: this.datasetId, orgId: this.orgId}})
    },

    pageBackRoute: function() {
      this.$router.back()
    },

    datasetName: function() {
      return pathOr('', ['content', 'name'], this.dataset)
    },
    /**
     * Returns dataset status name based on command selection in menu
     * @returns {String}
     */
    getStatusCommand: function(status) {
      return status.displayName
    },
    /**
     * Returns dataset status dot styling based on status color
     * @returns {Object}
     */
    getDotColor: function(status) {
      const obj = {
        backgroundColor: `${status.color}`
      }

      return obj
    },
    /**
     * Updates a dataset's status based on
     * status menu selection
     * @param {String}
     */
    updateDatasetStatus: function(command) {
      const status = this.orgDatasetStatuses.find(status => {
        return status.displayName === command
      })

      if (!this.getDatasetUpdateUrl) {
        return
      }

      // API request to update the status
      this.sendXhr(this.getDatasetUpdateUrl, {
        method: 'PUT',
        body: {
          status: status.name
        }
      })
        .then(response => {
          EventBus.$emit('toast', {
            detail: {
              msg: 'Your status has been saved'
            }
          })

          this.updateDataset(response)
          this.setDataset(response)
        })
        .catch(this.handleXhrError.bind(this))
    },
    //Navigates to dataset trash bin modal
    NavToDeleted: function() {
      //CONSIDER DOING SOMETHING LIKE FETCHFILES()
      EventBus.$emit('openDeletedModal', true)
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../../assets/_variables.scss';
@import '../../../assets/components/_dataset-status.scss';

.link-back {
  color: $white;
  font-weight: 700;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.bf-rafter-heading {
  display:flex;
  flex-direction: row;
  justify-content: space-between;
}

.rafter-inset {
  //padding: 8px 32px 8px 32px;
  &.with-tabs {
    padding-bottom: 0px;
  }
}

.bf-rafter {
  padding: 8px 32px 8px 32px;
  transition: 0.15s padding linear;
  background: $purple_1;
  z-index: 5;

  &.overview {
    background: white;
    padding: 0;
    margin: 0;

    h1 {
      margin: 0;
      color: $gray_6;
      font-size: 20px;
      &.flex-heading {
        align-items: center;
        display: flex;
      }
    }
    &.condensed {
      padding: 0;
    }
  }


  .link-back {
    color: $gray_2;
    font-size: 12px;
    cursor: pointer;
  }



  &.primary {
    background: $gray_1;
    padding-top: 24px;

    &.white {
      background: white;
    }
    h1 {
      margin: 0;
      color: $purple_3;
      font-size: 24px;
      &.flex-heading {
        align-items: center;
        display: flex;
      }
    }

  }
  &.small {
    padding-top: 28px;
    h1 {
      font-size: 24px;
      line-height: 40px;
    }
  }
  &.border,
  &.with-tabs {
    padding-bottom: 0px;
  }
  &.editing {
    //background: $gray_1;
  }
  :slotted(h1) {
    margin: 0;
    color: white;
    font-size: 20px;
    &.flex-heading {
      align-items: center;
      display: flex;
    }
  }
  .condensed & {
    background: $purple_1 ;
    &.primary {
      background: $gray_1;
    }
  }
  .row {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    color: white;
  }
  .main .col {
    flex: 1;
    min-width: 0;
  }
}
.bf-rafter-description {
  margin-top: 8px;
  color: $gray_5;
  .condensed & {
    display: none;
  }
}
.bf-rafter-tabs {
  margin-top: 6px;
  .condensed & {
    margin-top: 8px;
  }
}
.bf-rafter-bottom {
  margin-top: 24px;
  .condensed & {
    margin-top: 8px;
  }
}
.bf-rafter-breadcrumb {
  font-size: 14px;
  font-weight: 500;
  line-height: 16px;
  margin-bottom: 8px;
  min-height: 17px;
  color: white;
  .condensed &.no-breadcrumb {
    display: none;
  }
}
.bf-rafter-buttons {
  align-self: end;

  .buttons {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
  }
  .bf-button {
    margin-left: 8px !important;
    padding-top: 11px;
    padding-bottom: 11px;
  }
}
.tabs-stats-wrap {
  align-items: flex-end;
  display: flex;
  justify-content: space-between;
  color: white;
}
.bf-rafter-stats {
  display: flex;
  color: white;
}
.bf-rafter-help {
  display: flex;
  flex-direction: row;
  color: white;
  width: 100%;

  :slotted(.header-scroll) {
    color: $purple_3;
  }
  :slotted(h3) {
    color: red;
  }

}



.dataset-filter-status-check {
  margin: -2px 0;
  float: right;
}
.dataset-name {
  font-weight: 300;
  font-size: 16px;
  color: white;
  padding-top: 8px;
}

.parent {
  position: relative;
}
.dataset-status {
  color: $gray_4;
  font-size: 12px;
  font-weight: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
  margin-right: 5px;
  margin-left: 4px;
}
.dataset-info {
  display: flex;
  align-items: center;
  .dataset {
    color: $gray_4;
    font-size: 12px;
  }
  .dataset-filter-dropdown {
    display: flex;
    align-items: center;
  }
}

.help-section {
  padding-left: 16px;
  padding-right: 10%;
  padding-top: 8px;
  background-color: $purple_tint;
  :deep(.header-scroll) {
    color: $purple_2
  }
  :deep(.magic-block-textarea) {
    p {
      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}

.help-wrapper {
  background-color: white;
  color: $gray_6;
  max-height: 0;
  transition: max-height 0.15s, padding-top 0.15s ease-out;
  overflow-y:scroll;

  &.open {
    max-height: 250px;
    transition: max-height 0.25s ease-in, padding-top 0.25s ease-in;
    border-radius: 4px;
  }
}

</style>
