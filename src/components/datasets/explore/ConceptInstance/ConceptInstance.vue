<template>
    <bf-stage
      ref="bfStage"
      :is-editing="editingInstance"
    >

      <template #actions>
        <StageActions v-if="!editingInstance">
          <template #right>
              <div class="relationships-list">
                <link-record-menu
                  v-if="getPermission('editor')"
                  class="mr-8 mb-8"
                  :relationships="linkRecordOptions"
                  :show-existing-file="!isFile"
                  @menu-click="onLinkRecordMenuClick"
                />

              </div>

              <!-- BEGIN PENCIL EDIT BUTTON -->
              <router-link
                :to="{ name: 'metadata-record-edit', params: {
                  orgId: orgId,
                  datasetId: datasetId,
                  instanceId: instanceId
                  } }"
              >
                <bf-button
                  v-if="!isRecordsLoading && !isFile && getPermission('editor')"
                  class="primary icon"
                  :disabled="datasetLocked"
                >
                  <IconPencil
                    class="icon-pencil"
                  />
                </bf-button>
              </router-link>


              <!-- END PENCIL EDIT BUTTON -->

          </template>
          <template #left>
            <div
              v-for="relationship in relationships"
              :key="relationship.name"
              class="mb-8 mr-8"
            >
              <div v-if="relationship.displayName.length > 20">
                <el-tooltip
                  placement="top"
                  :content="relationship.displayName"
                  :disabled="relationship.displayName < 20"
                >
                  <pill-link :href="`#${relationship.displayName}`">
                    {{ relationship.displayName.slice(0, 17) }}...
                    <template
                      slot="suffix"
                    >
                      {{ relationship.count }}
                    </template>
                  </pill-link>
                </el-tooltip>
              </div>
              <div v-else>
                <pill-link :href="`#${relationship.displayName}`">
                  {{ relationship.displayName }}
                  <template #suffix>
                    {{ relationship.count }}
                  </template>
                </pill-link>
              </div>
            </div>
          </template>
        </StageActions>

      </template>

      <template v-if="!editingInstance">

        <!-- BEGIN PROPERTIES TABLE -->
        <div class="property-list"
           v-if="!isRecordsLoading">
          <concept-instance-property
            v-for="property in properties"
            :key="property.name"
            :property="property"
            :string-subtypes="stringSubtypes"
            @edit-instance="enableEditFocus(property.name)"
          />
        </div>
        <div class="property-list">
          <concept-instance-linked-property
            v-for="property in linkedProperties"
            :key="property.to.modelId"
            :property="property"
            :label="property.schemaLinkedProperty.displayName"
            @edit-linked-property="editLinkedProperty"
            @confirm-remove-linked-property="openLinkedPropertyModal"
          />

          <div class="static-prop-section">
            <concept-instance-static-property
              label="Pennsieve id"
              :value="instance.id"
            />

            <concept-instance-static-property
              label="Created by"
              :user="instance.createdBy"
              :date="instance.createdAt"
            />

            <concept-instance-static-property
              label="Updated by"
              :user="instance.updatedBy"
              :date="instance.updatedAt"
            />
          </div>
        </div>
        <!-- END PROPERTIES TABLE -->

        <!-- BEGIN FILES TABLE -->
        <el-collapse
          v-if="!editingInstance && hasFiles"
          key="linkedFiles"
          v-model="activeSections"
          class="concept-instance-section zero-padding no-border"
        >
          <relationships-table
            id="Files"
            ref="package"
            :active-sections="activeSections"
            :relationship="fileRelationship"
            :show-collapse="true"
            source-type="recordFile"
            :url="getRecordFileRelationshipsUrl"
            @remove-relationships="handleRemoveRelationships"
            @set-related-files="handleSetRelatedFiles"
            @unlink-files="handleUnlinkFiles"
          />
        </el-collapse>
        <!-- END FILES TABLE -->

        <!-- Relationships Table Empty State -->
        <div
          v-if="
            !isRelationshipsLoading &&
              !hasSeenRelationshipsInfo &&
              !hasRelationships &&
              !datasetLocked
          "
          class="relationships-empty-state"
        >
          <div class="relationships-empty-state-inner">
            <h3>Create Relationships</h3>
            <div>
              <p class="relationship-inner-text">
                Connect <b>{{ $sanitize(formattedConceptTitle) }}</b> with other objects in your graph by clicking the "Link to ..." button above.
              </p>
              <a
                href="https://docs.pennsieve.io/docs/metadata-management"
                target="_blank"
              >
                <bf-button class="primary learn-more">
                  Learn More
                </bf-button>
              </a>
              <div>
                <a
                  href="#"
                  @click.prevent="dismissRelationshipsInfo"
                >
                  Got it
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- BEGIN RELATIONSHIPS TABLE -->
        <template v-if="!editingInstance && hasRelationships">
          <el-collapse
            v-for="relationship in relationshipsModels"
            :key="relationship.name"
            v-model="activeSections"
            class="concept-instance-section zero-padding no-border"
          >
            <relationships-table
              :id="relationship.displayName"
              :ref="relationship.name"
              :active-sections="activeSections"
              :relationship="relationship"
              :show-collapse="true"
              :can-add-relationship="canAddRelationship(relationship.name)"
              :url="getRecordRelationshipsUrl(relationship.name)"
              @remove-relationships="handleRemoveRelationships"
              @unlink-files="handleUnlinkFiles"
              @add-relationship="handleAddRelationship"
            />
          </el-collapse>
        </template>
      </template>
      <!-- END RELATIONSHIPS TABLE -->

      <!-- this renders a template with some properties for the model in it -->
      <template v-else>
        <InstanceEdit
          :record-properties="properties"
          :record-linked-properties="linkedProperties"
        />
