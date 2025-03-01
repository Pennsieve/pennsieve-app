<template>
  <!-- FILES RELATIONS TABLE -->
  <el-collapse-item
    v-if="showCollapse"
    title="Relationships"
    :name="`fileRelationships+${this.relationshipName}`"
    :class="selectionCount > 0 ? 'row-is-selected collapse-section' : 'collapse-section'"
  >
    <template #title>
      <div
        class="relationship-title"
      >
        <IconArrowUp
          :class="[ arrowDirection(`fileRelationships+${this.relationshipName}`) === 'up' ? 'svg-flip' : '' ]"
          :height="10"
          :width="10"
        />
        <h2>{{ relationship.displayName }}</h2>
      </div>

    </template>

    <div
      class="content-section"
      id="source-files-table"
      v-loading="isLoading"
      element-loading-background="#FBFBFD"
    >
      <PennsieveTable
        :is-loading="isLoading"
        :data="data"
        :total-row-count="totalRowCount"
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
              v-if="showRelationshipName"
              prop="relationship"
              label="Relationship"
              fixed
              min-width="165"
              :resizable="true"
            >
            </el-table-column>
            <el-table-column
              v-for="(heading, index) in getHeadings(headings, ['relationship'], true)"
              :key="heading"
              :item="heading"
              :prop="getProperty(heading)"
              :label="heading"
              min-width="165"
              :resizable="true"
            >
              <template #header>
                {{heading}}
              </template>
              <template #default="scope">
                <router-link
                  v-if="index === 0"
                  :to="getRecordUrl(scope)"
                  v-html="displayValue(scope.row[heading])"
                />
                <span
                  v-else
                  v-html="displayValue(scope.row[heading])"
                />

              </template>
            </el-table-column>
            <el-table-column
              v-if="getPermission('editor')"
              width="45"
              fixed="right"
              :resizable="false"
            >
              <template #default="scope">
                <div
                  v-if="!datasetLocked"
                  class="remove-relationship"
                  @click="onRemoveRelationship(scope.row, $event)"
                >
                  <IconRemove
                    :height="10"
                    :width="10"
                    color="#404554"
                  />
                </div>
              </template>
            </el-table-column>
        </template>

      </PennsieveTable>
      </div>
  </el-collapse-item>
</template>

<script>
import {find, head, includes, last, pathOr, propEq, propOr, clone, compose} from 'ramda'
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

import IconArrowUp from "../../../icons/IconArrowUp.vue";
import IconMenu from "../../../icons/IconMenu.vue";
import IconRemove from "../../../icons/IconRemove.vue";
import BfFileLabel from '../../../datasets/files/bf-file/BfFileLabel.vue'
import IconUpload from "../../../icons/IconUpload.vue";
import PennsieveTable from "../../../shared/PennsieveTable/PennsieveTable.vue";
import {useGetToken} from "@/composables/useGetToken";
import {useSendXhr} from "@/mixins/request/request_composable";

