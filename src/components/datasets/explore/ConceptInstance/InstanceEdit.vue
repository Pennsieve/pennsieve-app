<template>
  <bf-stage ref="bfStage">
    <template #actions>
      <StageActions>
        <template #right>

          <div class="buttons">
            <bf-button
              class="action-button secondary"
              @click="cancelChanges"
            >
              Cancel
            </bf-button>
            <bf-button
              v-if="isCreating"
              class="action-button primary"
              :processing="savingChanges"
              processing-text="Creating Record"
              data-cy="btnCreateRecord"
              @click="createRecord"
            >
              Create Record
            </bf-button>

            <bf-button
              v-if="!isCreating"
              class="action-button primary"
              :processing="savingChanges"
              processing-text="Saving Changes"
              @click="saveChanges"
            >
              Save Changes
            </bf-button>

          </div>

        </template>
      </StageActions>
    </template>

    <!-- this renders a template with some properties for the model in it -->
    <h2 v-if="recordProperties.length > 0">
      Properties
    </h2>
    <div class="required">
      *Required
    </div>
    <div>
      <concept-instance-property
        v-for="property in properties"
        :key="property.name"
        :property="property"
        :editing="true"
        :string-subtypes="stringSubtypes"
        @add-property-value="handleAddPropertyValue"
      />

      <concept-instance-linked-property
        v-for="property in linkedProperties"
        :key="property.to.modelId"
        :property="property"
        :label="property.schemaLinkedProperty.displayName"
        @edit-linked-property="onEditLinkedProperty"
        @confirm-remove-linked-property="removeLinkedPropertyEditScreen"
      />
    </div>


      <add-linked-property-drawer
        ref="addLinkedPropertyDrawer"
        v-model:drawer-visible="addLinkedPropDrawerVisible"
        :is-creating-record="isCreating"
        @update-linked-property="onUpdateLinkedProperty"
        :linked-property="editLinkedProperty"
      />

    <!--    <add-edit-property-dialog-->
    <!--      :visible.sync="addEditPropertyDialogVisible"-->
    <!--      :concept-title-name="getConceptTitleVal('name', instance.values)"-->
    <!--      :instance="instance"-->
    <!--      :properties="Array.isArray(instance.values) ? instance.values : []"-->
    <!--      @add-property="onAddPropertyConfirm"-->
    <!--    />-->

    <!--    <concept-dialog-->
    <!--      :visible.sync="archiveDialogVisible"-->
    <!--      title="Delete Concept"-->
    <!--      confirm-text="Delete"-->
    <!--      primary-btn-class="red"-->
    <!--      @confirm="archiveRecord"-->
    <!--    >-->
    <!--      <svg-icon-->
    <!--        name="icon-trash"-->
    <!--        height="32"-->
    <!--        width="32"-->
    <!--        color="#e94b4b"-->
    <!--      />-->
    <!--      <h3>Delete {{ getConceptTitleVal('value', instance.values) }}?</h3>-->
    <!--      <p>This will also remove any links to other records you may have created.</p>-->
    <!--      <p class="archive-model-warning">-->
    <!--        <strong>This can't be undone.</strong>-->
    <!--      </p>-->
    <!--    </concept-dialog>-->

    <!--    <bf-package-dialog-->
    <!--      ref="packageDialog"-->
    <!--      :parent-folder="proxyRecord"-->
    <!--      @file-renamed="onFileRenamed"-->
    <!--    />-->

    <!--    <remove-linked-property-dialog-->
    <!--      :unlink-dialog-visible.sync="unlinkDialogVisible"-->
    <!--      :selected-linked-property.sync="selectedLinkedProperty"-->
    <!--      @remove-linked-property="onRemoveLinkedProperty"-->
    <!--    />-->
    <!--  </bf-page>-->
  </bf-stage>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex'
import {
  head,
  propOr,
  clone,
  pathOr,
  find,
  propEq,
  flatten,
  prop,
  compose,
  pluck,
  map,
  reject,
  findIndex,
  pick,
  defaultTo,
  uniq,
  join,
  prepend,
  includes,
  reverse,
  path,
  pathEq,
  uniqBy,
  isNil,
  isEmpty,
  filter
} from 'ramda'
import validUrl from 'valid-url'
import BfButton from '../../../shared/bf-button/BfButton.vue'
import PillLink from '../../../shared/PillLink/PillLink.vue'
import BfPill from '../../../shared/BfPill/BfPill.vue'
// import BfDeleteDialog from '../../files/bf-delete-dialog/BfDeleteDialog.vue'
import ConceptInstanceProperty from './ConceptInstanceProperty.vue'
import ConceptInstanceStaticProperty from './ConceptInstanceStaticProperty.vue'
import ConceptInstanceLinkedProperty from './ConceptInstanceLinkedProperty.vue'
import AddRelationshipDrawer from './AddRelationshipDrawer.vue'
// import AddFileRelationshipDrawer from './AddFileRelationshipDrawer.vue'
// import RelationshipsTable from './RelationshipsTable.vue'
// import RemoveRelationships from './RemoveRelationships.vue'
// import UnlinkFiles from './UnlinkFiles.vue'
// import AddEditPropertyDialog from '../AddEditPropertyDialog/AddEditPropertyDialog.vue'
// import ConceptDialog from '../ConceptDialog/ConceptDialog.vue'
// import LinkRecordMenu from '../LinkRecordMenu/LinkRecordMenu.vue'
// import BfPackageDialog from '../../files/bf-package-dialog/BfPackageDialog.vue'
// import BfMoveDialog from '../../files/bf-move-dialog/BfMoveDialog.vue'
import AddLinkedPropertyDrawer from './AddLinkedPropertyDrawer.vue'
// import RemoveLinkedPropertyDialog from './RemoveLinkedPropertyDialog.vue'

