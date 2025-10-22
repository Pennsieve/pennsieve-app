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

      <!-- Header Navigation Section -->
      <div v-if="datasetNameVisible || showBreadcrumbs || showLinkBack" class="rafter-navigation">
        <!-- Navigation layout with breadcrumbs on left, dataset on right -->
        <div class="nav-primary">
          <!-- Left side: Breadcrumbs or back link -->
          <div class="nav-left">
            <!-- Breadcrumb Navigation (new feature) -->
            <template v-if="showBreadcrumbs">
              <div class="breadcrumb-nav">
                <template v-for="(crumb, index) in breadcrumbs" :key="index">
                  <span v-if="index > 0" class="breadcrumb-separator">/</span>
                  <template v-if="index === breadcrumbs.length - 1">
                    <span class="breadcrumb-current">{{ crumb.name }}</span>
                  </template>
                  <template v-else>
                    <a @click="navigateToBreadcrumb(crumb)" class="breadcrumb-link">
                      {{ crumb.name }}
                    </a>
                  </template>
                </template>
              </div>
            </template>

            <!-- Legacy Back Link (backward compatibility) -->
            <template v-else-if="showLinkBack">
              <a @click="backRoute" class="link-back">
                <IconArrowLeft
                  :height="10"
                  :width="10"
                />
                Back to {{ linkBack.name }}
              </a>
            </template>
          </div>
          
          <!-- Right side: Dataset context -->
          <div v-if="datasetNameVisible" class="nav-right">
            <div class="dataset-context">
              <span class="dataset-label">Dataset:</span>
              <a @click="navigateToDatasetOverview" class="dataset-name clickable">{{ datasetNameDisplay }}</a>
              <button 
                @click="copyDatasetId" 
                class="copy-dataset-btn"
                title="Copy Dataset ID"
              >
                <IconCopyDocument :width="14" :height="14" color="white" />
              </button>
            </div>
          </div>
        </div>
      </div>

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
import IconCopyDocument from "../../icons/IconCopyDocument.vue";
import ReadmeDoc from "../readme-doc/ReadmeDoc.vue";
import {useGetToken} from "@/composables/useGetToken";

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
    breadcrumbs: {
      type: Array,
      default: () => {
        return []
      }
    },
    orgId: {
      type: String,
      default: ''
    },
    datasetId: {
      type: String,
      default: ''
    },
    hideDatasetName: {
      type: Boolean,
      default: false
    }
  },

  components: {
    BfButton,
    IconArrowLeft,
    IconUpload,
    IconArrowUp,
    IconHelp,
    IconCopyDocument,
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

    showBreadcrumbs: function() {
      return this.breadcrumbs.length > 0
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

    ...mapGetters(['getPermission', 'config']),
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
      const name = this.datasetName()
      const maxLength = 30 // Reasonable character limit for dataset names
      
      if (name && name.length > maxLength) {
        this.datasetNameTruncated = true
        return name.substring(0, maxLength) + '...'
      } else {
        this.datasetNameTruncated = false
        return name
      }
    },

    getDatasetUpdateUrl: async function() {

      return useGetToken()
        .then((token) => {
          const url = pathOr('', ['config', 'apiUrl'])(this)
          const datasetId = path(['content', 'id'], this.dataset)
          return `${url}/datasets/${datasetId}?api_key=${token}`
        })

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
      // Show dataset name when we have a datasetId in the route params, unless explicitly hidden
      return !this.hideDatasetName && !!(this.$route.params.datasetId || this.datasetId)
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

    navigateToBreadcrumb: function(crumb) {
      if (crumb.to) {
        // Handle named routes
        this.$router.push({ 
          name: crumb.to, 
          params: { 
            datasetId: this.$route.params.datasetId || this.datasetId, 
            orgId: this.$route.params.orgId || this.orgId,
            ...crumb.params 
          }
        })
      } else if (crumb.path) {
        // Handle direct paths
        this.$router.push(crumb.path)
      }
    },

    navigateToDatasetOverview: function() {
      this.$router.push({ 
        name: 'dataset-overview', 
        params: { 
          datasetId: this.$route.params.datasetId || this.datasetId, 
          orgId: this.$route.params.orgId || this.orgId
        }
      })
    },

    pageBackRoute: function() {
      this.$router.back()
    },

    datasetName: function() {
      return pathOr('', ['content', 'name'], this.dataset)
    },
    
    /**
     * Copy dataset node ID to clipboard
     */
    copyDatasetId: async function() {
      try {
        const datasetNodeId = this.$route.params.datasetId || this.datasetId || path(['content', 'nodeId'], this.dataset) || path(['content', 'id'], this.dataset)
        if (datasetNodeId) {
          await navigator.clipboard.writeText(datasetNodeId)
          EventBus.$emit('toast', {
            detail: {
              msg: 'Dataset ID copied to clipboard'
            }
          })
        }
      } catch (error) {
        console.error('Failed to copy dataset ID:', error)
        EventBus.$emit('toast', {
          detail: {
            msg: 'Failed to copy dataset ID',
            type: 'error'
          }
        })
      }
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

      this.getDatasetUpdateUrl
        .then((url) => {
          this.sendXhr(url, {
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
        })


      // API request to update the status

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
@use '../../../styles/theme';
@use '../../../styles/dataset-status';

.link-back {
  color: theme.$white;
  font-weight: 700;
  display: flex;
  align-items: center;
  cursor: pointer;
}

// Header Navigation Section
.rafter-navigation {
  margin-bottom: 16px;
  
  .nav-primary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .nav-left {
      flex: 1;
    }
    
    .nav-right {
      flex-shrink: 0;
    }
    
    .dataset-context {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .dataset-label {
        font-size: 12px;
        color: theme.$gray_3;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 500;
      }
      
      .dataset-name {
        font-size: 14px;
        color: theme.$white;
        font-weight: 500;
        
        &.clickable {
          cursor: pointer;
          text-decoration: none;
          transition: opacity 0.2s ease;
          
          &:hover {
            opacity: 0.8;
            text-decoration: underline;
          }
        }
      }
      
      .copy-dataset-btn {
        background: transparent;
        border: none;
        padding: 4px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        transition: opacity 0.2s ease;
        
        &:hover {
          opacity: 1;
        }
        
        &:active {
          opacity: 0.5;
        }
      }
    }
  }
}

.breadcrumb-nav {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 500;
  
  .breadcrumb-link {
    color: theme.$gray_2;
    cursor: pointer;
    text-decoration: none;
    transition: color 0.2s ease;
    
    &:hover {
      color: theme.$white;
      text-decoration: underline;
    }
  }
  
  .breadcrumb-separator {
    color: theme.$gray_3;
    margin: 0 8px;
    font-weight: 400;
  }
  
  .breadcrumb-current {
    color: theme.$white;
    font-weight: 600;
  }
}

.bf-rafter-heading {
  display:flex;
  flex-direction: row;
  justify-content: space-between;
}

.rafter-inset {
  &.with-tabs {
    padding-bottom: 0px;
  }
}

.bf-rafter {
  padding: 8px 8px 8px 32px;
  transition: 0.15s padding linear;
  background: theme.$purple_1;
  z-index: 5;

  &.overview {
    background: white;
    padding: 0;
    margin: 0;

    h1 {
      margin: 0;
      color: theme.$gray_6;
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
    color: theme.$gray_2;
    font-size: 12px;
    cursor: pointer;
  }



  &.primary {
    background: theme.$gray_1;
    padding-top: 24px;

    &.white {
      background: white;
    }
    h1 {
      margin: 0;
      color: theme.$purple_3;
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
    background: theme.$purple_1 ;
    &.primary {
      background: theme.$gray_1;
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
  color: theme.$gray_5;
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
    color: theme.$purple_3;
  }
  :slotted(h3) {
    color: red;
  }

}



.dataset-filter-status-check {
  margin: -2px 0;
  float: right;
}
// Legacy styles - keeping for backward compatibility
.parent {
  position: relative;
}
.dataset-status {
  color: theme.$gray_4;
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
    color: theme.$gray_4;
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
  background-color: theme.$purple_tint;
  :deep(.header-scroll) {
    color: theme.$purple_2
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
  color: theme.$gray_6;
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