export default {
  name: 'FileRelationshipsTable',

  components: {
    IconRemove,
    IconMenu,
    IconArrowUp,
    IconUpload,
    BfFileLabel,
    PennsieveTable
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

    showRelationshipName: {
      type: Boolean,
      default: true
    },
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
      default: true
    },

    datasetId: {
      type: String,
      default: ''
    },
    packageId: {
      type: String,
      default: ''
    },
    sourceType: {
      type: String,
      default: 'record',
      validator: val => ['record', 'recordFile', 'sourceFile'].includes(val)
    },
    displayName: {
      type: String,
      default: 'Source Files'
    },
  },

  data() {
    return {
      activeRow: {},
      headings: [],
      hoverRow: {},
      data: [],
      selection: [],
      sortBy: this.sourceType === 'sourceFile' ? 'name' : 'createdAt',
      limit: 50,
      offset: 0,
      origResponse: [],
      isLoading: false,
    }
  },

  computed: {
    ...mapState(['filesProxyId', 'dataset', 'relationshipTypes']),

    ...mapGetters([
      'getModelByName',
      'filesProxyId',
      'getRelationshipTypeDisplayName',
      'getRelationshipTypes',
      'getPermission',
      'config',
      'datasetLocked'
    ]),
    /**
     * Compute selection count label
     * @returns {String}
     */
    selectionCountLabel: function() {
      const selectionCount = this.selection.length
      const fileWord = selectionCount === 1 ? 'record' : 'records'
      return `${selectionCount} ${fileWord} selected`
    },

    recordsForModelforPackageUrl: function(){
      return `${
        this.config.conceptsUrl
      }/datasets/${this.datasetId}/proxy/package/external/${this.packageId}/relations/${this.relationshipName}/files`
    },

    relationshipName: function() {
      return this.relationship.name
    },

    /**
     * when we are dealing with an actual relationship,
     * we can get the count from there.  when we are dealing with
     * source files, we need it from the api endpoint
     */
    totalRowCount: function() {
      return this.data.count
    },

    /**
     * we want to suppress sorting for "recordFile" sourceType because the api doesn't support it
     */
    nonSortableColumns: function() {
      if (this.sourceType === 'recordFile') return ['name', 'subtype', 'createdAt']
      return []
    },

    /**
     * Determine whether loading state should appear
     * if concepts list is initially populated
     * to figure out whether or not we should show the
     * skeleton loader
     */
    loadTableResults: function() {
      return this.data.length === 0 ? true : false
    },

    /**
     * Gets the total number of rows in the table
     * based on total count of results returned in API
     */
    getRowCount: function() {
      return `Showing ${this.data.length} of ${this.totalRowCount} Row${this.totalRowCount > 1 ? 's' : ''}`
    },

    /**
     * Determines what text to display based on number of files selected
     * in source files and record files table
     */
    selectionText: function() {
      let text = ''
      if (this.selection.length > 1) {
        text = 'Files Selected'
      } else {
        text = 'File Selected'
      }
      return this.sourceType === 'record'
        ? `${this.selection.length} Selected`
        : `${this.selection.length} ${text}`
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

    /**
     * Returns boolean based on whether table will render source
     * file data or relationship data
     * @returns {Boolean}
     */
    isFilesType: function() {
      return this.relationship.name === 'package'
    },
    relationshipUrl: function() {

      const { sortBy, sortDirection, limit, offset } = this
      const ascending = sortDirection !== 'desc'

      const relationshipOrderBy = 'label'
      let queryParams = `?relationshipOrderBy=${relationshipOrderBy
      }&limit=${limit
      }&offset=${offset
      }&ascending=${ascending
      }&includeIncomingLinkedProperties=true`

      if (this.sortBy !== 'relationship') {
        queryParams += `&recordOrderBy=${this.prefixField(sortBy)}`
      }

      return `${this.recordsForModelforPackageUrl}${queryParams}`
    },

    /**
     * Computed API Url for Record Files table
     * @returns {String}
     */
    filesPagedUrl: function() {
      if (!this.url) {
        return ''
      }

      let queryParams = `?offset=${this.offset}&limit=${this.limit}`
      return `${this.recordsForModelforPackageUrl}${queryParams}`
    },

    /**
     * Checks if concepts list is populated
     * @returns {Boolean}
     */
    hasConcepts: function() {
      return this.data.length > 0
    }
  },

  mounted: function() {
    this.sendXhrRequest()

  },

  methods: {
    onSelectionChange: function(selection) {
      this.selection = selection
    },
    /**
     * Displays column value
     * @param {Object} property
     * @returns {String}
     */
    displayValue: function(property) {
      const dataType = propOr('String', 'dataType', property)
      const propertyValue = propOr('', 'value', property)
      const val = dataType === 'String' ?
        this.$sanitize(propertyValue) :
        propertyValue
      return Array.isArray(val) ? val.join(', ') : val
    },

    // onRowClick: function(row, selected) {
    //   this.$refs.Table.clearSelection()
    //   this.$refs.Table.toggleRowSelection(row, true)
    // },

    /**
     * Method to load the files in
     * a record details table
     */
    loadRecordFiles: function() {
      if (!this.filesPagedUrl){
        this.isLoading = false
        return
      }

      useGetToken()
        .then(token => {
          return useSendXhr(this.filesPagedUrl, {
            header: {
              'Authorization': `bearer ${token}`
            },
          })
            .then(response => {
              this.handleXhrResponse(response.results)
            })

        }).catch(this.handleXhrError.bind(this))

    },


    /**
     * Used to generate the styling for the
     * file status based on the state of
     * that file
     * @param {Object} row
     * @returns {string}
     */
    tableRowClassName: function({ row }) {
      if (this.sourceType === 'recordFile') {
        const statusRows = {
          'Processing': 'processing-row',
          'Failed': 'failed-row',
          'Unprocessed': 'unprocessed-row',
          'Uploading': 'unprocessed-row'
        }
        return statusRows[row.status] !== '' ? statusRows[row.status] : 'no-status-row'
      }

      if (this.sourceType === 'sourceFile') {
        return 'download-row'
      }
    },
    /**
     * Format relationships after relationship types are loaded
     * This resolves a race condition where the
     * table data is loaded before relationshipTypes are
     */
    onWatchRelationshipTypes: function(val) {
      if (Object.keys(val).length > 0 && this.origResponse.length > 0) {
        this.handleTableRefreshResponse(this.origResponse)
      }
    },

    /**
     * Opens delete file dialogue
     */
    onDeleteFiles: function() {
      const fileIds = this.selection.map(record => {
        return {
          content: {
            id: propOr('', 'recordId', record)
          }
        }
      })
      this.$emit('delete-files', fileIds)
    },
    /**
     * Sets the active row for the menu clicked
     */
    setActiveRow: function(row, evt) {
      evt.preventDefault()
      this.activeRow = row
    },
    /**
     * Emit unlink file event
     */
    unlink: function() {
      const evt = {
        stopPropagation: () => {}
      }
      this.onUnlinkFiles(this.activeRow, evt)
    },
    /**
     * Emit delete file event
     */
    delete: function() {
      const file = {
        content: {
          id: propOr('', 'recordId', this.activeRow)
        }
      }
      this.$emit('delete-files', [file])
    },

    /**
     * Used to process a file if state
     * is set to 'Unprocessed'
     */
    process: function() {
      if (this.processFileUrl === '') {
        return
      }
      useGetToken()
        .then(token => {
          return useSendXhr(this.processFileUrl, {
            method: 'PUT',
            header: {
              Authorization: `bearer ${token}`
            }
          })
            .then(response => {
              this.activeRow.status = 'Processing'
            })

        })
        .catch(this.handleXhrError.bind(this))

    },

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
     * Handle upload click event for Files table
     * @param {Object} e
     */
    onUploadClick(e) {
      e.preventDefault()
      EventBus.$emit('open-uploader', true)
      this.$store.dispatch('updateUploadDestination', {
        content: this.dataset.content
      })
    },
    /**
     * Handle add relationship click event for any table
     * @param {String} conceptName
     * @param {Object} e
     */
    onAddRelationshipClick(conceptName, e) {
      e.stopPropagation()

      const lockedDataset = propOr(false, 'locked', this.dataset)
      if (lockedDataset) {
        return
      }

      EventBus.$emit('add-relationship', conceptName)
    },
    /**
     * Handle remove relationship click event
     * @param {Object} row
     * @param {Object} e
     */
    onRemoveRelationship(row, e) {
      e.stopPropagation()

      const relationshipInstanceId = row.relationshipInstanceId
      const relationships = [relationshipInstanceId]
      const tableName = this.relationship.name

      this.$emit('remove-relationships', { relationships, tableName })
    },
    /**
     * Handle unlinking a file click event
     * @param {Object} row
     * @param {Object} e
     */
    onUnlinkFiles(row, e) {
      e.stopPropagation()

      const relationships = [row.relationshipInstanceId]
      const tableName = this.relationship.name

      this.$emit('unlink-files', { relationships, tableName })
    },
    /**
     * Emit remove relationships event to Concept Instance component
     * @param {String} relName
     * @param {Object} e
     */
    onRemoveRelationships(relName, e) {
      e.stopPropagation()
      const relationships = this.selection.map(
        obj => obj.relationshipInstanceId
      )
      const tableName = this.relationship.name

      this.$emit('remove-relationships', { relationships, tableName })
    },
    /**
     * Calculate number of items selected in a table
     * @param {String} tableName
     */
    getTableSelectionCount(tableName) {
      const cmp = pathOr(null, [tableName, 0])(this.$refs)
      if (cmp) {
        const table = cmp.$refs.table
        const tableSelection = pathOr([], [`store`, 'states', 'selection'])(
          table
        )
        return tableSelection.length
      }
    },
    /**
     * Handle Table Enter event on initial render
     */
    handleTableEnter: function() {
      if (this.data.length > 0) {
        return
      }
      this.isLoading = true;
      switch (this.sourceType) {
        case 'sourceFile':
          this.loadSourceFiles()
          break
        case 'recordFile':
          this.loadRecordFiles()
          break
        default:
          this.sendXhrRequest()
      }
    },

    // /**
    //  * Makes XHR call
    //  * Takes optional callback to handle sort change responses
    //  * @param {String} callback
    //  */
    // sendXhrRequest: function(callback = null) {
    //   // if (!this.relationshipUrl) {
    //   //   this.isLoading = false
    //   //   return
    //   // }
    //
    //   this.sendXhr(this.relationshipUrl, {
    //     header: {
    //       Authorization: `bearer ${this.userToken}`
    //     }
    //   })
    //     .then(data => {
    //       // if (this.isSubmissions) {
    //       //   this.getLinkedFiles(data)
    //       //   return
    //       // }
    //
    //       if (typeof callback !== 'function') {
    //         this.handleXhrResponse(data)
    //       } else {
    //         callback(data)
    //       }
    //     })
    //     .catch(this.handleXhrError.bind(this))
    // },

    // requestLinkedFiles: function(record) {
    //   const datasetId = pathOr('', ['params', 'datasetId'], this.$route)
    //   const modelName = propOr('', 'name', this.relationship)
    //   const recordId = compose(
    //     propOr('', 'id'),
    //     find(propEq('type', 'submission'))
    //   )(record)
    //
    //   const url = `${this.config.conceptsUrl}/datasets/${datasetId}/concepts/${modelName}/instances/${recordId}/files`
    //
    //   return this.sendXhr(url, {
    //     header: {
    //       Authorization: `bearer ${this.userToken}`
    //     }
    //   })
    //     .then(response => {
    //       return compose(
    //         defaultTo({}),
    //         last,
    //         defaultTo([]),
    //         head,
    //         defaultTo([])
    //       )(response)
    //     })
    //     .catch(this.handleXhrError.bind(this))
    // },

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
          // set headings state
          this.formatHeaders(data.results)
          // transform response
          formattedData = this.formatResults(data.results)
        } else {
          this.origResponse = data
          // set headings state
          this.formatHeaders(data)
          // transform response
          formattedData = this.formatResults(data)
        }

        this.data = formattedData
        // update related files state for files relationship drawer component
        if (this.isFilesType) {
          this.$emit('set-related-files', formattedData)
        }
      }
    },
    /**
     * Format the data for the function that will format the headers :)
     * @param {Array} data
     */
    formatHeaders: function(data) {
      let headingValues

      // creating this pseudo concept objects for the getHeading table function :/
      // again...this "isFilesType" boolean is problematic
      if (!this.isFilesType || this.sourceType === 'sourceFile') {
        const valuesObject = { values: pathOr([], [0, 1, 'values'])(data) }
        headingValues = clone(valuesObject)
        headingValues.values.push(
          this.generateConceptObj('relationship', 'relationship')
        )
        headingValues.values.push(
          this.generateConceptObj('createdAt', 'Date Created')
        )
      } else {
        headingValues = { values: [] }
        headingValues.values.push(this.generateConceptObj('name', 'Name', true))
        headingValues.values.push(this.generateConceptObj('subtype', 'Kind'))
      }

      this.headings = [headingValues]
    },
    /**
     * Creates mock concpet objects that are included in the getHeaders "headings" input
     * @param {String} name
     * @param {String} displayName
     * @param {Boolean} conceptTitle
     * @return {Object}
     */
    generateConceptObj: function(name, displayName, conceptTitle = false) {
      return {
        conceptTitle,
        default: true,
        displayName: displayName,
        name: name,
        relationship: name === 'relationship'
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
      // udpate concepts
      this.data = formattedData

      if (this.isFilesType) {
        this.$emit('set-related-files', formattedData)
      }
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
            return status != 'DELETING'
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
              const relationshipDisplayName = propOr('', 'displayName', relationship)

              obj.relationship = relationshipDisplayName
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
    /**
     * Handle sort change
     * @param {String} property
     */
    // @TODO Modify this to handle sorting on sources table
    handleSortChange(property) {
      this.offset = 0;
      this.onTableSort(property)
      this.refreshTable(property)
    },

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

      currentRowId = propOr('', 'relationshipInstanceId', currentRow)
      hoverRowId = propOr('', 'relationshipInstanceId', hoverRow)
      rowsMatch = currentRowId === hoverRowId


      // check if row is in table state selection array
      const selection = tableState.selection
      if (rowsMatch === true || selection.length > 0) {
        return true
      }
      return false
    },
    /**
     * Handle table selection change
     * @param {Array} selection
     */
    handleTableSelectionChange(selection) {
      this.selection = selection
    },
    /**
     * Handle table cell enter
     * @param {Object} row
     */
    handleTableCellEnter(row) {
      this.hoverRow = row
    },
    /**
     * Handle table cell leave
     * @param {Object} event
     */
    handleTableCellLeave(row, column, cell, event) {
      const nodeName = pathOr('', ['toElement', 'nodeName'])(event)
      const whiteList = ['TD', 'TR']
      // if moving to element other than TD or TR, reset hover row
      if (whiteList.indexOf(nodeName) < 0) {
        this.hoverRow = {}
      }
    },

    /**
     * Gets the property name for the displayName
     * @param {String} displayName
     */
    getProperty: function(displayName) {
      const headings = compose (
        propOr([], 'values'),
        head
      )(this.headings)

      if (displayName === 'Date Created') {
        return 'createdAt'
      }

      return compose(
        propOr(displayName, 'name'),
        find(propEq('displayName', displayName))
      )(headings)
    },
    /**
     * Compute the record url for relationship tables
     * @param {Object} scope
     */
    getRecordUrl: function(scope) {
      const recordId = pathOr('', ['row', 'recordId'])(scope)

      // file relationships
      if (recordId && recordId.includes('package')) {
        return {
          name: 'file-record',
          params: {
            conceptId: this.filesProxyId,
            instanceId: recordId
          }
        }
      }

      // collection relationship
      if (recordId && recordId.includes('collection')) {
        return {
          name: 'collection-files',
          params: {
            conceptId: this.filesProxyId,
            fileId: recordId
          }
        }
      }

      // standard relationships
      const model = this.getModelByName(this.relationship.name)
      if (model && recordId) {
        return {
          name: 'metadata-record',
          params: {
            conceptId: model.id,
            instanceId: recordId
          }
        }
      }
      return ''
    },

    /**
     * Request records data and refresh table
     */
    refreshTable: function(property, state) {
      this.isLoading = true
      switch (this.sourceType) {
        case 'sourceFile':
          this.loadSourceFiles()
          break
        case 'recordFile':
          this.loadRecordFiles(state)
          break
        default:
          // eslint-disable-next-line no-case-declarations
          const count = propOr(0, 'count', this.relationship)
          if (count === 0) {
            this.isLoading = false
            this.data = []
          } else {
            this.sendXhrRequest(this.handleTableRefreshResponse)
          }
      }
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
     * @param {Number} page
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

.remove-relationship {
  cursor: pointer;
}

.relationships-text-divider {
  display: inline-block;
  margin: 0 4px;
}

#relationships-table {
  position: relative;
  min-height: 50px;
  transition-property: min-height;
  transition-duration: 0.5s;
  transition-timing-function: ease-in;

  .load-more {
    display: inline-block;
    margin: 8px 0;
    cursor: pointer;
  }

  img.svg-icon {
    height: 24px;
    width: 24px;
  }

  &.has-data {
    min-height: 0;
  }

  .el-collapse {

    .el-collapse-item__wrap {
      border-bottom: solid 1px red;
    }
  }

  .bf-table-header button,
  thead button {
    text-transform: none;
  }
  .el-table__fixed-right,
  .el-table,
  .el-table__fixed {
    &:before {
      background: none;
    }
  }
  .el-table {
    border-radius: 4px 4px 0 0;

    .el-table__append-gutter {
      cursor: pointer;
    }

    .processing-row td:nth-child(3) {
      .cell {
        background: none; //#2760ff;
        //color: #fafafa;
        //width: fit-content;
        //font-size: 12px;
        //font-weight: 600;
        //border-radius: 6px;
        //padding-bottom: 1px;
      }
    }

    .unprocessed-row td:nth-child(3) {
      .cell {
        background: none; //#f1f1f3;
        //color: #404554;
        //width: fit-content;
        //font-size: 12px;
        //font-weight: 600;
        //border-radius: 6px;
        //padding-bottom: 1px;
      }
    }

    .failed-row td:nth-child(3) {
      .cell {
        background: none; //#e94b4b;
        ////color: #fafafa;
        //width: fit-content;
        //font-size: 12px;
        //font-weight: 600;
        //border-radius: 6px;
        //padding-bottom: 1px;
      }
    }

    .processed-row td:nth-child(3) {
      .cell {
        background: none;
      }
    }

    .download-row td:last-child {
      .cell {
        display: flex;
        justify-content: flex-end;
      }
    }
    .cell {
      padding: 0 16px;
      word-break: unset;
    }
    .file-selection .cell {
      align-content: center;
      display: flex;
      justify-content: center;
    }
    .column-no-padding .cell {
      padding: 0;
    }
  }

  .empty-state-text {
    margin: 16px 0;
    color: $gray_4;
  }
}

.relationship-title {
  align-items: center;
  display: flex;
  color: $purple_2;
  h2 {
    font-family: 'roboto';
    color: $purple_2;
    flex: 1;
    font-size: 18px;
    font-weight: 300;
    line-height: 1;
    margin: 0 0 0 8px;
  }
}

.append-skeleton-loader{
  display: flex;
  flex-direction: row;
}

</style>