import EventBus from '../../../../utils/event-bus'
import Request from '../../../../mixins/request'
import TableFunctions from '../../../../mixins/table-functions'
import StorageMetrics from '../../../../mixins/bf-storage-metrics'
import ConfirmChanges from '../../../../mixins/confirm-changes'
import FileIcon from '../../../../mixins/file-icon'
import DataType from '../../../../mixins/data-type'
import formatUniqueDisplayValues from './format-display-value'
import GetConceptTitleVal from '../GetConceptTitleVal'
import StageActions from "../../../shared/StageActions/StageActions.vue";
import IconPencil from "../../../icons/IconPencil.vue" ;
import FileRelationshipsTable from "../../files/FileDetails/FileRelationshipsTable.vue";
import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";

export default {
  name: 'ConceptInstanceEdit',

  components: {
    FileRelationshipsTable,
    IconPencil,
    StageActions,
    BfButton,
    PillLink,
    ConceptInstanceProperty,
    ConceptInstanceStaticProperty,
    ConceptInstanceLinkedProperty,
    AddRelationshipDrawer,
    // AddFileRelationshipDrawer,
    // RemoveRelationships,
    // UnlinkFiles,
    // RelationshipsTable,
    // AddEditPropertyDialog,
    // ConceptDialog,
    // BfDeleteDialog,
    // LinkRecordMenu,
    // BfPackageDialog,
    // BfMoveDialog,
    AddLinkedPropertyDrawer,
    // RemoveLinkedPropertyDialog,
    // DirectoryViewer,
    // BfPill
  },

  mixins: [
    Request,
    TableFunctions,
    StorageMetrics,
    formatUniqueDisplayValues,
    ConfirmChanges,
    GetConceptTitleVal,
    FileIcon,
    DataType,
  ],

  props: {
    recordProperties: {
      type: Array,
      default: () => []
    },
    recordLinkedProperties: {
      type: Array,
      default: () => []
    },
    instanceId: {
      type: String,
      default: ''
    },
    modelId: {
      type: String,
      default: ''
    },
    datasetId: {
      type: String,
      default: ''
    },
    orgId: {
      type: String,
      default: ''
    }
  },

  data() {
    return {
      editLinkedProperty: {},
      addLinkedPropDrawerVisible: false,
      removeRelationshipsDialogVisible: false,
      addEditPropertyDialogVisible: false,
      archiveDialogVisible: false,
      activeSections: [
        'properties',
        'package',
        'recordfiles',
      ],
      linkBackObject: {
        path: "",
        name: "Records"
      },
      relationships: [],
      isAddingFiles: true,
      isDraggingFiles: false,
      isFilesLoading: false,
      isRelationshipsLoading: true,
      isRecordsLoading: false,
      showInfo: true,
      linkDropdownOpen: false,
      proxyRecord: {
        content: {},
        properties: []
      },
      instance: {
        type: '',
        values: [],
        createdAt: '',
        updatedAt: '',
        createdBy: '',
        updatedBy: '',
        id: ''
      },
      errorProperties: [],
      originalProperties: [],
      savingChanges: false,
      hasSeenRelationshipsInfo: false,
      schema: [],
      relatedFiles: [],
      moveConflict: {},
      arrayValues: {},
      relationshipTypes: [],
      linkedProperties: [],
      selectedLinkedProperty: {},
      unlinkDialogVisible: false,
      unlinkFileData: {},
      isUnlinkFileDialogVisible: false,
      relationshipNameTruncated: false,
      packageSourceFiles: {},
      isDisabled: false,
      stringSubtypes: [],
    }
  },

  computed: {

    ...mapGetters([
      'config',
      'concepts',
      'editingInstance',
      'getModelById',
      'hasFeature',
      'getPermission',
      'datasetLocked',
      'isOrgSynced'
    ]),

    ...mapState(['onboardingEvents', 'conceptsHash', 'dataset']),

    /**
     * Compute url to export file
     * @returns {String}
     */
    exportFileUrl: async function() {
      const packageId = pathOr('', ['content', 'id'], this.proxyRecord)
      return useGetToken().then(token => {
        return `${this.config.apiUrl}/packages/${packageId}/export?api_key=${token}`

      })
    },

    /**
     * Compute the package type
     * @returns {String}
     */
    computePackageType: function() {
      return pathOr('', ['content', 'packageType'], this.proxyRecord)
    },

    ownerId: function() {
      return pathOr(0, ['content', 'ownerId'], this.proxyRecord)
    },

    /**
     * Computes whether or not dataset has files
     * @returns {Boolean}
     */
    datasetHasFiles: function() {
      const storage = propOr(0, 'storage', this.dataset)
      return storage > 0
    },

    /**
     * Computes formatted display value for concept title
     * @returns {String}
     */
    formattedConceptTitle: function() {
      if (this.conceptTitle) {
        return this.formatUniqueDisplayValues(this.conceptTitle)
      }
      return '';
    },

    modelName: function() {
      if (this.model) {
        return this.model.name
      }
      return '';
    },

    /**
     * Computes data type for concept title
     * @returns {String}
     */
    dataType: function() {
      return this.getRawDataType(this.conceptTitle)
    },

    /**
     * Get model of record by route
     * @returns {Object}
     */
    model: function() {
      this.isLoaded = true
      return this.getModelById(this.modelId)
    },

    /**
     * GET url for instance details
     * @returns {String}
     */
    recordUrl: async function() {
      if (!this.isOrgSynced) {
        return Promise.reject()
      }

      const datasetId = this.datasetId
      const conceptInstanceId = this.instanceId

      return await useGetToken().then(token => {
        if (conceptInstanceId !== 'new') {
          // Conditional logic for records or proxy
          const recordUrl = `${
            this.config.conceptsUrl
          }/datasets/${datasetId}/concepts/${this.modelId}/instances/${conceptInstanceId}`
          const proxyUrl = `${
            this.config.apiUrl
          }/packages/${conceptInstanceId}?api_key=${
            token
          }&includeAncestors=true`

          return this.isFile ? proxyUrl : recordUrl
        }
      })
    },

    /**
     * Check if Concept has Relationships
     * @returns {Boolean}
     */
    hasRelationships: function() {
      return this.relationships.length > 0
    },

    /**
     * Compute properties
     * @returns {Array}
     */
    properties: function() {
      const values = propOr([], 'values', this.instance)
      return Array.isArray(values) ? values : []
    },

    /**
     * Compute instance name from first property
     * @returns {String}
     */
    conceptTitle: {
      get: function() {
        return find(propEq('conceptTitle', true), this.instance.values)
      },

      set: function(newValue) {
        if (this.instance.values.length) {
          let conceptTitle = find(
            propEq('conceptTitle', true),
            this.instance.values
          )
          if (conceptTitle) {
            conceptTitle = newValue
          }
        }
      }
    },




    /**
     * Model URL
     * @returns {String}
     */
    modelUrl: function() {
      const datasetId = pathOr('', ['params', 'datasetId'], this.$route)
      const modelId = this.modelId
      return `${this.config.conceptsUrl}/datasets/${datasetId}/concepts/${modelId}`
    },

    /**
     * Get model schema URL
     * @returns {String}
     */
    getModelSchemaUrl: function() {
      return `${this.modelUrl}/properties`
    },

    getRecordFileRelationshipsUrl: function() {
      const datasetId = this.datasetId
      const modelId = this.modelId
      const recordId = this.instanceId

      return `${
        this.config.conceptsUrl
      }/datasets/${datasetId}/concepts/${modelId}/instances/${recordId}/files-paged`
    },

    /**
     * GET url for relationships and corresponding counts
     */
    relationshipCountsUrl: function() {

      const datasetId = this.datasetId
      const modelId = this.modelId
      const recordId = this.instanceId

      let url = `${
        this.config.conceptsUrl
      }/datasets/${datasetId}/concepts/${modelId}/instances/${recordId}/relationCounts?includeIncomingLinkedProperties=true`

      if (this.isFile) {
        url = `${
          this.config.conceptsUrl
        }/datasets/${datasetId}/proxy/package/external/${recordId}/relationCounts`
      }

      return url
    },

    /**
     * Compute if the user is creating a record
     */
    isCreating: function() {
      const recordId = pathOr('', ['params', 'instanceId'], this.$route)
      return recordId === 'new'
    },

    /**
     * Compute relationships list without the files relationship
     * @returns {Array}
     */
    relationshipsModels: function() {
      return reject(propEq('name', 'package'), this.relationships)
    },

    fileRelationship: function() {
      const fileIndex = this.relationships.findIndex(
        rel => rel.name === 'package'
      )
      if (fileIndex === 0) {
        return this.relationships[fileIndex]
      }
      return {}
    },

    relationshipsUrl: function() {
      const datasetId = pathOr('', ['params', 'datasetId'], this.$route)
      if (datasetId) {
        return `${this.config.conceptsUrl}/datasets/${datasetId}/relationships`
      }
      return ''
    },

    /**
     * Compute list items for the Add Relationship dropdown menu
     * @return {Array}
     */
    relationshipSelectItems: function() {
      if (this.concepts) {
        return this.concepts.filter(concept => concept.count > 0)
      }
      return []
    },

    /**
     * Compute proxyRecord file ID
     * @returns {String}
     */
    fileId: function() {
      return pathOr('', ['content', 'id'], this.proxyRecord)
    },

    /**
     * Compute relationship types url
     * @returns {String}
     */
    relationshipTypesUrl: function() {
      const datasetId = pathOr('', ['params', 'datasetId'], this.$route)
      const conceptsUrl = propOr('', 'conceptsUrl', this.config)

      if (conceptsUrl && datasetId) {
        return `${conceptsUrl}/datasets/${datasetId}/relationships`
      }
      return ''
    },

    /**
     * Compute if concepts and relationships have loaded
     * @returns {Boolean}
     */
    hasConceptsAndRelationships: function() {
      return this.concepts.length > 0 && !this.isRelationshipsLoading
    },

    /**
     * Compute options to display in the link to record menu
     * @returns {Array}
     */
    linkRecordOptions: function() {
      return this.isFile ? this.concepts : this.relationships
    },

    /**
     * Compute name for original record in the add relationships drawer
     * @returns {String}
     */
    drawerOriginatingName: function() {
      const val = this.isFile
        ? pathOr('', ['content', 'name'], this.proxyRecord)
        : this.$sanitize(this.formattedConceptTitle)
      return val !== undefined ? val.toString() : val
    },

    /**
     * Schema Linked Properties URL
     * @returns {String}
     */
    schemaLinkedPropertiesUrl: function() {
      return `${
        this.config.conceptsUrl
      }/datasets/${this.datasetId}/concepts/${this.modelId}/linked`
    },

    /**
     * Linked Properties URL
     * @returns {String}
     */
    linkedPropertiesUrl: function() {
      if (this.instanceId === 'new') {
        return
      }

      return `${
        this.config.conceptsUrl
      }/datasets/${this.datasetId}/concepts/${this.modelId}/instances/${this.instanceId}/linked`
    },

    /**
     * compute the url to fetch the valid string subtypes
     * @returns {String}
     */
    stringSubtypeUrl: async function() {
      useGetToken()
        .then((token) => {
          const datasetId = pathOr('', ['params', 'datasetId'], this.$route)
          if (this.config.apiUrl && token && datasetId) {
            return `${this.config.apiUrl}/models/datasets/${datasetId}/properties/strings?api_key=${token}`
          }
          return ''
        })
    }
  },

  watch: {


    recordUrl: {
      handler: function(val) {
        if (val) {
          this.getInstanceDetails().then(() => {
            if (this.conceptsHash && !isEmpty(this.conceptsHash)) {
              this.getSchemaLinkedProperties().then(this.getLinkedProperties)
            }
          })
        }
      },
      immediate: true
    },

    '$route.params.instanceId': {
      handler: function(val) {
        this.$nextTick(function() {
          if (this.$refs.bfStage){
            this.$refs.bfStage.scrollToTop()
          }
        })
        if (val === 'new') {
          this.setupCreateRecord()
        }
      },
      immediate: true
    },

    relationshipCountsUrl: {
      handler: function(val) {
        const newRoute = this.$route.path.indexOf('/new') > 0
        if (val && !newRoute) {
          this.relationships = []
          this.getRelationshipCounts()
        }
      },
      immediate: true
    },

    hasConceptsAndRelationships: {
      handler: function(val) {
        if (val) {
          this.getRelationshipTypes()
        }
      },
      immediate: true
    },

    conceptsHash: {
      handler: function(val) {
        if (val && !isEmpty(val)) {
          this.getSchemaLinkedProperties().then(this.getLinkedProperties)
        }
      },
      immediate: true
    },

    stringSubtypeUrl: {
      async handler() {
        if (await this.stringSubtypeUrl) {
          this.fetchStringSubtypes()
        }
      },
      immediate: true
    }
  },

  mounted: function() {
    // // Listen for property value changes
    // EventBus.$on('instance-value-changed', this.onValueChanged)
    //
    // // Listen for property value errors
    // EventBus.$on('instance-value-error', this.onValueError)
    //
    // // Fetch new data for a given table
    // EventBus.$on('refresh-table-data', this.refreshTableData)
    //
    // // Open proper drawer component
    // // EventBus.$on('add-relationship', this.handleAddRelationship)
    //
    // // Update the relationships state
    // EventBus.$on('update-relationships-list', this.updateRelationshipsList)
    //
    // // Check if user has seen relationships empty state info
    // const hasSeenRelationshipsInfo = localStorage.getItem(
    //   'seen-relationships-info'
    // )
    // if (hasSeenRelationshipsInfo === 'true') {
    //   this.hasSeenRelationshipsInfo = true
    // }
    //
    // EventBus.$on('update-external-file', this.onExternalFileUpdate)

  },

  beforeUnmount() {
    // EventBus.$off('instance-value-changed', this.onValueChanged)
    // EventBus.$off('instance-value-error', this.onValueError)
    // EventBus.$off('refresh-table-data', this.refreshTableData)
    // // EventBus.$off('add-relationship', this.handleAddRelationship)
    // EventBus.$off('update-relationships-list', this.updateRelationshipsList)
    // EventBus.$off('update-external-file', this.onExternalFileUpdate)
  },

  methods: {
    ...mapActions([
      'updateEditingInstance',
      'updateConcepts',
      'updateOnboardingEvents'
    ]),

    ...mapActions('filesModule', [
      'openOffice365File'
    ]),

    cancelChanges: function() {
      console.log('cancel changes')
    },
    /**
     * retrieves the string subtype configuration used to populate the AddEditPropertyDialog
     */
    fetchStringSubtypes: function() {
      this.stringSubtypeUrl
        .then((url) => {
          this.sendXhr(url)
            .then(subTypes => {
              this.stringSubtypes = Object.entries(subTypes).reduce(
                (options, [val, config]) => ([...options, {value: val, label: config.label, regex: config.regex}]),
                []
              )
            })
            .catch(response => {
              this.handleXhrError(response)
            })
        })

    },

    /**
     * Determines if destination record exists and user can add relationship
     * @param {String} modelName
     * @returns {Boolean}
     */
    canAddRelationship(modelName) {
      const model = find(propEq('name', modelName), this.concepts)
      const modelCount = propOr(0, 'count', model)
      return modelCount > 0
    },

    /**
     * Request relationship types
     */
    getRelationshipTypes: function() {
      if (this.relationshipsUrl) {
        useGetToken()
          .then(token => {
            useSendXhr(this.relationshipsUrl, {
              header: {
                Authorization: `bearer ${token}`
              }
            }).then(response => {
              // get model id

              // check to see which relationship types are related to the current record id
              const relatedRelationshipTypes = response.filter(relType =>
                Boolean(relType.from === this.modelId || relType.to === this.modelId)
              )


              // format objects for relationships state (relationship count pill buttons) and relationshipTypes state
              const relationships = relatedRelationshipTypes.map(relType => {
                const { to, from } = relType
                const isFrom = Boolean(from === this.modelId)
                const relModelId = isFrom ? to : from
                const { displayName, name, id } = this.getModelById(relModelId)

                // update relationship types state, adding modelName and modelId to DTO

                this.relationshipTypes.push({
                  ...relType,
                  modelName: name,
                  modelId: id
                })



                // return relationship count object
                return { count: 0, displayName, name }
              })

              // update relationships state
              this.relationships = uniqBy(prop('displayName'), [
                ...this.relationships,
                ...relationships
              ])

              // update active sections state
              const relationshipNames = pluck('name', this.relationships)
              this.activeSections = uniq([
                ...this.activeSections,
                ...relationshipNames
              ])
            })
          }).catch(err => useHandleXhrError(err))

      }
    },

    /**
     * Compute relationship name tooltip
     * @returns {Object}
     */
    relationshipNameTooltip: function(name) {
      if (name.length > 20) {
        return {
          content: name
        }
      }
      return {}
    },

    /**
     * Tracks property values that are of type arrays
     * @param  {Object} obj
     */
    handleAddPropertyValue: function(obj) {
      const updatedArrayValues = Object.assign({}, this.arrayValues, obj)
      this.arrayValues = updatedArrayValues
    },

    /**
     * Increments property count for concept in state
     * @param {Number} count
     */
    incrementPropertyCount: function(count) {
      const updatedConcepts = this.concepts.map(concept => {
        if (concept.id === this.modelId) {
          concept.propertyCount = count
        }
        return concept
      })
      this.updateConcepts(updatedConcepts)
    },

    /**
     * Open file relationship drawer
     */
    handleChooseExistingFiles: function() {
      this.$refs.addFileRelationshipDrawer.openDrawer(this.model.id)
    },

    /**
     * Reset instance when user confirms loss of changes
     */
    onConfirmLossOfChanges: function() {
      this.resetInstance()
    },

    /**
     * Gets relationships and corresponding counts
     */
    getRelationshipCounts: function() {
      const url = this.relationshipCountsUrl

      if (!url) {
        return
      }

      this.isRelationshipsLoading = true

      useGetToken()
        .then(token => {
          this.sendXhr(url, {
            header: {
              Authorization: `bearer ${token}`
            }
          })
            .then(resp => {
              resp.forEach(obj => {
                this.activeSections.push(obj.name)
              })

              const filesIdx = findIndex(propEq('name', 'package'), resp)
              if (filesIdx >= 0) {
                const filesObj = resp[filesIdx]
                resp.splice(filesIdx, 1)
                resp.unshift(filesObj)
                this.relationships = resp
              } else {
                this.relationships = resp
              }
              if (this.relationships.count !== this.lastRelationshipCount) {
                this.relationships.count = this.lastRelationshipCount
              }
              this.isRelationshipsLoading = false
            })

        }).catch(err => useHandleXhrError(err))

    },
    /**
     * Gets instance details
     */
    getInstanceDetails: function() {
      const url = this.recordUrl

      return useGetToken(token => {
        return this.sendXhr(url, {
          header: {
            Authorization: `bearer ${token}`
          }
        })
          .then(resp => {
            if (this.isFile) {
              this.setProxyAsRecord(resp)
            } else {
              this.instance = resp
            }
          })
          .catch(this.handleXhrError.bind(this))
      })

    },

    /**
     * Handle table refresh events
     * @param {Object} data
     */
    refreshTableData: function(data) {
      const relName = propOr('', 'name', data)
      const count = propOr(0, 'count', data)
      const type = propOr('', 'type', data)

      let table
      if (relName === 'package') {
        table = propOr(null, 'package', this.$refs)
      } else {
        table = pathOr(null, [relName, 0])(this.$refs)
      }
      const relIdx = this.getRelationshipIdx(relName, table)

      // Add new table if relationship doesn't exist
      if (relIdx < 0) {
        this.addTable(relName, data)
        return
      }

      const relationship = this.relationships[relIdx]
      if (type === 'Remove') {
        this.handleTableRemoveUpdate(table, count, relationship, relIdx)
      } else if (type === 'Add') {
        this.handleTableAddUpdate(table, count, relationship)
      }
    },

    /**
     * Get a relationship index given a relationship name
     * @param {String} relName
     * @param {Object} table
     */
    getRelationshipIdx: function(relName, table) {
      if (relName === 'package' && !table) {
        return -1
      } else if (relName === 'package' && table) {
        return 0
      }
      return this.relationships.findIndex(rel => rel.name === relName)
    },

    /**
     * Add a new table to the dom by updating the relationships state
     * @param {String} relName
     * @param {Object} data
     */
    addTable: function(relName, data) {
      this.activeSections.push(relName)

      if (relName !== 'package') {
        this.relationships.push(data)
      } else {
        this.relationships.unshift(data)
      }
    },

    /**
     * Remove items from a given table and update relationships list state
     * @param {Object} table
     * @param {Number} count
     * @param {Object} relationship
     */
    handleTableRemoveUpdate: function(table, count, relationship) {
      if (table && relationship) {
        table.selection = []
        relationship.count -= count
        this.lastRelationshipCount = relationship.count
        const state = 'Deleted File'
        table.refreshTable()

      }
    },

    /**
     * Add items to a given table and update relationships list state
     * @param {Object} table
     * @param {Number} count
     * @param {Object} relationship
     */
    handleTableAddUpdate: function(table, count, relationship) {
      if (table && relationship) {
        relationship.count += count
        table.refreshTable()
      }
    },

    /**
     * Open remove relationships confirmation window
     * @param {Object} data
     */
    handleRemoveRelationships: function(data) {
      const ref = this.$refs.removeRelDialog
      ref.tableName = data.tableName
      ref.relationships = data.relationships
      ref.datasetId = this.dataset.content.id
      this.removeRelationshipsDialogVisible = true
    },

    /**
     * Open remove relationships confirmation window
     * @param {Object} data
     */
    handleUnlinkFiles: function(data) {
      this.isUnlinkFileDialogVisible = true
      this.unlinkFileData = {
        tableName: data.tableName,
        relationships: data.relationships,
        datasetId: this.dataset.content.id
      }
    },

    /**
     * Sets related files
     * @param {Array} data
     */
    handleSetRelatedFiles: function(data) {
      this.relatedFiles = data
    },

    /**
     * Update relationships state after user creates new relationships
     * @param {Array} relationships
     */
    updateRelationshipsList: function(relationships) {
      relationships.forEach(relationship => {
        this.relationships.push(relationship)
      })
    },
    /**
     * Handles add relationship events
     * @param {String} conceptName
     */
    handleAddRelationship: function(conceptName) {
      const idx = this.concepts.findIndex(c => c.name === conceptName)
      const conceptId = pathOr('', [idx, 'id'])(this.concepts)
      if (this.modelId) {
        this.$refs.addRelationshipDrawer.openDrawer(conceptId)
      } else if (conceptName === 'package') {
        this.$refs.addFileRelationshipDrawer.openDrawer(this.model.id)
      }
    },
    /**
     * Handles link record menu selections for adding relationships
     * @param {String} command
     */
    onLinkRecordMenuClick: function(command) {
      if (command === 'files') {
        this.$refs.addFileRelationshipDrawer.openDrawer(this.model.id)
      } else {
        this.$refs.addRelationshipDrawer.openDrawer(command)
      }
    },

    /**
     * Get the arrow direction based on section name and if it is active
     * @param {string} sectionName
     * @returns {string}
     */
    arrowDirection: function(sectionName) {
      const isActive = includes(sectionName, this.activeSections)
      return isActive ? 'down' : 'right'
    },

    /**
     * Enable edit mode
     */
    enableEdit: function() {
      this.updateEditingInstance(true)
      this.originalProperties = clone(this.instance.values)
    },

    /**
     * Enable edit mode and focus on the property
     * @param {String} name
     */
    enableEditFocus: function(name) {
      this.enableEdit()

      // Focus on the input
      this.$nextTick(function() {
        const input = this.$el.querySelector(`#input-${name}`)
        if (input) {
          input.focus()
        }
      })
    },

    /**
     * Dismiss relationships empty state info
     */
    dismissRelationshipsInfo: function() {
      this.hasSeenRelationshipsInfo = true
      localStorage.setItem('seen-relationships-info', true)
    },
    /**
     * Cancel edit mode
     */
    cancelEdit: function() {
      if (this.confirmLossOfChanges()) {
        // Check if user is creating a record
        if (this.isCreating) {
          this.resetInstance()

          //  Change the route and default to the dataset explore page
          let name = propOr('records', 'name', this.lastRoute)
          // if user is attempting to create a new record and cancels, they should go back to search
          if (name === 'concept-instance') {
            name = 'dataset-records'
          }
          this.$router.replace({
            name
          })
        } else {
          this.resetInstance()
        }
      }
    },
    /**
     * Reset the instance back to original state
     */
    resetInstance: function() {
      this.updateEditingInstance(false)
      this.changedProperties = []
      this.errorProperties = []
      this.instance.values = clone(this.originalProperties)
      this.originalProperties = []
    },

    /**
     * Listen for value changes and modify the list that keeps track of changes
     * @param {Object} prop
     */
    onValueChanged: function(prop) {
      if (prop.changed) {
        this.changedProperties.push(prop.name)
      } else {
        const index = this.changedProperties.indexOf(prop.name)
        if (index >= 0) {
          this.changedProperties.splice(index, 1)
        }
      }
    },

    /**
     * Listen for value errors and modify the list that keeps track of errors
     * @param {Object} prop
     */
    onValueError: function(prop) {
      if (prop.error) {
        this.errorProperties.push(prop.name)
      } else {
        const index = this.errorProperties.indexOf(prop.name)
        if (index >= 0) {
          this.errorProperties.splice(index, 1)
        }
      }
    },

    /**
     * Send record to the API to be created
     */
    createRecord: async function() {
      const allRequiredFieldsValid = this.validateRequiredFields()

      if (this.errorProperties.length === 0 && allRequiredFieldsValid) {
        this.savingChanges = true

        const datasetId = this.$route.params.datasetId
        const url = `${this.config.conceptsUrl}/datasets/${datasetId}/concepts/${this.modelId}/instances`

        const values = this.formatSavedValues()

        useGetToken()
          .then(token => {
            return useSendXhr(url, {
              header: {
                Authorization: `bearer ${token}`
              },
              method: 'POST',
              body: {
                values
              }
            }).then(record => {
              const batchUrl = `${url}/${record.id}/linked/batch`

              return this.createBatchLinkedProperties(batchUrl, this.linkedProperties)
                .then(resp => {
                  // check for onboarding event state for creating a record
                  if (!this.onboardingEvents.some(e => e === 'CreatedRecord')) {
                    // make post request
                    this.sendOnboardingEventsRequest()
                  }

                  // Redirect user to new concept instance page
                  this.$router.replace({
                    name: 'metadata-record',
                    params: {
                      instanceId: record.id
                    }
                  })

                  // Update count for model
                  const index = findIndex(
                    propEq('name', this.model.name),
                    this.concepts
                  )

                  const updatedConcepts = this.concepts.slice()
                  updatedConcepts[index].count++

                  return this.updateConcepts(updatedConcepts).then(() => {
                    this.savingChanges = false
                    this.updateEditingInstance(false)
                    this.changedProperties = []
                    this.errorProperties = []
                  })
                })
            })

          }).catch(err => {

          this.processing = false
          this.savingChanges = false
          useHandleXhrError(e)
        })

      }
    },

    createBatchLinkedProperties: function(url, linkedProperties) {
      /**
       * Remove all empty linked properties, and then transform
       * the shape to match the endpoint's body
       */
      const properties = linkedProperties.filter(property => {
        return property.to.recordId !== ''
      }).map(property => {
        return {
          name: property.schemaLinkedProperty.name,
          schemaLinkedPropertyId: property.schemaLinkedProperty.id,
          to: property.to.recordId
        }
      })

      return useGetToken()
        .then(token => {
          return this.sendXhr(url, {
            header: {
              Authorization: `bearer ${token}`
            },
            method: 'POST',
            body: {
              data: properties
            }
          })
        }).catch(err => useHandleXhrError(err))

    },

    /**
     * Formats numbers based on property's data type
     * @param {String} dataType
     * @param {Object} val
     * @returns {Object|Number}
     */
    formatNumber: dataType => val =>
      dataType === 'Long' || dataType === 'Double'
        ? val == '' || val == null
          ? null
          : Number(val)
        : val,

    /**
     * Formats property array values
     * @param {String} name
     * @param {String} dataType
     * @returns {Array|undefined}
     */
    formatArrayValues: function(name, dataType) {
      const values = this.arrayValues[name]
      if (!values) {
        return
      }
      const formatter = this.formatNumber(dataType)
      const formattedValues = values.map(formatter).filter(Boolean)
      const uniqValues = flatten(uniq(formattedValues))
      return uniqValues.length > 0 ? uniqValues : null
    },

    /**
     * Formats saved values based on data type
     * @returns {Array}
     */
    formatSavedValues: function() {
      const instanceValues = propOr([], 'values', this.instance)
      const values = instanceValues.map(val => {
        const name = val.name
        const propValue = val.value
        const dataType = this.getRawDataType(val)
        const formattedValue = this.formatNumber(dataType)(propValue)
        const arrayValue = this.formatArrayValues(name, dataType)
        const value = defaultTo(formattedValue, arrayValue)
        // update the instance values to refresh the rendered values
        val.value = value
        return { value, name }
      })
      return values
    },

    /**
     * Validates if all required fields have been entered
     * @returns {Boolean}
     */
    validateRequiredFields: function() {
      const nullVals = this.properties.filter(obj => {
        const isArray = pathEq(['dataType', 'type'], 'array', obj)
        return (isEmpty(obj.value) || isNil(obj.value)) && (obj.required || obj.conceptTitle) && !isArray
      })
      const arrayNullVals = Object.keys(this.arrayValues).filter(key => {
        const prop = find(propEq('name', key), this.properties)
        const isRequired = propOr(false, 'required', prop)
        const containsNull = !head(this.arrayValues[key])
        if (isRequired && containsNull) {
          return prop
        }
      })
      if (nullVals.length > 0 || arrayNullVals.length > 0) {
        // emit toast
        EventBus.$emit('toast', {
          detail: {
            type: 'error',
            msg: 'Please make sure all required fields have been entered'
          }
        })
        return false
      }
      return true
    },

    /**
     * Save property changes
     */
    saveChanges: function() {
      const allFieldsRequired = this.validateRequiredFields()

      if (this.errorProperties.length === 0 && allFieldsRequired) {
        this.savingChanges = true
        const url = this.recordUrl
        const values = this.formatSavedValues()

        useGetToken()
          .then(token => {
            this.sendXhr(url, {
              header: {
                Authorization: `bearer ${token}`
              },
              method: 'PUT',
              body: {
                values
              }
            })
              .then(resp => {
                this.savingChanges = false
                this.updateEditingInstance(false)
                this.changedProperties = []
                this.errorProperties = []

                const values = propOr([], 'values', resp)
                this.instance.values = values
                EventBus.$emit('toast', {
                  detail: {
                    type: 'success',
                    msg: `${this.$sanitize(this.formattedConceptTitle)} updated`
                  }
                })

                EventBus.$emit('track-event', {
                  name: 'Record Saved'
                })
              })
              .catch(err => {
                this.processing = false
                this.savingChanges = false
                this.handleXhrError(err)
              })
          }).catch(err => useHandleXhrError(err))

      }
    },

    /**
     * Listener for rafter overflow menu click
     * @param {String} command
     */
    onOverflowMenuClick: function(command) {
      const commands = {
        archive: this.showArchiveDialog,
        addProperty: this.openAddProperty,
        'rename-file': this.showRenameFileDialog,
        'edit-file': this.showEditFileDialog,
        'move-file': this.showMove,
        'delete-file': this.showDeleteDialog
      }

      const handler = commands[command]

      if (typeof handler === 'function') handler()
    },

    /**
     * Open the add property dialog
     */
    openAddProperty: function() {
      this.addEditPropertyDialogVisible = true
    },

    /**
     * Add property to current instance
     * @param {Object} property
     */
    onAddPropertyConfirm: function(property) {
      // Get model's schema
      if (this.schema.length === 0) {
        this.getModelSchema()
          .then(response => {
            this.schema = response
            this.addProperty(property)
            // increment property count
            this.incrementPropertyCount(response.length + 1)
          })
          .catch(response => {
            this.handleXhrError(response)
          })
      } else {
        this.addProperty(property)
        // increment property count
        const incr = this.model.propertyCount + 1
        this.incrementPropertyCount(incr)
      }
    },

    /**
     * Send add property request to API
     * @param {Object} property
     */
    addProperty: function(property) {
      // Check if property is a modelTitle
      let properties = clone(this.schema)
      properties = this.checkModelTitle(property, properties)
      properties.push(property)

      useGetToken()
        .then(token => {
          return useSendXhr(this.getModelSchemaUrl, {
            header: {
              Authorization: `bearer ${token}`
            },
            method: 'PUT',
            body: properties
          })
            .then(() => {
              // Check model title for existing properties before adding new one
              this.checkModelTitle(property, this.instance.values)

              this.instance.values.push(property)

              this.addEditPropertyDialogVisible = false
            })
        }).catch(err => useHandleXhrError(err))

    },

    /**
     * Check if new property is the model title, and unset the old one
     * @param {Object} property
     * @param {Array} list
     */
    checkModelTitle(property, list) {
      if (property.conceptTitle) {
        const curModelTitle = find(propEq('conceptTitle', true), list)
        curModelTitle.conceptTitle = false
      }

      return list
    },

    /**
     * Get model schema from API
     */
    getModelSchema: function() {
      return useGetToken()
        .then(token => {
          return this.sendXhr(this.getModelSchemaUrl, {
            header: {
              Authorization: `bearer ${token}`
            }
          })
        }).catch(err => useHandleXhrError(err))

    },

    /**
     * Get schema and setup state to create a record with that schema
     */
    setupCreateRecord: function() {
      this.isRecordsLoading = true
      if (this.getModelSchemaUrl) {
        this.linkedProperties = []
        this.relationships = []

        this.resetInstance()

        this.getModelSchema()
          .then(response => {
            this.schema = response
            this.instance = {
              values: response
            }

            // Focus on the model title input
            const modelTitleName = propOr('', 'name', this.conceptTitle)
            this.enableEditFocus(modelTitleName)
            this.isRecordsLoading = false
          })
          .catch(response => {
            this.handleXhrError(response)
            this.isRecordsLoading = false
          })

        this.getSchemaLinkedProperties()
      }
    },

    /**
     * Transform properties into flat list and convert shape
     * @param {Array} list
     * @returns {Array}
     */
    getProperties: compose(
      map(obj => {
        return {
          conceptTitle: false,
          dataType: obj['dataType'],
          default: true,
          displayName: obj['key'],
          locked: false,
          name: obj['key'],
          value: obj['value']
        }
      }),
      flatten(),
      pluck('properties')
    ),

    /**
     * Set proxy as record, and transform properties
     * @param {Object} response
     */
    setProxyAsRecord: function(response) {
      // Set the proxyRecord
      this.proxyRecord = response

      this.selectedFiles.push(response)
    },

    /**
     * GET url for record relationships tables
     */
    getRecordRelationshipsUrl: function(conceptName) {
      let url = `${
        this.config.conceptsUrl
      }/datasets/${this.datasetId}/concepts/${this.modelId}/instances/${this.instanceId}/relations/${conceptName}`

      if (this.isFile) {
        url = `${
          this.config.conceptsUrl
        }/datasets/${this.datasetId}/proxy/package/external/${this.instanceId}/relations/${conceptName}/files`
      }

      return url
    },

    /**
     * Check if a belongs_to relationship type exists in the current dataset
     */
    checkForDefaultRelationship: function() {
      // check if belongs_to relationship exists in dataset
      const url = this.relationshipsUrl
      if (url) {
        useGetToken().then(token => {
          this.sendXhr(url, {
            header: {
              Authorization: `bearer ${token}`
            }
          })
            .then(resp => {
              const belongsTo = find(propEq('name', 'belongs_to'), resp)
              if (resp.length === 0 || !belongsTo) {
                this.createDefaultRelationship()
              }
            })
            .catch(this.handleXhrError.bind(this))
        })

      }
    },

    /**
     * Creates default relationship
     */
    createDefaultRelationship: function() {
      useGetToken().then(token => {
        this.sendXhr(this.relationshipsUrl, {
          method: 'POST',
          header: {
            Authorization: `bearer ${token}`
          },
          body: {
            name: 'belongs_to',
            displayName: 'Belongs To',
            description: '',
            schema: []
          }
        }).catch(this.handleXhrError.bind(this))
      })

    },

    /**
     * Handler for delete files XHR
     */
    onDelete: function() {
      const payload = {
        name: 'package',
        count: this.selectedFiles.length,
        type: 'Remove'
      }
      this.refreshTableData(payload)
    },

    /**
     * Send Onboarding Events Request
     */
    sendOnboardingEventsRequest: function() {
      if (this.onboardingEventsUrl) {
        useGetToken().then(token => {
          this.sendXhr(
            `${this.config.apiUrl}/onboarding/events?api_key=${token}`,
            {
              method: 'POST',
              body: 'CreatedRecord',
              header: {
                Authorization: `bearer ${token}`
              }
            }
          )
            .then(() => {
              const onboardingEvents = [...this.onboardingEvents, 'CreatedRecord']
              this.updateOnboardingEvents(onboardingEvents)
            })
            .catch(this.handleXhrError.bind(this))
        })

      }
    },

    /**
     * Get schema linked properties
     * @returns {Promise}
     */
    getSchemaLinkedProperties: function() {
      if (this.schemaLinkedPropertiesUrl) {
        useGetToken().then(token => {
          return this.sendXhr(this.schemaLinkedPropertiesUrl, {
            header: {
              Authorization: `bearer ${token}`
            }
          })
            .then(response => {
              // filter out linked properties that aren't associated
              const linkedProperties = response.filter(item =>
                Boolean(item.link.from === this.modelId)
              )
              this.linkedProperties = this.transformLinkedProperties(
                linkedProperties
              )
            })
            .catch(response => {
              this.handleXhrError(response)
            })
        })

      }

      return Promise.resolve()
    },

    /**
     * Transform raw linked properties data
     * @param {Array} linkedProperties
     * @returns {Array}
     */
    transformLinkedProperties: function(linkedProperties) {
      return linkedProperties.map(linkedProperty => {
        const model = this.conceptsHash[linkedProperty.link.to]

        return {
          schemaLinkedProperty: {
            id: linkedProperty.link.id,
            name: linkedProperty.link.displayName,
            displayName: linkedProperty.link.displayName
          },
          to: {
            modelId: model.id,
            modelDisplayName: model.displayName,
            recordId: '',
            recordDisplayName: ''
          }
        }
      })
    },

    /**
     * Get linked properties
     */
    getLinkedProperties: function() {
      if (this.linkedPropertiesUrl) {
        useGetToken().then(token => {
          this.sendXhr(this.linkedPropertiesUrl, {
            header: {
              Authorization: `bearer ${token}`
            }
          })
            .then(response => {
              response.forEach(linkedProperty => {
                const idx = this.linkedProperties.findIndex(item => {
                  return (
                    item.schemaLinkedProperty.id ===
                    linkedProperty.schemaLinkedPropertyId
                  )
                })
                const updatedLinkedProperty = this.linkedProperties[idx]
                updatedLinkedProperty.linkedPropertyId = linkedProperty.id
                updatedLinkedProperty.to.recordId = linkedProperty.to

                this.setLinkedPropertyDisplayName(updatedLinkedProperty, idx)
              })
            })
            .catch(response => {
              this.handleXhrError(response)
            })
        })

      }
    },

    /**
     * Open remove linked property modal
     * @param {Object} linkedProperty
     */
    openLinkedPropertyModal: function(linkedProperty) {
      this.selectedLinkedProperty = linkedProperty
      this.unlinkDialogVisible = true
    },

    /**
     * Open linked property drawer
     * @param {Object} property
     */
    onEditLinkedProperty: function(property) {
      this.editLinkedProperty = property
      this.addLinkedPropDrawerVisible = true
      this.$refs.addLinkedPropertyDrawer.openDrawer(property)
    },

    /**
     * Handle remove-linked-property event
     * @param {Object} linkedProperty
     */
    onRemoveLinkedProperty: function(linkedProperty) {
      const idx = this.linkedProperties.findIndex(item => {
        return (
          item.schemaLinkedProperty.id ===
          linkedProperty.schemaLinkedProperty.id
        )
      })
      const updatedLinkedProperty = this.linkedProperties[idx]
      updatedLinkedProperty.to.recordId = ''
      updatedLinkedProperty.to.recordDisplayName = ''

      this.linkedProperties.splice(idx, 1, updatedLinkedProperty)
    },

    /**
     * Handle update-linked-property event
     * @param {Object} linkedProperty
     */
    onUpdateLinkedProperty: function(linkedProperty) {
      const idx = this.linkedProperties.findIndex(item => {
        return (
          item.schemaLinkedProperty.id === linkedProperty.schemaLinkedPropertyId
        )
      })
      const updatedLinkedProperty = this.linkedProperties[idx]
      updatedLinkedProperty.to.recordId = linkedProperty.to
      updatedLinkedProperty.linkedPropertyId = linkedProperty.id

      this.setLinkedPropertyDisplayName(updatedLinkedProperty, idx)
    },

    /**
     * Get a record
     * @param {Object} linkedProperty
     * @param {Number} index
     */
    setLinkedPropertyDisplayName: function(linkedProperty, index) {

      if (!this.instanceId) {
        return
      }

      const recordUrl = `${
        this.config.conceptsUrl
      }/datasets/${this.datasetId}/concepts/${this.modelId}/instances/${this.instanceId}`

      useGetToken().then(token => {
        this.sendXhr(recordUrl, {
          header: {
            Authorization: `bearer ${token}`
          }
        })
          .then(resp => {
            const displayName = propOr('', 'value', head(resp.values))
            linkedProperty.to.recordDisplayName = displayName
            this.linkedProperties.splice(index, 1, linkedProperty)
          })
          .catch(this.handleXhrError.bind(this))
      })

    },

    /**
     * On remove linked property, either show the confirm
     * dialog, or remove "staged" linked property (when creating)
     * @params {Object} property
     */
    removeLinkedPropertyEditScreen: function(property) {
      this.isCreating
        ? this.onRemoveLinkedProperty(property)
        : this.openLinkedPropertyModal(property)
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../../../../assets/_variables.scss';

.buttons {
  .action-button {
    margin-left: 8px;
  }
}

</style>

