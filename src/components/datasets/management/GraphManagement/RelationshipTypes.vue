<template>
  <bf-stage>
    <template #actions>
      <StageActions>
        <template #left>
          <div
            class="model-name-heading"
          >
            Relationship Types in Your Graph
          </div>
        </template>

        <template #right>
          <bf-button
            :disabled="datasetLocked || !hasRelationships"
            @click="onCreateNewRelationship"
          >
            Add Relationship Type
          </bf-button>
        </template>
      </StageActions>


    </template>

    <div class="relationship-types">
      <template v-if="!hasRelationships">
        <bf-empty-page-state
          v-if="concepts.length < 1"
          class="empty-state"
        >
          <img
            src="/src/assets/images/illustrations/illo-missing-models.svg"
            alt=""
            width="120"
            height="80"
          >
          <h3>Something's Missing</h3>
          <p>
            Once you create Models in your graph, you can then link them here.
          </p>

          <a
            class="buttonLink"
            href="https://docs.pennsieve.io/docs/creating-relationships-between-metadata-models"
            target="_blank"
          >
            <bf-button
              class="learn-more-button"
            >
              Learn More
            </bf-button>
          </a>
        </bf-empty-page-state>

        <bf-empty-page-state
          v-if="concepts.length >= 1"
          class="empty-state"
        >
          <img
            src="/src/assets/images/illustrations/illo-missing-models.svg"
            alt=""
            width="120"
            height="80"
          >
          <h3>Something's Missing</h3>
          <p>
            Relationships connect models in your graph and allow you to link individual records.
          </p>

          <div>
            <bf-button
              class="learn-more-button"
              :disabled="datasetLocked"
              @click="openRelationshipTypeModal"
            >
              Create Relationship between models
            </bf-button>
          </div>

        </bf-empty-page-state>
      </template>

      <template v-else>

        <div class="relationship-types-table-wrapper">
<!--          <div class="table-info">-->
<!--            <h2>Relationship Types in Your Graph</h2>-->
<!--          </div>-->


          <pennsieve-table
            ref="relationshipTable"
            :data="transformedRelationshipTypes"
            :is-loading="false"
            :single-select="true"
            @selection-change="handleTableSelectionChange"
          >
            <template #actions>

                  <button class="linked btn-selection-action mr-8"
                          :disabled="datasetLocked"
                          @click="onEditRelationship">
                    Update
                  </button>

                  <button class="linked btn-selection-action mr-8"
                          :disabled="datasetLocked"
                          @click="onDeleteRelationshipAction">
                    Delete
                  </button>

            </template>

            <template #columns>

              <el-table-column
                width="60"
                class="checkbox"
                fixed
              >
                <template #default>
                  <IconProcedure
                    class="icon-procedure"
                    color="currentColor"
                    :width="20"
                    :height="20"
                  />
                </template>
              </el-table-column>
              <el-table-column
                prop="source"
                label="Source Model"
                class-name="column-source"
              />
              <el-table-column
                prop="relationship"
                label="Relationship"
                class-name="column-relationship"
              >
                <template #default="scope">
                  <div class="relationship-wrapper">
                    {{ scope.row.relationship }}
                    <IconArrow
                      class="icon-arrow"
                      :width="24"
                      :height="24"
                    />
                  </div>

                </template>
              </el-table-column>
              <el-table-column
                prop="destination"
                label="Destination Model"
                class-name="column-destination"
              />
            </template>
          </pennsieve-table>
        </div>
      </template>

      <create-relationship-type-dialog
        :relationship-type-edit="relationshipTypeEdit"
        :relationship-types="relationshipTypes"
        :url="relationshipsUrl"
        v-model:dialogVisible="createRelationshipDialogVisible"
        @add-relationship-type="onAddRelationshipType"
        @update-relationship-type="onUpdateRelationshipType"
      />

      <delete-relationship-type-dialog
        :relationshipTypeEdit="relationshipTypeEdit"
        :relationship-types="relationshipTypes"
        :url="relationshipsUrl"
        v-model:dialogVisible="deleteRelationshipDialogVisible"
        @remove-relationship-type="onRemoveRelationshipType"
      />
    </div>

  </bf-stage>
