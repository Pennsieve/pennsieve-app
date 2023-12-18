<template>
    <!-- SOURCE FILES TABLE -->
    <el-collapse-item
      v-if="showCollapse"
      title="Source Files"
      name="sourcefiles"
      :class="selectionCount > 0 ? 'row-is-selected collapse-section' : 'collapse-section'"
    >
      <template #title>
        <div
          class="relationship-title"
        >
          <IconArrowUp
            :class="[ arrowDirection('sourcefiles') === 'up' ? 'svg-flip' : '' ]"
            :height="10"
            :width="10"
          />
          <h2>Source Files</h2>
        </div>

      </template>

      <div
        class="content-section"
        id="source-files-table"
        v-loading="loadTableResults"
        element-loading-background="#FBFBFD"
      >
        <PennsieveTable
          :is-loading="isLoading"
          :data="data"
          :total-row-count="totalRowCount"
          v-model="checkAll"
          @update-limit="onUpdateLimit"
          @change-page="onPaginationPageChange"
          @selection-change="onSelectionChange"
        >
          <template #actions>
            <span id="selection-count-label">{{ selectionCountLabel }}</span>
            <ul class="selection-actions unstyled">
              <li>
                <button class="linked btn-selection-action mr-8" @click="onDownloadSelection">
                  <IconUpload
                    class="mr-8"
                    :height="16"
                    :width="16"
                  />
                  Download
                </button>
              </li>
            </ul>
          </template>

          <template #columns>
            <el-table-column
              type="selection"
              align="center"
              fixed
              width="50"
            />
            <el-table-column
              prop="filename"
              label="Name"
              fixed
              min-width="75"
              :resizable="true"
            >
              <template #default="scope">
                <bf-file-label
                  :file="scope.row"
                  :open-file-button="true"
                  :search-all-data-menu="true"
                  :is-name-link="false"
                  @click-name="onFileLabelClick(scope.row)"
                />
              </template>
            </el-table-column>
            <el-table-column
              prop="size"
              label="Size"
              :resizable="true"
            >
              <template #header>
                Size
              </template>
            </el-table-column>
            <el-table-column
              prop="createdAt"
              label="Date Created"
              :resizable="true"
            >
              <template #header>
                Date Created
              </template>
            </el-table-column>
          </template>

        </PennsieveTable>
      </div>
    </el-collapse-item>
</template>

<script>
import {find, head, includes, last, pathOr, propEq, propOr, compose} from 'ramda'
import {mapGetters, mapState} from 'vuex'

import EventBus from '../../../../utils/event-bus'
import Request from '../../../../mixins/request'
import TableFunctions from '../../../../mixins/table-functions'
import Sorter from '../../../../mixins/sorter'
import EncodeInternalFields from '../../../../mixins/encode-internal-fields'
import StorageMetrics from '../../../../mixins/bf-storage-metrics/index'
import FileIcon from '../../../../mixins/file-icon/index'
import FormatDate from '../../../../mixins/format-date'
import GetFileProperty from '../../../../mixins/get-file-property'
import FormatDisplayValue from '../../explore/ConceptInstance/format-display-value'
import BfWaitingIcon from '../../../shared/bf-waiting-icon/bf-waiting-icon.vue'

import PaginationPageMenu from '../../../shared/PaginationPageMenu/PaginationPageMenu.vue'
import IconArrowUp from "../../../icons/IconArrowUp.vue";
import IconMenu from "../../../icons/IconMenu.vue";
import IconRemove from "../../../icons/IconRemove.vue";
import BfFileLabel from '../../../datasets/files/bf-file/BfFileLabel.vue'
import IconUpload from "../../../icons/IconUpload.vue";