<!--        <h2 v-if="properties.length > 0">-->
<!--          Properties-->
<!--        </h2>-->
<!--        <div class="required">-->
<!--          *Required-->
<!--        </div>-->
<!--        <div>-->
<!--          <concept-instance-property-->
<!--            v-for="property in properties"-->
<!--            :key="property.name"-->
<!--            :property="property"-->
<!--            :editing="true"-->
<!--            :string-subtypes="stringSubtypes"-->
<!--            @add-property-value="handleAddPropertyValue"-->
<!--          />-->

<!--          <concept-instance-linked-property-->
<!--            v-for="property in linkedProperties"-->
<!--            :key="property.to.modelId"-->
<!--            :property="property"-->
<!--            :label="property.schemaLinkedProperty.displayName"-->
<!--            @edit-linked-property="editLinkedProperty"-->
<!--            @confirm-remove-linked-property="removeLinkedPropertyEditScreen"-->
<!--          />-->
<!--        </div>-->
      </template>

<!--    <add-relationship-drawer-->
<!--      ref="addRelationshipDrawer"-->
<!--      :relationship-types="relationshipTypes"-->
<!--      :record="instance"-->
<!--      :record-name="drawerOriginatingName"-->
<!--      :is-file="false"-->
<!--    />-->

    <remove-relationships
      ref="removeRelDialog"
      v-model:dialog-visible = "removeRelationshipsDialogVisible"
    />

    <unlink-files
      v-model:dialog-visible="isUnlinkFileDialogVisible"
      :source-record-id="instanceId"
      :data="unlinkFileData"
    />

<!--    <add-file-relationship-drawer-->
<!--      ref="addFileRelationshipDrawer"-->
<!--      :concept="model"-->
<!--      :related-files="relatedFiles"-->
<!--    />-->

    <add-linked-property-drawer
      ref="addLinkedPropertyDrawer"
      :is-creating-record="isCreating"
      :drawer-visible="isAddLinkedPropDrawerVisible"
      :linked-property="editProperty"
      @update-linked-property="onUpdateLinkedProperty"
      @close="onCloseLinkedPropDrawer"
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
import {mapActions, mapGetters, mapState} from 'vuex'
import {
  clone,
  compose,
  defaultTo,
  find,
  findIndex,
  flatten,
  head,
  includes,
  isEmpty,
  isNil,
  join,
  map,
  path,
  pathEq,
  pathOr,
  pluck,
  prepend,
  prop,
  propEq,
  propOr,
  reject,
  uniq,
  uniqBy
} from 'ramda'
import validUrl from 'valid-url'
import BfButton from '../../../shared/bf-button/BfButton.vue'
import PillLink from '../../../shared/PillLink/PillLink.vue'
import ConceptInstanceProperty from './ConceptInstanceProperty.vue'
import ConceptInstanceStaticProperty from './ConceptInstanceStaticProperty.vue'
import ConceptInstanceLinkedProperty from './ConceptInstanceLinkedProperty.vue'
import AddRelationshipDrawer from './AddRelationshipDrawer.vue'
import RelationshipsTable from './RelationshipsTable.vue'
import RemoveRelationships from './RemoveRelationships.vue'
import UnlinkFiles from './UnlinkFiles.vue'
import LinkRecordMenu from '../../../shared/LinkRecordMenu/LinkRecordMenu.vue'
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
import IconPencil from "../../../icons/IconPencil.vue";
import FileRelationshipsTable from "../../files/FileDetails/FileRelationshipsTable.vue";
import InstanceEdit from "./InstanceEdit.vue";
import {useGetToken} from "@/composables/useGetToken";
import AddLinkedPropertyDrawer from "@/components/datasets/explore/ConceptInstance/AddLinkedPropertyDrawer.vue";