</template>

<script>
  import { all, includes, equals, head, keys, pathOr, propOr, pluck, uniq, clone, find, propEq, findIndex, reject } from 'ramda'
  import { mapState, mapGetters, mapActions } from 'vuex'

  import FileIcon from '../../../../mixins/file-icon'
  import TableFunctions from '../../../../mixins/table-functions'
  import Sorter from '../../../../mixins/sorter'
  import Request from '../../../../mixins/request'
  import EventBus from '../../../../utils/event-bus'
  import BfButton from '../../../shared/bf-button/BfButton.vue'
  import BfEmptyPageState from '../../../shared/bf-empty-page-state/BfEmptyPageState.vue'
  import CreateRelationshipTypeDialog from './CreateRelationshipTypeDialog/CreateRelationshipTypeDialog.vue'
  import DeleteRelationshipTypeDialog from './DeleteRelationshipTypeDialog/DeleteRelationshipTypeDialog.vue'
  import IconPlus from "../../../icons/IconPlus.vue";
  import IconCheck from "../../../icons/IconCheck.vue";
  import IconFilterFilled from "../../../icons/IconFilterFilled.vue";
  import IconArrowRight from "../../../icons/IconArrowRight.vue";
  import IconSort from "../../../icons/IconSort.vue";
  import IconSortAsc from "../../../icons/IconSortAsc.vue";
  import BfStage from "../../../layout/BfStage/BfStage.vue";
  import IconProcedure from "../../../icons/IconProcedure.vue";
  import IconMenu from "../../../icons/IconMenu.vue";
  import IconArrowUp from "../../../icons/IconArrowUp.vue";
  import PennsieveTable from "../../../shared/PennsieveTable/PennsieveTable.vue";
  import IconArrow from "../../../icons/IconArrow.vue";
  import Cookies from "js-cookie";
  import StageActions from "../../../shared/StageActions/StageActions.vue";
  import {useGetToken} from "@/composables/useGetToken";
  import {useSendXhr} from "@/mixins/request/request_composable";

  export default {
    name: 'RelationshipTypes',

    components: {
      StageActions,
      PennsieveTable,
      IconArrowUp,
      IconMenu,
      IconProcedure,
      IconSortAsc,
      IconSort,
      IconArrowRight,
      IconFilterFilled,
      IconCheck,
      IconPlus,
      BfButton,
      BfEmptyPageState,
      CreateRelationshipTypeDialog,
      DeleteRelationshipTypeDialog,
      BfStage,
      IconArrow
    },

    mixins: [
      FileIcon,
      TableFunctions,
      Sorter,
      Request
    ],

    data() {
      return {
        isFilterMenuOpen: false,
        filteredRelationshipTypes: [],
        transformedLinkedPropTypes: [],
        propRelTypesResponse: [],
        activeColumn: '',
        filterOptionSelections: {},
        selection: [],
        createRelationshipDialogVisible: false,
        deleteRelationshipDialogVisible: false,
        relationshipTypeEdit: {},
        sortBy: 'source',
        sortOrder: 'asc'

      }
    },

    computed: {
      ...mapState([
        'dataset',
        'concepts',
        'config',
        'relationshipTypes',
        'isLoadingRelationshipTypes'
      ]),

      ...mapGetters([
        'getRelationshipTypes',
        'datasetLocked'
      ]),

      /**
       * Combines two responses to pass to data graph component
       * @returns {Array}
       */
      relationshipLinkedProps: function() {
        return this.propRelTypesResponse.concat(this.relationshipTypes)
      },

      /**
       * Compute if the dataset has relationships
       * @returns {Boolean}
       */
      hasRelationships: function() {
        // removing file relationship belongs_to as it should not be visible to users
        const sansFileRelationship = reject(propEq('name', 'belongs_to'), this.relationshipTypes)
        return sansFileRelationship.length > 0
      },

      hasItemSelected: function() {
        return this.selection.length
      },

      columns: function() {
        return ['source', 'relationship', 'destination']
      },

      filterOptions: function() {
        const options = {}
        this.columns.forEach(column => {
          options[column] = uniq(pluck(column, this.transformedRelationshipTypes))
        })
        return options
      },

      /**
      * Compute relationship types url
      * @returns {String}
      */
      relationshipsUrl: function() {
        const datasetId = pathOr('', ['params', 'datasetId'], this.$route)
        const conceptsUrl = propOr('', 'conceptsUrl', this.config)
        if (conceptsUrl && datasetId) {
          return `${conceptsUrl}/datasets/${datasetId}/relationships`
        }
      },

      linkedPropertiesUrl: function() {
        const datasetId = pathOr('', ['params', 'datasetId'], this.$route)
          if (datasetId) {
            return `${this.config.conceptsUrl}/datasets/${datasetId}/concepts/linked/properties`
          }
          return ''
        },
      transformedRelationshipTypes:  function() {
          return this.relationshipTypes.map(item => {
            // debugger
            const sourceDisplayName = this.getModelProperty(item.from, 'displayName')
            const sourceName = this.getModelProperty(item.from, 'name')
            const destinationDisplayName = this.getModelProperty(item.to, 'displayName')
            const destinationName = this.getModelProperty(item.to, 'name')


            return {
              id: item.id,
              source: sourceDisplayName,
              relationship: item.displayName,
              relationshipName: item.name,
              destination: destinationDisplayName,
              sourceName,
              destinationName,
              type: 'relationship'
            }
          })

      }
    },

    watch: {
      '$route.query.createRelationshipType': {
        handler: function(createRelationshipType) {
          if (createRelationshipType) {
            this.openRelationshipTypeModal()
          }
        },
        immediate: true
      },

      columns: {
        handler: function(columns) {
          columns.forEach(column => {
            this.filterOptionSelections[column] = []
          })
        },
        immediate: true
      },

      linkedPropertiesUrl: {
        handler: function(val) {
          if (val) {
            this.getRelationshipLinkedProperties()
          }
        },
        immediate: true
      },
      relationshipTypes: {
        handler: function(val) {
          this.setupRelationshipTypes.bind(this)
        }

      },

    },

    mounted: function() {
      this.fetchModels()


      // this.getRelationshipTypes().then(() => {
      //   this.setupRelationshipTypes.bind(this)
      // })
      this.getRelationshipLinkedProperties()
    },

    methods: {
      ...mapActions([
        'setRelationshipTypes',
        'updateRelationshipType',
        'deleteRelationshipType'
      ]),
      ...mapActions('metadataModule', [
        'fetchModels'
      ]),

      /**
       * Open relationship type modal
       */
      openRelationshipTypeModal: function() {
        this.createRelationshipDialogVisible = true
      },

      closeRelationshipDialog: function() {
        this.createRelationshipDialogVisible = false
      },
      getRelationshipLinkedProperties: function() {
        if (!this.linkedPropertiesUrl) {
          return
        }
        useGetToken()
          .then(token => {
            return useSendXhr(this.linkedPropertiesUrl, {
              header: {
                Authorization: `bearer ${token}`
              }
            })
              .then(response => {
                this.propRelTypesResponse = response
              })
          }).catch(this.handleXhrError.bind(this))
      },

      /**
       * Format raw api response data
       * @param {Array} rawData
       * @returns {Array}
       */
      transformAPIResponse: function(rawData, type = 'relationship') {
        return rawData.map(item => {
          const sourceDisplayName = this.getModelProperty(item.from, 'displayName')
          const sourceName = this.getModelProperty(item.from, 'name')
          const destinationDisplayName = this.getModelProperty(item.to, 'displayName')
          const destinationName = this.getModelProperty(item.to, 'name')


          return {
            id: item.id,
            source: sourceDisplayName,
            relationship: item.displayName,
            relationshipName: item.name,
            destination: destinationDisplayName,
            sourceName,
            destinationName,
            type: type
          }
        })
      },

      /**
       * Return model name from a given id
       * @param {String} id
       * @param {String} prop
       * @returns {String}
       */
      getModelProperty: function(id, prop) {
        const model = find(propEq('id', id), this.concepts)
        return propOr('', prop, model)
      },


      /**
       * Open relationship type modal
       */
      onCreateNewRelationship: function() {
        this.$refs.relationshipTable.clearSelection()
        this.relationshipTypeEdit = {}
        this.createRelationshipDialogVisible = true
      },

      /**
       * Open relationship type modal
       */
      onEditRelationship: function() {
        this.createRelationshipDialogVisible = true
      },

      /**
      * Handle table selection change
      * @param {Array} selection
      */
      onTableSelectionChange: function(selection) {
        this.selection = selection
      },

      /**
       * Handle table row click event
       * @param {Object} row
       */
      onTableRowClick: function(row) {
        this.activeRow = row
        this.closeFilterMenu()
      },

      onDeleteRelationshipAction: function() {
        this.deleteRelationshipDialogVisible = true
      },

      /**
       * Handle table row menu click event
       * @param {String} command
       * @param {Object} row
       */
      handleTableSelectionChange: function(selection) {

        let selectedRelationship = selection[0]
        // Find relationship type
        this.relationshipTypeEdit = {
          id: propOr('', 'id', selectedRelationship),
          originModel: propOr('', 'sourceName', selectedRelationship),
          originModelDisplayName: propOr('', 'source', selectedRelationship),
          relationshipName: propOr('', 'relationshipName', selectedRelationship),
          destinationModel: propOr('', 'destinationName', selectedRelationship),
          destinationModelDisplayName: propOr('', 'destination', selectedRelationship),
        }
      },

      /**
       * Handle table header click event
       * @param {Object} column
       * @param {Object} event
       */
      onHeaderClick: function(column, event) {
        const tagName = pathOr('', ['target', 'tagName'], event)

        if (tagName === 'BUTTON') {
          this.updateFilterMenu(column.property)
        } else {
          this.closeFilterMenu()
        }
      },

      /**
       * Update filter menu state
       * @param {String} column
       */
      updateFilterMenu: function(column) {
        if (this.activeColumn === column) {
          this.closeFilterMenu()
        } else {
          this.activeColumn = column
          this.isFilterMenuOpen = true
          this.$refs.filterMenu.updatePopper()
        }
      },

      /**
       * Clear column filter selections
       * @param {Object} event
       */
      clearColumnFilterSelections: function(event) {
        this.filterOptionSelections[this.activeColumn] = []
        this.filterTable()
      },

      /**
       * Close filter menu
       */
      closeFilterMenu: function() {
        this.isFilterMenuOpen = false
        this.activeColumn = ''
      },

      /**
       * Handle filter by option click
       * @param {String} columnName
       * @param {String} option
       */
      onFilterOptionClick: function(columName, option) {
        const filterOptionSelections = clone(this.filterOptionSelections)

        const items = filterOptionSelections[columName]
        const idx = items.indexOf(option)

        if (idx >= 0) {
          items.splice(idx, 1)
        } else {
          items.push(option)
        }

        this.filterOptionSelections = filterOptionSelections

        this.filterTable()
      },

      /**
       * Compute if filter option is checked
       * @param {String} columnName
       * @param {String} option
       * @returns {Boolean}
       */
      isFilterOptionChecked: function(columName, option) {
        const items = this.filterOptionSelections[columName]
        const idx = items.indexOf(option)

        if (idx >= 0) {
          return true
        }
        return false
      },

      /**
       * Compute if a given column has filter selections
       * @param {String} columnName
       */
      hasFilterSelections: function(columnName) {
        const items = propOr([], columnName, this.filterOptionSelections)
        return items.length > 0
      },

      /**
       * Filter table results based on option selections
       */
      filterTable: function() {
        this.filteredRelationshipTypes = this.transformedRelationshipTypes.filter(relType => {
          const checks = []
          this.columns.forEach(column => {
            const selections = this.filterOptionSelections[column]

            if (selections.length) {
              const filterBySelection = relType[column]
              checks.push(includes(filterBySelection, selections))
            }
          })
          return all(equals(true), checks)
        })

        this.sortColumn(this.activeColumn, this.sortDirection)
      },

      /**
       * Sort table by column
       * @param {String} columnName
       * @param {String} sortDirection
       */
      sortColumn: function(columnName, sortDirection) {
        const sortedList = this.returnSort(columnName, this.filteredRelationshipTypes, sortDirection)
        this.filteredRelationshipTypes = sortedList
      },

      /**
       * Checkbox display logic
       * @param {Object} store
       * @return {Boolean}
       */
      showRowCheckbox(store) {
        const tableState = store.states

        return tableState.isAllSelected
      },

      /**
       * Popper component modifier
       * @param {String} columnName
       * @param {Object} data
       * @returns {Object}
       */
      popperModifier: function(data) {
        const activeColumn = this.activeColumn
        const column = document.querySelector(`.column-${activeColumn}`)

        if (column) {
          const { x } = column.getBoundingClientRect()
          const offsetTop = pathOr(0, ['offsets', 'popper', 'top'], data)
          data.offsets.popper.left = x + 8
          data.offsets.popper.top = offsetTop + 200
        }

        return data
      },

      /**
       * Handle add relationship type event
       * @param {Object} relationship
       */
      onAddRelationshipType: function(relationship) {
        this.setRelationshipTypes([...this.relationshipTypes, relationship])
        // track creating a relationship type
        EventBus.$emit('track-event', {
          name: 'Create Relationship Type'
        })

        const chart = this.$refs.dataModelGraph
        if (chart) {
          chart.resetChart()
        }
      },

      /**
       * Update relationshipTypes state in vuex
       * @param {Object} relationship
       */
      onUpdateRelationshipType: function(relationship) {
        this.updateRelationshipType(relationship)

        const chart = this.$refs.dataModelGraph
        if (chart) {
          chart.resetChart()
        }
      },

      /**
       * Handle remove relationship event
       * @param {Object} relationship
       */
      onRemoveRelationshipType: function(relationship) {
        this.deleteRelationshipType(relationship)

        const chart = this.$refs.dataModelGraph
        if (chart) {
          chart.resetChart()
        }
      },

      /**
       * Setup relationship types table
       */
      setupRelationshipTypes: function() {
        // transform raw api data
        this.transformedRelationshipTypes = this.transformAPIResponse(this.relationshipTypes)
        // remove file relationship belongs_to
        this.filteredRelationshipTypes = this.transformedRelationshipTypes.filter(relType => relType.relationshipName !== 'belongs_to')
        // sort table
        this.sortColumn(this.sortBy, this.sortDirection)
      }
    }
  }