export default {
  name: 'SourceFilesTable',

  components: {
    IconRemove,
    IconMenu,
    IconArrowUp,
    IconUpload,
    BfWaitingIcon,
    PaginationPageMenu,
    BfFileLabel
  },

  mixins: [
    Request,
    TableFunctions,
    Sorter,
    StorageMetrics,
    FileIcon,
    FormatDate,
    FormatDisplayValue,
    EncodeInternalFields,
    GetFileProperty
  ],

  props: {
    activeSections: {
      type: Array,
      default: function() {
        return []
      }
    },
    relationship: {
      type: Object,
      default: () => ({})
    },
    showCollapse: {
      type: Boolean,
      default: false
    },
    url: {
      type: String,
      default: ''
    },

    proxyRecord: {
      type: Object,
      default: function() {
        return {}
      }
    }
  },

  data() {
    return {
      activeRow: {},
      hoverRow: {},
      data: [],
      selection: [],
      sortBy: 'name',
      limit: 50,
      offset: 0,
      origResponse: [],
      isLoading: false,
      sourceFileCount: 0,
      checkAll: false
    }
  },

  computed: {
    ...mapState(['dataset', 'relationshipTypes']),

    ...mapGetters([
      'userToken',
      'getModelByName',
      'filesProxyId',
      'getPermission',
      'datasetLocked'
    ]),

    /**
     * when we are dealing with an actual relationship,
     * we can get the count from there.  when we are dealing with
     * source files, we need it from the api endpoint
     */
    totalRowCount: function() {
      return this.relationship.count || this.sourceFileCount
    },

    /**
     * Determine whether loading state should appear
     * if data list is initially populated
     * to figure out whether or not we should show the
     * skeleton loader
     */
    loadTableResults: function() {
      return this.data.length === 0
    },

    /**
     * Determines what text to display based on number of files selected
     * in source files and record files table
     */
    selectionText: function() {
      let text
      if (this.selection.length > 1) {
        text = 'Files Selected'
      } else {
        text = 'File Selected'
      }
      return `${this.selection.length} ${text}`
    },

    selectionCount: function() {
      return this.selection.length
    },
    relationshipText: function() {
      const suffix = this.selectionCount > 1 ? 's' : ''
      return `Delete Relationship${suffix}`
    },
    deleteText: function() {
      const suffix = this.selectionCount > 1 ? 's' : ''
      return `Delete File${suffix}`
    },

    hasFolders: function() {
      return find(propEq('packageType', 'Collection'), this.selection) ? true: false
    },

    /**
     * Computed API Url for Source Files table
     * @returns {String}
     */
    // @TODO Modify this to handle sorting on sources table
    sourceFilesUrl: function() {
      if (!this.url) {
        return ''
      }

      // ...yuck...
      const mungedSortBy = this.sortBy === 'filename' ? 'name' : this.sortBy

      const queryParams = `?order-by=${mungedSortBy
      }&order-by-direction=${this.sortDirection
      }&api_key=${this.userToken
      }&limit=${this.limit
      }&offset=${this.offset}`
      return `${this.url}${queryParams}`

    },

    /**
     * Compute selection count label
     * @returns {String}
     */
    selectionCountLabel: function() {
      const selectionCount = this.selection.length
      const fileWord = selectionCount === 1 ? 'file' : 'files'
      return `${selectionCount} ${fileWord} selected`
    }
  },

  mounted: function() {
    this.loadSourceFiles()
  },

  methods: {
    /**
     * Updates selection from el-table
     * @param {Array} selection
     */
    onSelectionChange: function(selection) {
      this.selection = selection
    },

    /**
     * Used to download multiple source files
     *
     */
    onDownloadSelection: function() {
      EventBus.$emit('trigger-download', [this.proxyRecord], this.selection)
    },

    /**
     * Used to load source files of a package
     * for Source Files table
     */
    loadSourceFiles: function() {
      if (!this.sourceFilesUrl) {
        this.isLoading = false
        return
      }

      this.sendXhr(this.sourceFilesUrl)
        .then(response => {
          this.sourceFileCount = response.totalCount
          this.handleXhrResponse(response.results)
        })
        .catch(this.handleXhrError.bind(this))
    },

    // /**
    //  * Used to generate the styling for the
    //  * file status based on the state of
    //  * that file
    //  * @param {Object} row
    //  * @returns {string}
    //  */
    // tableRowClassName: function({ row }) {
    //   if (this.sourceType === 'recordFile') {
    //     const statusRows = {
    //       'Processing': 'processing-row',
    //       'Failed': 'failed-row',
    //       'Unprocessed': 'unprocessed-row',
    //       'Uploading': 'unprocessed-row'
    //     }
    //     return statusRows[row.status] !== '' ? statusRows[row.status] : 'no-status-row'
    //   }
    //
    //   if (this.sourceType === 'sourceFile') {
    //     return 'download-row'
    //   }
    // },

    /**
     * Get the arrow direction based on section name and if it is active
     * @param {string} sectionName
     * @returns {string}
     */
    arrowDirection: function(sectionName) {
      if (this.activeSections) {
        const isActive = includes(sectionName, this.activeSections)
        return isActive ? 'down' : 'up'
      }
    },

    /**
     * Makes XHR call
     * Takes optional callback to handle sort change responses
     * @param {String} callback
     */
    sendXhrRequest: function(callback = null) {
      if (!this.relationshipUrl) {
        this.isLoading = false
        return
      }

      this.sendXhr(this.relationshipUrl, {
        header: {
          Authorization: `bearer ${this.userToken}`
        }
      })
        .then(data => {
          // if (this.isSubmissions) {
          //   this.getLinkedFiles(data)
          //   return
          // }

          if (typeof callback !== 'function') {
            this.handleXhrResponse(data)
          } else {
            callback(data)
          }
        })
        .catch(this.handleXhrError.bind(this))
    },

    /**
     * Handles initial xhr request and subsequent load more requests
     * @param {Array} data
     */
    handleXhrResponse: function(data) {
      this.isLoading = false
      let formattedData
      if (data) {
        if (!Array.isArray(data)){
          this.origResponse = data.results
          // transform response
          formattedData = this.formatResults(data.results)
        } else {
          this.origResponse = data
          // transform response
          formattedData = this.formatResults(data)
        }

        this.data = formattedData
        // update related files state for files relationship drawer component
        this.$emit('set-related-files', formattedData)

      }
    },

    /**
     * Handles xhr request response for table sort changes and table refresh
     * @param {Array} data
     */
    handleTableRefreshResponse: function(data) {
      this.isLoading = false
      // set headings state
      this.formatHeaders(data)
      // transform response
      const formattedData = this.formatResults(data)
      // udpate data
      this.data = formattedData

      this.$emit('set-related-files', formattedData)

    },
    /**
     * Formats and flattens results before rendering
     * @param {Array} results
     * @returns {Array}
     */
    formatResults: function(results) {
      if (results.hasOwnProperty('results')){
        results = results.results
      }
      const getValues = compose(
        propOr([], 'values'),
        last
      )
      const getRecordId = compose(
        propOr('', 'id'),
        last
      )
      const getContent = compose(
        propOr({}, 'content'),
        last
      )
      const getIcon = compose(
        propOr('', 'icon'),
        last
      )
      const getStorageOrSize = arr => {
        return (arr.size || '') || (arr[arr.length - 1].storage || '')
      }
      const getSubtype = compose(
        propOr('', 'subtype'),
        last
      )
      const getProperties = compose(
        propOr([], 'properties'),
        last
      )
      const getCreatedAt = compose(
        this.formatDate,
        propOr('', 'createdAt')
      )
      const getUpdatedAt = compose(
        this.formatDate,
        propOr('', 'updatedAt')
      )
      const getExtension = compose(
        propOr('', 'extension'),
        last
      )
      const getChildren = compose(
        propOr('', 'children'),
        last
      )

      return (
        results
          // @TODO: remove filter once API is updated to not return files in a DELETING state
          .filter(arr => {
            const record = last(arr)
            const status = pathOr('READY', ['content', 'state'], record)
            return status !== 'DELETING'
          })
          .map(arr => {
            const relationship = head(arr)
            // const record = last(arr)

            const obj = {
              relationshipInstanceId: propOr('', 'id', relationship)
            }

            // Relationships Table
            const values = getValues(arr)
            if (values.length > 0) {
              obj.relationship = propOr('', 'displayName', relationship)
              obj.createdAt = getCreatedAt(relationship)
              obj['Date Created'] = {
                dataType: 'Date',
                value: getCreatedAt(relationship)
              }
              obj.updatedAt = getUpdatedAt(relationship)
              obj.recordId = getRecordId(arr)
              values.forEach(res => {
                obj[res.displayName] = {
                  dataType: res.dataType,
                  value: this.formatDisplayValue(res)
                }
              })
            }

            // Files Table
            /**
             * @TODO This badly needs refactored. This work was done when we had the
             * false requirement of a flat object for tables, but that is not the case
             * as `el-table-column` can take a path for its `prop` property
             */
            const content = getContent(arr)
            if (content.id) {
              const { name, state } = content
              const properties = getProperties(arr)

              const fileStates = {
                'ERROR': 'Failed',
                'UPLOADED': 'Unprocessed',
                'PROCESSING': 'Processing',
                'UNAVAILABLE': 'Uploading',
                'RUNNING': 'Processing',
                'PENDING': 'Processing'
              }

              const status = fileStates[state]

              obj.name = name
              obj.recordId = content.id
              obj.createdAt = getCreatedAt(content)
              obj['Date Created'] = getCreatedAt(content)
              obj.updatedAt = getUpdatedAt(content)
              obj.packageType = content.packageType
              // obj.subtype =
              //   this.getFilePropertyVal(properties, 'packageType') ||
              //   getSubtype(arr)
              obj.subtype = content.packageType === 'Collection' ? 'Folder' : content.packageType
              obj.state = state
              obj.status = status
              obj.storage = this.formatMetric(getStorageOrSize(arr))
              obj.icon =
                this.getFilePropertyVal(properties, 'icon') || getIcon(arr)
              obj.extension = getExtension(arr)
              obj.children = getChildren(arr)
            }

            // Source Files Table
            const sourceContent = propOr('', 'content', arr)
            if (sourceContent.id) {
              obj.id = sourceContent.id
              obj.name = sourceContent.name
              obj.filename = sourceContent.filename
              obj.fileType = sourceContent.fileType
              obj.createdAt = getCreatedAt(sourceContent)
              obj.size = this.formatMetric(getStorageOrSize(sourceContent))
              // storage and content specifically for BfDownloadFile.vue
              obj.storage = sourceContent.size
              obj.content = {
                name: sourceContent.name
              }
              obj.updatedAt = getUpdatedAt(sourceContent)
              obj.packageType = sourceContent.objectType
              obj.packageId = sourceContent.packageId
            }

            if (content.packageType === 'ExternalFile') {
              obj.packageType = content.packageType
              obj.subtype = 'External File'
            }

            return obj
          })
      )
    },
    // /**
    //  * Handle sort change
    //  * @param {String} property
    //  */
    // // @TODO Modify this to handle sorting on sources table
    // handleSortChange(property) {
    //   this.offset = 0;
    //   this.onTableSort(property)
    //   this.refreshTable(property)
    // },

    /**
     * Checkbox display logic
     * @param {Object} store
     * @param {Object} currentRow
     * @param {Object} hoverRow
     */
    showRowCheckbox(store, currentRow, hoverRow) {
      if (this.datasetLocked) {
        return false
      }

      const tableState = store.states
      let currentRowId = ''
      let hoverRowId = ''
      let rowsMatch = ''

      // check if rows match
      if (this.isSourceFile) {
        currentRowId = propOr('', 'id', currentRow)
        hoverRowId = propOr('', 'id', hoverRow)
        rowsMatch = currentRowId === hoverRowId
      } else {
        currentRowId = propOr('', 'relationshipInstanceId', currentRow)
        hoverRowId = propOr('', 'relationshipInstanceId', hoverRow)
        rowsMatch = currentRowId === hoverRowId
      }

      // check if row is in table state selection array
      const selection = tableState.selection
      if (rowsMatch === true || selection.length > 0) {
        return true
      }
      return false
    },

    /**
     * Request records data and refresh table
     */
    refreshTable: function(property, state) {
      this.isLoading = true
      this.loadSourceFiles()
    },

    /**
     * handle changing the page
     * @param {Number} page
     */
    onPaginationPageChange: function(page) {
      this.offset = (page - 1) * this.limit
      this.refreshTable()
    },

    /**
     * handle changing the results per page
     * @param limit
     */
    onUpdateLimit: function(limit) {
      this.offset = 0
      this.limit = limit
      this.refreshTable()
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../../../assets/_variables.scss';


.selection-actions {
  display: flex;
  flex: 1;
  justify-content: flex-end;
  align-items: center;
}

.relationship-title {
  align-items: center;
  display: flex;
  color: $purple_2;
  h2 {
    color: $purple_2;
    flex: 1;
    font-size: 18px;
    font-weight: 300;
    line-height: 1;
    margin: 0 0 0 8px;
  }
}

.collapse-section {
  width:100% ;
}
.content-section {
  width: 100%-1; // For some reason setting to 100% prevents table shrinking
}

#selection-count-label {
  margin-right: 8px;
}
.btn-selection-action {
  align-items: center;
  display: flex;
  font-size: 14px;
}
</style>