export default {
  name: 'ConceptInstance',

  components: {
    AddLinkedPropertyDrawer,
    FileRelationshipsTable,
    IconPencil,
    StageActions,
    BfButton,
    PillLink,
    ConceptInstanceProperty,
    ConceptInstanceStaticProperty,
    ConceptInstanceLinkedProperty,
    AddRelationshipDrawer,
    RemoveRelationships,
    UnlinkFiles,
    RelationshipsTable,
    LinkRecordMenu,
    InstanceEdit
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
      editProperty: {},
      isAddLinkedPropDrawerVisible: false,
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

    ...mapState(['conceptsHash', 'dataset']),

    /**
     * Compute url to export file
     * @returns {String}
     */
    exportFileUrl: async function() {
      useGetToken()
        .then(token => {
          const packageId = pathOr('', ['content', 'id'], this.proxyRecord)
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
     * Compute whether or not to display detailed directory view
     * @returns {Boolean}
     */
    displayDirectoryViewer: function() {
      const packageType = pathOr(
        '',
        ['content', 'packageType'],
        this.proxyRecord
      ).toLowerCase()
      return (
        (packageType === 'hdf5' || packageType === 'zip') &&
        this.getFileStatus === 'Processed'
      )
    },

    /**
     * Computed property to display breadcrumb for file details
     * @returns {String}
     */
    fileBreadcrumbText: function() {
      return 'Files'
    },

    /**
     * Computed property to retrieve file status for source
     * files in package
     * @returns {String}
     */
    getFileStatus: function() {
      const states = {
        UPLOADED: 'Unprocessed',
        ERROR: 'Failed',
        PROCESSING: 'Processing',
        RUNNING: 'Processing',
        PENDING: 'Processing',
        READY: 'Processed',
        UNAVAILABLE: 'Uploading'
      }

      const fileState = path(['content', 'state'], this.proxyRecord)
      return states[fileState]
    },

    /**
     * * Compute external file object
     * @returns {Object}
     */
    externalFile: function() {
      return propOr({}, 'externalFile', this.proxyRecord)
    },

    /**
     * Compute if package is an external file
     * @returns {Boolean}
     */
    isExternalFile: function() {
      return Boolean(pathOr('', ['externalFile', 'location'], this.proxyRecord))
    },

    /**
     * Compute if external file is a url or local file path
     * @returns {Boolean}
     */
    isExternalFileClickable: function() {
      const location = pathOr(
        '',
        ['externalFile', 'location'],
        this.proxyRecord
      )
      return Boolean(validUrl.isUri(location))
    },

    /**
     * Generates function call for button on file details page
     * based on file state
     */
    buttonMenu: function() {
      let menu = {}
      if (this.isMSOfficeFile){
        menu = {
          Unprocessed: this.processFile,
          Processed: this.openMSOfficeFile
        }
      } else {
      menu = {
        Unprocessed: this.processFile,
        Processed: this.openViewer
       }
      }
      return menu[this.getFileStatus]
    },

    /**
     * Compute if the file is processing
     * @returns {Boolean}
     */
    isFileProcessing: function() {
      const isProcessing = ['UNAVAILABLE', 'PENDING', 'RUNNING', 'PROCESSING']
      const state = path(['content', 'state'], this.proxyRecord)
      return isProcessing.indexOf(state) >= 0
    },

    /**
     * Compute if the file is uploading
     * @returns {Boolean}
     */
    isUploading: function() {
      const state = path(['content', 'state'], this.proxyRecord)
      return state == 'UNAVAILABLE'
    },

    /**
     * Get move URL
     * @returns {String}
     */
    moveUrl: async function() {
      useGetToken()
        .then(token => {
          return `${this.config.apiUrl}/data/move?api_key=${token}`

        })
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
    recordUrl: function() {

      const datasetId = this.datasetId
      const conceptInstanceId = this.instanceId

        // Conditional logic for records or proxy
      return  `${
          this.config.conceptsUrl
        }/datasets/${datasetId}/concepts/${this.modelId}/instances/${conceptInstanceId}`



    },

    /**
     * Check if Concept has Files
     * @returns {Boolean}
     */
    hasFiles: function() {
      if (this.hasRelationships) {
        const idx = this.relationships.findIndex(
          rel => rel.displayName === 'Files'
        )
        return idx >= 0
      }
      this.loadRecordsPage = false
      return false
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
     * Detect if the model is a file
     * @returns {Boolean}
     */
    isFile: function() {
      const id = pathOr('', ['params', 'instanceId'], this.$route)
      return id.indexOf('package') >= 0
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

      if (!this.isOrgSynced) {
        return
      }

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
     * Computed property to generate API Url for Process File API
     * @returns {String}
     */
    processFileUrl: async function() {
      const packageId = this.fileId
      return useGetToken()
        .then(token => {
          return `${this.config.apiUrl}/packages/${packageId}/process?api_key=${
            token
          }`
        })
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
     * Compute proxyRecord file type
     * @returns {String}
     */
    fileType: function() {
      const packageType = pathOr(
        '',
        ['content', 'packageType'],
        this.proxyRecord
      )

      if (packageType === 'Collection') {
        return 'Folder'
      }

      if (packageType === 'ExternalFile') {
        return 'External File'
      }

      const subtype = this.getFilePropertyVal(
        this.proxyRecord.properties,
        'subtype'
      )
      return subtype ? subtype : propOr('Unknown', 'subtype', this.proxyRecord)
    },

    /**
     * Checks if MS Office File
     * @returns {Boolean}
     */
    isMSOfficeFile: function() {
      return this.fileType === 'MS Word' || this.fileType === 'MS Powerpoint' || this.fileType === "MS Excel"
    },

    /**
     * Compute proxyRecord file ID
     * @returns {String}
     */
    fileId: function() {
      return pathOr('', ['content', 'id'], this.proxyRecord)
    },

    /**
     * Compute proxyRecord file location
     * @returns {Object}
     */
    fileLocation: function() {
      const ancestors = propOr([], 'ancestors', this.proxyRecord)

      const path = compose(
        join('/'),
        prepend('Files'),
        map(ancestor => {
          return ancestor.content.name
        })
      )(ancestors)
      

      const route = this.proxyRecord.parent
        ? {
            name: 'collection-files',
            params: {
              fileId: pathOr('', ['parent', 'content', 'id'], this.proxyRecord)
            }
          }
        : {
            name: 'dataset-files'
          }

      return {
        path,
        route
      }
    },

    /**
     * Compute proxyRecord file size
     * @returns {String}
     */
    fileSize: function() {
      return this.formatMetric(this.proxyRecord.storage)
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
      return `${
        this.config.conceptsUrl
      }/datasets/${this.datasetId}/concepts/${this.modelId}/instances/${this.instanceId}/linked`
    },

    /**
     * compute the url to fetch the valid string subtypes
     * @returns {String}
     */
    stringSubtypeUrl: async function() {
      const datasetId = pathOr('', ['params', 'datasetId'], this.$route)
      return await useGetToken()
        .then(token => {
          return `${this.config.apiUrl}/models/datasets/${datasetId}/properties/strings?api_key=${token}`
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

    /**
     * Watcher for sources API URL to call
     * API for the source files table
     */
    packageFilesUrl: {
      handler: function(val) {
        const packageId = this.fileId
        if (val && packageId !== '') {
          this.getSourceFiles()
        }
      },
      immediate: true
    },

    getModelSchemaUrl: {
      handler: function() {
        if (this.$route.params.instanceId === 'new') {
          this.setupCreateRecord()
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

    properties: {
      handler: function(val) {
        const name = this.$route.query.name
        if (val.length > 0 && name && this.getPermission('editor')) {
          /**
           * Hello there.  Are you wondering why we call $router.replace here?
           * Without it, the following happens:
           * 1. We route to the page with query.name set to some field, let's say "foo".
           *        (this happens when clicking "Add a Value" when a Model Title is blank in the Record list)
           * 2. this watcher fires, setting editing to true and focusing the "foo" field
           * 3. We update "foo" and save our changes
           *        which sets editing to false and returns us to display mode
           *        which updates `this.instance.values` accordingly
           * 4. `this.instance.values` causes computed `this.properties` to change
           * 5. this watcher fires again, and even though we have just set editing to false, it gets set to true again
           * 6. and thus we have an endless loop : (
           *
           * Clearing the `name` query parameter once we have handled it here prevents the endless loop for occurring.
           */
          this.$router.replace({ query: { ...this.$route.query, name: undefined }})
          this.enableEditFocus(name)
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
      handler() {
        if (this.stringSubtypeUrl) {
          this.fetchStringSubtypes()
        }
      },
      immediate: true
    }
  },

  mounted: function() {
    // Listen for property value changes
    EventBus.$on('instance-value-changed', this.onValueChanged)

    // Listen for property value errors
    EventBus.$on('instance-value-error', this.onValueError)

    // Fetch new data for a given table
    EventBus.$on('refresh-table-data', this.refreshTableData)

    // Open proper drawer component
    // EventBus.$on('add-relationship', this.handleAddRelationship)

    // Update the relationships state
    EventBus.$on('update-relationships-list', this.updateRelationshipsList)

    // Check if user has seen relationships empty state info
    const hasSeenRelationshipsInfo = localStorage.getItem(
      'seen-relationships-info'
    )
    if (hasSeenRelationshipsInfo === 'true') {
      this.hasSeenRelationshipsInfo = true
    }

  },

  beforeUnmount() {
    EventBus.$off('instance-value-changed', this.onValueChanged)
    EventBus.$off('instance-value-error', this.onValueError)
    EventBus.$off('refresh-table-data', this.refreshTableData)
    // EventBus.$off('add-relationship', this.handleAddRelationship)
    EventBus.$off('update-relationships-list', this.updateRelationshipsList)
  },

  methods: {
    ...mapActions([
      'updateEditingInstance',
      'updateConcepts',
    ]),

    ...mapActions('filesModule', [
       'openOffice365File'
    ]),
    onCloseLinkedPropDrawer: function() {
      this.isAddLinkedPropDrawerVisible = false
      this.selectedLinkedProperty = {}
    },

    /**
     * retrieves the string subtype configuration used to populate the AddEditPropertyDialog
     */
    fetchStringSubtypes: function() {
      this.stringSubtypeUrl
        .then(url => {
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
            this.sendXhr(this.relationshipsUrl, {
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
          })

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
            .catch(this.handleXhrError.bind(this))
        })

    },
    /**
     * Gets instance details
     */
    getInstanceDetails: function() {
      const url = this.recordUrl

      if (!url) {
        return
      }

      return useGetToken()
        .then(token => {
          this.sendXhr(url, {
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

        try {
          // Make request to create new instance
          await useGetToken().then(token => {
            const record = this.sendXhr(url, {
              header: {
                Authorization: `bearer ${token}`
              },
              method: 'POST',
              body: {
                values
              }
            })
          })



          const batchUrl = `${url}/${record.id}/linked/batch`
          await this.createBatchLinkedProperties(batchUrl, this.linkedProperties)

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

          this.updateConcepts(updatedConcepts).then(() => {
            this.savingChanges = false
            this.updateEditingInstance(false)
            this.changedProperties = []
            this.errorProperties = []
          })
        } catch (e) {
            this.processing = false
            this.savingChanges = false
            this.handleXhrError(e)
          }
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

      return useGetToken().then(token => {
        return this.sendXhr(url, {
          header: {
            Authorization: `bearer ${token}`
          },
          method: 'POST',
          body: {
            data: properties
          }
        })
      })

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

        useGetToken().then(token => {
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
        })

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
          this.sendXhr(this.getModelSchemaUrl, {
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
            .catch(response => {
              this.handleXhrError(response)
            })
        })

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
      return useGetToken().then(token => {
        return this.sendXhr(this.getModelSchemaUrl, {
          header: {
            Authorization: `bearer ${token}`
          }
        })
      })

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
      useGetToken(token => {
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
     * Get schema linked properties
     * @returns {Promise}
     */
    getSchemaLinkedProperties: async function() {
      useGetToken()
        .then(token => {
          if (this.schemaLinkedPropertiesUrl) {
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
          }
        })


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
    editLinkedProperty: function(property) {
      this.editProperty = property
      this.isAddLinkedPropDrawerVisible = true
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
@use "../../../../styles/theme";
@use '../../../../styles/icon-item-colors';
@use '../../../../styles/uploader-empty-state';


.model-name{
  margin: 16px 0 0 0;
  color: white;
  font-weight: 300;
}


.static-prop-section{
  margin-bottom: 32px;
}

.concept-instance {
  background: #fff;
  .files-section {
    padding: 0;
  }
  .highlight-property {
    color: theme.$gray_6;
    font-weight: 500;
  }
  &.editing {
    background: theme.$gray_1;

    h2 {
      margin-bottom: 4px;
    }
  }
  .back-to-search {
    align-items: center;
    display: flex;
    .svg-icon {
      margin-right: 8px;
    }
  }
  .el-collapse-item__header,
  .el-collapse-item__header.is-active {
    background: none;
    padding: 8px;
    padding-right: 0;
    height: auto;
    .table-info {
      margin-right: 24px;
    }
    .el-collapse-item__arrow {
      display: none;
    }
  }


  .collapse-properties .el-collapse-item__wrap {
    padding-bottom: 16px;
    background: #fbfbfd;
  }

  .source-files-table-properties .el-collapse-item__wrap {
    background: #fbfbfd;
  }

  .el-collapse-item {
    .table-info,
    .table-actions {
      align-items: center;
      color: theme.$purple_1;
      display: flex;
      line-height: initial;
      font-size: 12px;
      height: 24px;
    }
    .table-info {
      .selected-files {
        color: theme.$gray_6;
        margin-right: 16px;
      }

      .selected-source-files {
        color: theme.$gray_6;
      }
    }
    &.row-is-selected {
      .el-collapse-item__header {
        background-color: #e9edf6;
      }
    }
  }
  .relationship-title {
    align-items: center;
    display: flex;
    flex: 1;
    h2 {
      color: theme.$purple_1;
      flex: 1;
      font-size: 20px;
      font-weight: 600;
      line-height: 1;
      margin: 0 0 0 8px;
    }
  }
  .el-table {
    .caret-wrapper {
      display: none;
    }
  }
  .el-table-column--selection {
    .cell {
      padding: 0;
      min-height: 25px;
      text-align: center;
    }
  }
  .remove-relationship {
    cursor: pointer;
    text-align: right;
  }
  .archive-model-warning {
    font-weight: 600;
    color: black;
  }

  .bf-button.secondary.save-button {
    height: 40px;
}

}


#btn-show-all-props {
  display: block;
  margin: 8px 0 16px;
  text-decoration: underline;
  &:focus,
  &:hover {
    text-decoration: none;
  }
}
.concept-instance-section {
  margin-bottom: 16px;
  .collapse-properties {
    .source-files {
      background: blue !important;
    }
  }
}


.relationships-list {
  display: flex;
  flex-wrap: wrap;
  height: 100%;
  li {
    display: inline-flex;
  }
}

.file-list {
  padding: 0 16px;
  background: theme.$gray_0;
  margin-bottom: 16px;
}

.property-list {
  padding: 0 8px;
}

.relationships-empty-state {
  background: theme.$purple_tint;
  border: 1px dashed theme.$purple_1;
  height: 214px;
  display: flex;

  &-inner {
    max-width: 460px;
    margin: 0 auto;
    text-align: center;
    padding: 8px;

    .relationship-inner-text {
      color: theme.$gray_4;
      margin-bottom: 16px;
    }

    .bf-button.learn-more {
      margin-bottom: 16px;
    }
  }
  &.site-empty-state {
    h3 {
      margin-top: 8px;
    }
  }
}

#concept-title {
  align-content: middle;
  display: flex;
  &:hover {
    button {
      display: inline-flex;
    }
  }
  button {
    color: theme.$gray_4;
    display: none;
    margin-left: 8px;
    &:hover {
      color: theme.$app-primary-color;
    }
  }
}

  .file-checkbox {
    margin-right: 16px;
  }

  .instance-type {
  color: theme.$gray_4;
  font-weight: 600;
  text-transform: capitalize;
}
</style>