</script>

<style lang="scss">
  @use '../../../../styles/theme';
  @use './filter-menu';

  .model-name-heading {
    color: theme.$purple_3;
    margin: 0 0 0 16px;
    text-transform: capitalize;
    font-size: 18px;
    align-items: center;
    display: flex;
  }

  .relationship-wrapper {
    display: flex;
  }

  .relationship-types {
    .empty-state {
      h3 {
        margin: 0 0 16px;
      }

      h2 {
        font-size: 16px;
      }

      p {
        font-size: 14px;
        margin-bottom: 18px;
      }
    }

    .data-model-graph {
      margin-bottom: 24px;
      .chart {
        border: 1px solid theme.$gray_2;
      }
    }

    .add-relationship-type-btn {
      align-items: center;
      border: 1px solid theme.$gray_2;
      color: theme.$purple_1;
      display: flex;
      cursor: pointer;
      font-size: 14px;
      height: 58px;
      margin-bottom: 24px;
      padding: 0 16px;
      width: 100%;

      .svg-icon {
        height: 24px;
        width: 24px;
      }
    }

    .el-table {
      outline: none;

      td.checkbox {
        text-align: center;
      }

      .icon-arrow {
        color: #BDBDBD;
      }
    }

    .table-info {
      display: flex;
      justify-content: space-between;
    }

    .icon-procedure {
      color: theme.$purple_1;
    }
  }
</style>
