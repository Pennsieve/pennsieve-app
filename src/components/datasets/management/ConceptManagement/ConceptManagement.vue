<template>
    <bf-stage
      slot="stage"
      :is-editing="hasChanges"
    >
      <template #actions>
        <stage-actions>
          <template #left>
            <h1
              class="model-name-heading"
            >
              <IconLockFilled
                v-if="datasetLocked"
                class="mr-8"
                color="#71747C"
                :height="24"
                :width="24"
              />
              {{ modelName }}
            </h1>
          </template>
          <template #right>
            <div class="buttons">
              <bf-button
                v-if="hasChanges"
                class="action-button secondary"
                @click="cancelChanges"
              >
                Cancel
              </bf-button>
              <bf-button
                v-if="hasChanges"
                class="action-button green"
                :processing="savingChanges"
                processing-text="action-button Saving Changes"
                @click="validateChanges"
              >
                Save Changes
              </bf-button>
              <bf-button
                :disabled="datasetLocked"
                class="action-button add-property primary"
                @click="openCreateProperty"
              >
                Add Property
              </bf-button>
              <el-dropdown
                v-if="!hasChanges && !datasetLocked"
                trigger="click"
                placement="action-button bottom-end"
                @command="onMenuSelect"
              >
                <bf-button class="action-button primary icon el-dropdown-link">
                  <IconMenu
                    name="icon-menu"
                    :height="16"
                    :width="16"
                  />
                </bf-button>
                <template #dropdown>
                  <el-dropdown-menu
                    class="bf-menu"
                  >
                    <el-dropdown-item command="rename">
                      Rename Model
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-if="recordCount === 0"
                      command="archive"
                    >
                      Delete
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-if="modelPropertyCount > 0"
                      command="newRecord"
                    >
                      Create new {{ modelName }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>

              </el-dropdown>
            </div>

          </template>
        </stage-actions>
      </template>


      <concept-property-list
        :properties="properties"
        :changed-properties="changedProperties"
        @update-property-order="_onUpdatePropertyOrder"
        @open-create-property="openCreateProperty"
      />

      <template #sidebar>
        <sidebar-message
          v-if="hasChanges"
          title="Unsaved Changes"
          border-class="green"
          :has-border-bottom="true"
        >
          <template #copy>
            <p slot="copy">
              Model was changed, but has not been saved
            </p>
          </template>
        </sidebar-message>

        <copy-concept-id
          v-if="propertyCount > 0"
          :concept-id="modelId"
        />
      </template>

      <rename-concept-dialog
        :dialog-visible="renameConceptDialogVisible"
        :updating-concept="model"
        @close="closeRenameDialog"
      />

      <delete-concept-dialog
        :dialog-visible="deleteDialogVisible"
        :property-deletion-state="propertyDeletionState"
        :property="propertyEdit"
        :model-name="modelName"
        :loading="savingChanges"
        :property-record-usage-count="propertyRecordUsageCount"
        @confirm="confirmDeleteDialog"
        @close="onDeleteDialogClose"
      />

      <add-edit-property-dialog
        ref="addPropertyDialog"
        :dialog-visible="addEditPropertyDialogVisible"
        :concept-title-name="getConceptTitleVal('name', properties)"
        :properties="properties"
        v-model:property-edit="propertyEdit"
        :string-subtypes="stringSubtypes"
        @add-property="onAddProperty"
        @edit-property="onEditProperty"
        @close="closeEditPropertyDialog"
      />
    </bf-stage>
<!--  </bf-page>-->
</template>

<script>
import { mapActions, mapGetters, mapState } from 'vuex';
import { clone, compose, eqBy, find, findIndex, head, pathOr, propEq, propOr, toLower, uniqWith } from 'ramda';
import BfButton from '../../../shared/bf-button/BfButton.vue';
import SidebarMessage from '../../../shared/SidebarMessage/SidebarMessage.vue';
import CopyConceptId from './CopyConceptId.vue';
import RenameConceptDialog from '../RenameConceptDialog/RenameConceptDialog.vue';
import ConceptPropertyList from './ConceptPropertyList.vue';
import AddEditPropertyDialog from '../../explore/AddEditPropertyDialog/AddEditPropertyDialog.vue';
import DeleteConceptDialog from '../DeleteConceptDialog/DeleteConceptDialog.vue';
import EventBus from '../../../../utils/event-bus';
import FormatDate from '../../../../mixins/format-date/index';
import ConfirmChanges from '../../../../mixins/confirm-changes';
import GetConceptTitleVal from '../../explore/GetConceptTitleVal';
import IconLockFilled from "../../../icons/IconLockFilled.vue";
import StageActions from "../../../shared/StageActions/StageActions.vue";


import Request from '../../../../mixins/request';
import { modelUrlV2, PROPERTY_DELETION_STATES } from './utils';
import Cookies from "js-cookie";
import IconMenu from "../../../icons/IconMenu.vue";
import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";

const defaultLinkedPropertyProps = {
  dataType: 'Model',
  conceptTitle: false,
  default: false,
  required: false,
  isEnum: false,
  isMultiValue: false
}

export default {
  name: 'ConceptManagement',

  components: {
    StageActions,
    IconMenu,
    BfButton,
    SidebarMessage,
    CopyConceptId,
    RenameConceptDialog,
    DeleteConceptDialog,
    ConceptPropertyList,
    AddEditPropertyDialog,
    IconLockFilled
  },
  props: {
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

  mixins: [
    Request,
    FormatDate,
    ConfirmChanges,
    GetConceptTitleVal
  ],

  data() {
    return {
      properties: [],
      originalProperties: [],
      renameConceptDialogVisible: false,
      addEditPropertyDialogVisible: false,
      deleteDialogVisible: false,
      propertyEdit: {},
      propertyDeletionState: PROPERTY_DELETION_STATES.INITIAL,
      propertyRecordUsageCount: 0,
      savingChanges: false,
      stringSubtypes: [],
      linkBackObject: {
        path: "models",
        name: "Model List"
      }
    }
  },

  computed: {
    ...mapGetters('metadataModule',[
      'getModelById'
    ]),
    ...mapState([
      'dataset',
      'activeOrganization',
    ]),
    ...mapGetters([
      'config',
      'hasFeature',
      'datasetLocked'
    ]),
    ...mapState('metadataModule',[
      'models'
    ]),

    /**
     * Get the model from state by ID
     */
    model: function() {
      return this.getModelById(this.modelId)
    },

    /**
      * Model URL
      * @returns {String}
      */
    modelUrl: function() {
      const datasetId = this.datasetId
      return `${this.config.conceptsUrl}/datasets/${datasetId}/concepts/${this.modelId}`
    },

    /**
     * Linked Properties URL
     * @returns {String}
     */
    linkedPropertiesUrl: function() {
      return `${this.config.conceptsUrl}/datasets/${this.datasetId}/concepts/${this.modelId}/linked`
    },

    /**
      * Get model schema URL
      * @returns {String}
      */
    getModelSchemaUrl: function() {
      if (this.modelUrl) {
        return `${this.modelUrl}/properties`
      }
      return ''
    },

    /**
     * Returns model name
     * @returns {String}
     */
    modelName: function() {
      return propOr('', 'displayName', this.model)
    },

    /**
     * Returns model property count
     * @returns {Number}
     */
    modelPropertyCount: function() {
      return propOr(0, 'propertyCount', this.model)
    },

    /**
     * Compute total records in model
     * @returns {Number}
     */
    recordCount: function() {
      return propOr(0, 'count', this.model)
    },

    /**
     * Compute total properties in model
     * @returns {Number}
     */
    propertyCount: function() {
      return propOr(0, 'propertyCount', this.model)
    },

    /**
     * Format updated date
     * @returns {String}
     */
    updatedDate: function() {
      const date = propOr(Date.now(), 'updatedAt', this.model)
      return this.formatDate(date)
    },

    /**
     * Computed if there are any new linked property
     * @returns {Boolean}
     */
    hasNewLinkedProperties: function() {
      return this.newLinkedProperties.length > 0
    },

    /**
     * Computed if there are any linked property changes
     * @returns {Boolean}
     */
    hasLinkedPropertyChanges: function() {
      return this.changedLinkedProperties.length > 0
    },

    /**
     * Compute concept properties from properties union
     * @returns {Array}
     */
    conceptProperties: function() {
      return this.properties.filter(prop => prop.dataType !== 'Model')
    },

    /**
     * Compute changed concept properties from changedProperties union
     * @returns {Array}
     */
    changedConceptProperties: function() {
      return this.changedProperties.filter(prop => prop.dataType !== 'Model')
    },

    /**
     * Compute linked properties from changedProperties union.
     * @returns {Array}
     */
    linkedProperties: function() {
      return this.properties.filter(prop => prop.dataType === 'Model')
    },

    /**
     * Compute if there are linked properties
     * @returns {Boolean}
     */
    hasLinkedProperties: function() {
      return this.linkedProperties.length > 0
    },

    /**
    * Compute new linked properties
    * @returns {Array}
    */
    newLinkedProperties: function() {
      return this.changedProperties.filter(prop => {
        return Boolean(prop.dataType === 'Model' && !prop.id)
      })
    },

    /**
    * Compute changed linked properties
    * @returns {Array}
    */
    changedLinkedProperties: function() {
      return this.changedProperties.filter(prop => {
        return Boolean(prop.dataType === 'Model' && prop.id)
      })
    },


  },

  watch: {
    models: {
      handler() {
        if (this.properties.length === 0) {
          this.fetchModelSchema()
            .then(this.fetchLinkedProperties.bind(this))
            .catch(this.handleXhrError.bind(this))
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

  mounted() {
    EventBus.$on('edit-property', this.openPropertyEditDialog.bind(this))
    EventBus.$on('archive-property', this.openDeleteDialog.bind(this))
    EventBus.$on('remove-property', this.onRemoveProperty.bind(this))
    this.fetchModels()
  },

  beforeDestroy() {
    EventBus.$off('edit-property', this.openPropertyEditDialog.bind(this))
    EventBus.$off('archive-property', this.openDeleteDialog.bind(this))
    EventBus.$off('remove-property', this.onRemoveProperty.bind(this))
  },

  methods: {
    ...mapActions([
      'updateConcepts'
    ]),
    ...mapActions('metadataModule', [
      'fetchModels',
      'removeModel'
    ]),
    /**
     * compute the url to fetch the valid string subtypes
     * @returns {String}
     */
    stringSubtypeUrl: async function() {
      useGetToken()
        .then(token => {
          const datasetId = pathOr('', ['params', 'datasetId'], this.$route)
          return `${this.config.apiUrl}/models/datasets/${datasetId}/properties/strings?api_key=${token}`
        }).catch(err => console.log(err))

    },
    closeEditPropertyDialog: function(){
      this.addEditPropertyDialogVisible = false
    },
    closeRenameDialog: function() {
      this.renameConceptDialogVisible = false
    },

    /**
     * Get concept
     */
    fetchModelSchema: function() {
      if (this.getModelSchemaUrl) {
        useGetToken()
          .then(token => {
            return this.sendXhr(this.getModelSchemaUrl, {
              header: {
                'Authorization': `bearer ${token}`
              }
            })
              .then(response => {
                this.properties = response
              })
          }).catch(response => {
            this.handleXhrError(response)
          })
      }
      return Promise.resolve()
    },

    /**
     * retrieves the string subtype configuration used to populate the AddEditPropertyDialog
     */
    fetchStringSubtypes: function() {
      this.stringSubtypeUrl()
        .then(url => {
          useSendXhr(url)
            .then(subTypes => {
              this.stringSubtypes = Object.entries(subTypes).reduce(
                (options, [val, config]) => ([...options, { value: val, label: config.label, regex: config.regex }]),
                []
              )
            })
            .catch(response => {
              this.handleXhrError(response)
            })
        })


    },

    /**
     * Get linked properties
     */
    fetchLinkedProperties: function() {
      if (this.linkedPropertiesUrl) {
        useGetToken()
          .then(token => {
            this.sendXhr(this.linkedPropertiesUrl, {
              header: {
                'Authorization': `bearer ${token}`
              }
            })
              .then(response => {
                const linkedProperties = this.transformLinkedProperties(response)
                this.properties = this.sortProperties(this.conceptProperties, linkedProperties)
              })
              .catch(response => {
                this.handleXhrError(response)
              })
        })

      }
    },

    /**
     * Transform raw linked properties data
     * @param {Array} linkedProperties
     * @returns {Array}
     */
    transformLinkedProperties: function(linkedProperties) {
      if (linkedProperties.length === 0) {
        return []
      }

      return linkedProperties.map(linkedProperty => {
        const property = linkedProperty.link ? linkedProperty.link : linkedProperty
        return {...property, ...defaultLinkedPropertyProps}
      })
    },

    /**
     * Transform linked property
     * @returns {Object}
     */
    transformLinkedProperty: function(linkedProperty) {
      return { ...linkedProperty, ...defaultLinkedPropertyProps }
    },

    /**
     * Handles menu selections from concept rafter
     * @param {String}
     */
    onMenuSelect: function(command) {
      const commands = {
        rename: () => this.renameConceptDialogVisible = true,
        archive: () => this.openDeleteDialog(),
        newRecord: () => this.$router.push({ name: 'metadata-record', params: { instanceId: 'new' }})
      }
      const fn = commands[command]
      if (typeof fn === 'function') {
        fn()
      }
    },
    /**
     * Opens modal to create new propery
    */
    openCreateProperty: function() {
      this.addEditPropertyDialogVisible = true
    },

    /**
     * Open Archive Dialog
     * @param {object} property
     */
    openDeleteDialog: function(property) {
      if (property) {
        this.propertyEdit = clone(property)
      } else {
        this.propertyEdit = {}
      }

      this.propertyDeletionState = PROPERTY_DELETION_STATES.INITIAL
      this.propertyRecordUsageCount = 0
      this.savingChanges = false
      this.deleteDialogVisible = true
    },

    /**
     * Listener for when a user confirms the archive dialog
     * Used for model and property archiving
     */
    confirmDeleteDialog: function() {
      if (Object.keys(this.propertyEdit).length) {
        this.deleteProperty()
      } else {
        this.deleteConcept()
      }
    },

    /**
     * delete a concept
     */
    deleteConcept: function() {
      this.savingChanges = true;
      useGetToken()
        .then(token => {
          return useSendXhr(this.modelUrl, {
            header: {
              'Authorization': `bearer ${token}`
            },
            method: 'DELETE',
            body: [
              this.model.id
            ]
          })
            .then(() => {
              const displayName = this.model.displayName
              const index = findIndex(propEq('name', this.model.name), this.models)

              this.removeModel(this.model.id).then(() => {
                this.deleteDialogVisible = false

                this.$router.push({
                  name: 'models'
                })

                EventBus.$emit('toast', {
                  type: 'success',
                  msg: `${displayName} deleted`
                })
              })
            })
        })
        .catch(response => {
          this.handleXhrError(response)
        })
        .finally(() => this.savingChanges = false)

    },

    /**
     * delete a property
     */
    deleteProperty: function() {
      this.savingChanges = true;
      const propertyName = propOr('', 'name', this.propertyEdit)
      const displayName = propOr('', 'displayName', this.propertyEdit)
      const dataType = propOr('', 'dataType', this.propertyEdit)
      let baseUrl = modelUrlV2(this.config.conceptsUrl, this.activeOrganization, this.dataset, this.$route)

      if (dataType === 'Model') {
        baseUrl = this.linkedPropertiesUrl
      }

      const url = `${baseUrl}/${propertyName}${this.propertyDeletionState === PROPERTY_DELETION_STATES.CONFIRM_RECORD_MODIFICATION ? '?modifyRecords=true' : ''}`

      useGetToken()
        .then(token => {
          return useSendXhr(url, {
            header: {
              'Authorization': `bearer ${token}`
            },
            method: 'DELETE'
          })
            .then(() => {
              const index = findIndex(propEq('id', propertyName), this.properties)
              this.properties.splice(index, 1)

              EventBus.$emit('toast', {
                type: 'success',
                msg: `${displayName} deleted`
              })

              this.propertyEdit = {}
              this.deleteDialogVisible = false

              return this.putLinkedProperties()
                .then(this.onAllComplete.bind(this))
            })

        })
        .catch(response => {
          if (response.status === 400) {
            this.propertyDeletionState = PROPERTY_DELETION_STATES.FAILED
          } else if (response.status === 422) {
            response.json()
              .then(data => {
                this.propertyDeletionState = PROPERTY_DELETION_STATES.CONFIRM_RECORD_MODIFICATION
                this.propertyRecordUsageCount = data.usageCount
              })
              .catch(() => {
                this.propertyDeletionState = PROPERTY_DELETION_STATES.FAILED
              })
          }
        })
        .finally(() => this.savingChanges = false)

    },

    /**
     * On archive dialog close
     */
    onDeleteDialogClose: function() {
      this.deleteDialogVisible = false;
    },

    /**
     * Removes property from the list
     * @param {Object} prop
     */
    onRemoveProperty: function(prop) {
      this.properties = this.properties.filter(p => p.name !== prop.name)
      this.changedProperties = this.changedProperties.filter(changed => changed !== prop.name)
    },

    /**
    * @param {String} property
    */
    openPropertyEditDialog: function(property) {
      this.propertyEdit = clone(property)
      this.addEditPropertyDialogVisible = true
    },

    /**
     * Listener for editing a property.
     * Fired when the AddEditPropertyDialog submits
     * @param {Object} property
     */
    onEditProperty: function(property) {
      // Copy properties for canceling changes
      if (this.originalProperties.length === 0) {
        this.originalProperties = clone(this.properties)
      }

      const propName = propOr('', 'name', property)

      // Add to changedProperties
      if (this.changedProperties.findIndex(prop => prop.name === propName) < 0) {
        this.changedProperties.push(property)
      }

      this.checkModelTitle(property)

      let index = findIndex(propEq('name', propName), this.properties)

      // If this property is now the model title, move it to the first item
      if (property.conceptTitle) {
        this.properties.splice(index, 1)
        this.properties.unshift(property)
      } else {
        this.properties.splice(index, 1, property)
      }

      this.addEditPropertyDialogVisible = false

      this.propertyEdit = {}
    },

    /**
     * Reset model when user confirms loss of changes
     */
    onConfirmLossOfChanges: function() {
      this.resetModel()
    },

    /**
     * Cancel changes and set back to default state
     */
    cancelChanges: function() {
      this.properties = clone(this.originalProperties)
      this.resetModel()
    },

    resetModel: function() {
      this.originalProperties = []
      this.changedProperties = []
    },

    /**
     * Event listener for property order changes
     * @param {Object} dropInfo
     */
    _onUpdatePropertyOrder: function({ targetProperty, selectedProperty }) {
      // Copy properties for canceling changes
      if (this.originalProperties.length === 0) {
        this.originalProperties = clone(this.properties)
      }

      // property user selected
      const selectedIdx = this.properties.findIndex(prop => {
        return prop.name === selectedProperty.name
      })
      // property user dropped a property on
      const droppedIdx = this.properties.findIndex(prop => {
        return prop.name === targetProperty.name
      })

      // ID of property in originalProperties list
      const originalIdx = this.originalProperties.findIndex(prop => {
        return prop.name === selectedProperty.name
      })

      // ID of property in changedProperties
      const changedIdx = this.changedProperties.indexOf(selectedProperty.name)

      // Modifying the changedProperties list
      if (originalIdx === droppedIdx) {
        this.changedProperties.splice(changedIdx, 1)
      } else if (changedIdx < 0) {
        this.changedProperties.push(selectedProperty)
      }

      // Modify the properties order
      this.properties.splice(selectedIdx, 1)

      const newPosition = droppedIdx + 1
      const isLinkedProperty = Boolean(selectedProperty.dataType === 'Model')
      if (isLinkedProperty) {
        selectedProperty.position = newPosition
      }
      this.properties.splice(newPosition, 0, selectedProperty)
    },

    /**
     * Add property listener
     * Add property and close dialog
     * @param {Object} newProp
     */
    onAddProperty: function(newProp) {
      // Copy properties for canceling changes
      if (this.originalProperties.length === 0) {
        this.originalProperties = clone(this.properties)
      }

      // Check if property is a modelTitle
      this.checkModelTitle(newProp)

      if (newProp.conceptTitle) {
        this.properties.splice(0, 0, newProp)
      } else {
        this.properties.push(newProp)
      }

      this.addEditPropertyDialogVisible = false

      this.changedProperties.push(newProp)
    },

    /**
     * Increments property count for concept in state
     * @param {Number} count
     */
    incrementPropertyCount: function(count) {
      const id = pathOr('', ['params', 'conceptId'], this.$route)
      const updatedConcepts = this.models.map(concept => {
        if (concept && concept.id === id) {
          concept.propertyCount = count
        }
        return concept
      })
      this.updateConcepts(updatedConcepts)
    },

    /**
     * Check if new property is the model title, and unset the old one
     * @param {Object} property
     */
    checkModelTitle (property) {
      // if property is not concept title, leave original in place
      const modelTitle = propOr(false, 'conceptTitle', property)
      if (!modelTitle) {
        return
      }
      const curModelTitle = find(propEq('conceptTitle', true), this.properties)
      // if model has an existing concept title and property concept title is set to true;
      // update the existing concept title property to false
      if (curModelTitle) {
        curModelTitle.conceptTitle = false
        this.changedProperties.push(curModelTitle)
      }
    },

    /**
     * Checks for existance of 1 model title amongst properities
     * @param {Array} props
     * @returns {Boolean}
     */
    hasModelTitle: function(props) {
      const list = props.filter(propOr(false, 'conceptTitle'))
      return list.length === 1
    },

    /**
     * Normalizes displayName property
     * @param {Object}
     * @returns {String}
     */
    normalizeDisplayName: compose(
      toLower,
      propOr('', 'displayName')
    ),

    /**
     * Validates that all display names are unique
     * @param {Array} list
     * @returns {Boolean}
     */
    hasUniqueDisplayNames: function(list) {

      const strEq = eqBy(this.normalizeDisplayName)
      const uniqueList = uniqWith(strEq, list)
      return uniqueList.length === list.length
    },

    /**
     * Validates changes
     */
    validateChanges: function() {
      this.savingChanges = true

      const hasModelTitle = this.hasModelTitle(this.properties)
      const valid = this.hasUniqueDisplayNames(this.properties) && hasModelTitle
      if (valid) {
        return this.saveChanges()
      }

      this.savingChanges = false

      const msg = !hasModelTitle ? 'You must have 1 model title.' : 'Please be sure all property display names are unique.'
      EventBus.$emit('toast', {
        detail: {
          type: 'error',
          msg
        }
      })
    },

    /**
     * Saves changes to database
     */
    saveChanges: function() {
      // Calling all 3 functions every time to avoid a long switch statement
      // that would check every possible combination of changes

        this.postLinkedPropertyChanges()
        .then(this.putLinkedProperties.bind(this))
        .then(this.saveConceptPropertyChanges.bind(this))
        .then(this.onAllComplete.bind(this))
        .catch(this.handleXhrError.bind(this))
    },

    /**
    * Save concept property changes to database
    * @returns {Promise}
    */
    saveConceptPropertyChanges: function() {
      if (!this.hasChanges) {
        return Promise.resolve()
      }

      return useGetToken()
        .then(token => {
          return useSendXhr(this.getModelSchemaUrl, {
            header: {
              'Authorization': `bearer ${token}`
            },
            method: 'PUT',
            body: this.conceptProperties
          })
            .then(response => {
              this.properties = this.sortProperties(response, this.linkedProperties)
              this.incrementPropertyCount(response.length)
            })
            .catch(this.handleXhrError)
        })

    },

    /**
     * Saves new linked properties to database
     * @returns {Promise}
     */
    postLinkedPropertyChanges: function() {

      if (!this.hasNewLinkedProperties) {
        return Promise.resolve()
      }

      const url = `${this.linkedPropertiesUrl}/bulk`
      const body = this.getLinkedPropertiesPayload(this.newLinkedProperties)

      return useGetToken()
        .then(token => {
          return useSendXhr(url, {
            header: {
              'Authorization': `bearer ${token}`
            },
            method: 'POST',
            body
          })
            .then(response => {
              let transformedResponse
              // check if response is a list
              if (Array.isArray(response)) {
                transformedResponse = this.transformLinkedProperties(response)
                const properties = [...this.properties]
                transformedResponse.forEach(item => {
                  const idx = properties.findIndex(property => property.name === item.name)
                  properties[idx] = item
                })
                this.properties = properties
                this.incrementPropertyCount(response.length)
              } else {
                transformedResponse = this.transformLinkedProperty(response)
                const idx = this.properties.findIndex(property => property.name === transformedResponse.name)
                this.properties.splice(idx, 1, transformedResponse)
                this.incrementPropertyCount(1)
              }
            })
            .catch(this.handleXhrError)
        })

    },

    /**
     * Generate payload for linked properties POST request
     * @param {Array} linkedProperties
     * @returns {Array}
     */
    getLinkedPropertiesPayload: function(linkedProperties) {
      if (linkedProperties.length > 1) {
        return linkedProperties.map(item => {
          const { name, displayName, to, position, id } = item
          return { name, displayName, to, position, id }
        })
      }

      const { name, displayName, to, position, id } = head(linkedProperties)
      return [{ name, displayName, to, position, id }]
    },

    /**
     * Saves linked property changes to database and calls onAllComplete function
     */
    putLinkedProperties: function() {
      if (!this.hasLinkedProperties) {
        return Promise.resolve()
      }

      // filter out linked properties that don't have ids yet
      let updatedLinkedProperties = this.linkedProperties.filter(prop => Boolean(prop.id))

      // update linked properties position
      updatedLinkedProperties = updatedLinkedProperties.map(linkedProp => {
        linkedProp.position = this.properties.findIndex(prop => prop.name === linkedProp.name)
        return linkedProp
      })

      // loop through changed linked properties and queue promises
      const data = this.getLinkedPropertiesPayload(updatedLinkedProperties)
      const requests = data.map(this.createPromiseQueue.bind(this))

      // execute promises
      return Promise.all(requests)
        .then(data => {
          const transformedResponse = this.transformLinkedProperties(data)
          transformedResponse.forEach(linkedProperty => {
            const idx = this.properties.findIndex(item => item.name === linkedProperty.name)
            this.properties.splice(idx, 1, linkedProperty)
          })
        })
        .catch(err => Promise.reject(err))
    },

    /**
     * Linked property PUT request
     * @param {Object} linkedProperty
     * @returns {Promise}
     */
    createPromiseQueue: function(linkedProperty) {
      const url = `${this.linkedPropertiesUrl}/${linkedProperty.id}`
      return useGetToken()
        .then(token => {
          return this.sendXhr(url, {
            header: {
              'Authorization': `bearer ${token}`
            },
            method: 'PUT',
            body: linkedProperty
          })
        }).catch(err => useHandleXhrError(err))

    },

    /**
     * Notifies user when all requests have complete successfully
     */
    onAllComplete: function() {
      this.resetModel()

      EventBus.$emit('toast', {
        type: 'success',
        msg: `${this.modelName} saved`
      })

      EventBus.$emit('track-event', {
        name: 'Model Saved'
      })

      this.savingChanges = false
    },

    /**
     * Saves linked property changes to database
     */
    saveLinkedPropertyChanges: function() {
      let method = 'POST'
      let body = head(this.linkedProperties)

      if (this.newLinkedProperties.length > 1) {
        body = this.linkedProperties
      }

      return useGetToken()
        .then(token => {
          return this.sendXhr(this.linkedPropertiesUrl, {
            header: {
              'Authorization': `bearer ${token}`
            },
            method,
            body
          })
        }).catch(err => useHandleXhrError(err))

    },

    /**
     * Sorty properties based on position
     * @param {Array} conceptProperties
     * @param {Array} linkedProperties
     * @returns {Array}
     */
    sortProperties: function(conceptProperties, linkedProperties) {
      const sortedUnion = [...conceptProperties]
      linkedProperties.forEach(item => {
        sortedUnion.splice(item.position, 0, item)
      })
      return sortedUnion
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../../../assets/variables';

.model-name-heading {
  margin: 0 8px;
  color: $gray_6;
}

.buttons {
  .add-property {
    margin-right: 8px;
  }

  .action-button {
    margin-left: 8px;
  }
}

.bf-concept-managment {
  header {
    background: $purple_1;
  }

  .back-to-concepts {
    color: white;

    svg {
      margin: -2px 8px 0 0;
    }
  }

  .bf-button {
    &.add-property {
      width: 148px;
    }
  }
  #concept-title {
    align-items: center;
    display: flex;
    .svg-icon {
      margin-left: 16px;
    }
  }

  .button-spinner {
    height: 20px;
    margin: -3px 8px -3px 0;
    width: 20px;
  }
  .unlock-spinner .el-spinner-inner .path {
    stroke: #404554
  }
}
</style>
