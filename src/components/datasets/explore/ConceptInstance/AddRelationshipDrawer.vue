<template>
  <side-drawer
    class="add-relationship-drawer"
    :heading="drawerHeading"
    :show-cancel-button="showCancelButton"
    :visible="visible"
    @close-side-drawer="closeSideDrawer"
  >
    <template #copy>
      <div>
        <template v-if="isFile">
          <p class="mb-0">
            Associate the selected file with one or more metadata records in the dataset.
          </p>
        </template>

        <template v-else>
          Link records in your graph as determined by your model manager. <a
          href="https://docs.pennsieve.io/docs/creating-relationships-between-metadata-models"
          target="_blank"
        >
          Help me with this
        </a>
        </template>
      </div>

    </template>

    <template #body>
      <div
        class="add-relationship-drawer-body full-width"
      >
        <template v-if="!isFile">
          <row-block class="mb-8 condensed">
            <template #support-image>
              <circle-icon
                class="icon-step complete"
              >
                <template #icon>
                  <IconCheck
                    :height="20"
                    :width="20"
                  />
                </template>

              </circle-icon>
            </template>

            <template #title>
              <h2>
                Originating Record
              </h2>
            </template>

            <template #subtext>
              <component :is="modelIcon"
                         :height="12"
                         :width="12"
                         class="mr-8"
              />

              <span>{{ recordName }}</span>
            </template>
          </row-block>

          <row-block
            class="mb-8 condensed"
            :collapsable="true"
            :open="selectTypeOpen"
            @header-click="selectTypeOpen = !selectTypeOpen"
          >
            <template #support-image>
              <CircleIcon
                :class="[ relationshipVal !== '' ? 'complete' : '']"
              >
                <template #icon>
                  <component :is="relationshipTypeIcon"
                             :class="[ relationshipVal !== '' ? 'complete' : '']"
                             :height="20"
                             :width="20"
                             color="white"
                  />
                </template>

              </CircleIcon>
            </template>

            <template #title>
              <h2>
                Select the Relationship Type
              </h2>
            </template>

            <template #cta>
              <bf-button
                v-if="selectTypeOpen"
                class="ghost compact"
                @click="open = true"
              >
                Done
              </bf-button>
            </template>

            <template #subtext>
              <IconProcedure
                class="subtext-icon mr-8"
                :height="12"
                :width="12"
              />

              <span
                v-if="relationshipVal"
                class="relationship-val"
              >
              {{ relationshipDisplayName }}
            </span>
              <IconArrow
                v-if="relationshipVal"
                icon="icon-arrow"
                class="icon-arrow"
                :class="[ inverseDirection ? 'svg-flip' : '' ]"
                :width="24"
                :height="24"
              />
              <span v-else>
              Choose how your records are linked in the graph.
            </span>
            </template>

            <template #content>
              <div>
                <relationship-input
                  ref="relationshipInput"
                  v-model="relationshipVal"
                  show-direction
                  :inverse-direction.sync="inverseDirection"
                  :can-create="false"
                  :options="relatedFields"
                />
              </div>
            </template>

          </row-block>
        </template>

        <row-block
          class="choose-destination-wrap mb-16 condensed"
          :collapsable="true"
          :open="chooseDestinationOpen"
          @header-click="chooseDestinationOpen = !chooseDestinationOpen"
        >
          <template #support-image>
            <circle-icon
              class="icon-step"
              :icon="destinationIcon"
              :class="[ selectedItemIds.size > 0 ? 'complete' : '']"
              height="20"
              width="20"
            >
              <template #icon>
                <component
                  v-if="selectedItemIds.size > 0"
                  :is="relationshipTypeIcon"
                           :class="[ relationshipVal !== '' ? 'complete' : '']"
                           :height="20"
                           :width="20"
                           color="white"
                />
              </template>
            </circle-icon>

          </template>

          <template #title>
            <h2
              v-if="isFile"
            >
              Choose Records
            </h2>
            <h2
              v-else
            >
              Choose the destination
            </h2>
          </template>

          <template #cta>
            <bf-button
              v-if="chooseDestinationOpen"
              slot="cta"
              class="ghost compact"
              @click="open = true"
            >
              Done
            </bf-button>

          </template>

          <template #subtext>
            <IconGraph
              class="subtext-icon mr-8"
              :height="12"
              :width="12"
            />

            <span v-if="selectedItemIds.size > 0">
            {{ selectedItemIds.size }} record{{ selectedItemIds.size > 1 ? 's' : '' }} selected
          </span>
            <span v-if="selectedItemIds.size === 0">
            {{ concept.count }} {{ concept.displayName }} records available
          </span>
          </template>

          <template #content>
            <model-records-results
              :concept="concept"
              :default-limit="25"
              :has-multi-select="true"
              :selected-item-ids="selectedItemIds"
              @select-all="onSelectAll"
              @select-individual="onSelectIndividual"
              @search-results-changed="updateSearchResults"
            />
          </template>
        </row-block>
      </div>
    </template>

    <template #buttons>
      <div>
        <bf-button
          class="secondary"
          @click="closeSideDrawer"
        >
          Cancel
        </bf-button>
        <bf-button
          v-loading="isLoading"
          :disabled="disableButton"
          @click="createRelationships"
        >
          Create Relationships
        </bf-button>
      </div>
    </template>

  </side-drawer>
</template>

<script>
import {mapActions, mapGetters} from 'vuex'
import SideDrawer from '../../../shared/side-drawer/SideDrawer.vue'
import BfButton from '../../../shared/bf-button/BfButton.vue'
import TableFunctions from '../../../../mixins/table-functions'
import EncodeInternalFields from '../../../../mixins/encode-internal-fields'
import Request from '../../../../mixins/request'
import EventBus from '../../../../utils/event-bus'
import RowBlock from '../../../shared/RowBlock/RowBlock.vue'
import CircleIcon from '../../../shared/CircleIcon/CircleIcon.vue'
import RelationshipInput from '../RelationshipInput/RelationshipInput.vue'
import debounce from 'lodash.debounce'
import {compose, defaultTo, dissoc, find, head, pathOr, prop, propEq, propOr, uniqBy} from 'ramda'
import ModelRecordsResults from "../search/ModelRecordsResults.vue";
import {Methods} from "../../../../typescript/src/add-relationship-drawer/methods";
import IconGraph from "../../../icons/IconGraph.vue";
import IconProcedure from "../../../icons/IconProcedure.vue";
import IconArrow from "../../../icons/IconArrow.vue";
import IconDocument from "../../../icons/IconDocument.vue";
import IconCheck from "../../../icons/IconCheck.vue";
import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";

export default {
  name: 'AddRelationshipDrawer',

  components: {
    IconDocument,
    IconArrow,
    IconProcedure,
    IconGraph,
    ModelRecordsResults,
    SideDrawer,
    BfButton,
    RowBlock,
    CircleIcon,
    RelationshipInput,
    IconCheck
  },

  mixins: [
    TableFunctions,
    Request,
    EncodeInternalFields
  ],

  props: {
    recordName: {
      type: String
    },
    record: {
      type: Object
    },
    relationshipTypes: {
      type: Array,
      default: function () {
        return []
      }
    },
    isFile: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      searchResults: [],
      property: {},
      conceptTitle: {},
      concept: {},
      title: '',
      visible: false,
      showCancelButton: false,
      findByName: '',
      enableSelection: true,
      selectedItemIds: new Set(),
      prependNewField: true,
      selectTypeOpen: false,
      chooseDestinationOpen: false,
      relationshipVal: '',
      relationshipId: '',
      relationshipDisplayName: '',
      inverseDirection: false,
      searchResultsHeight: 0,
      relatedFields: [],
      isLoading: false
    }
  },

  computed: {
    ...mapGetters([
      'concepts',
      'config',
      'getModelById',
      'getModelByName',
      'getRelationshipTypeByName'
    ]),

    datasetId: function () {
      return this.$route ? this.$route.params.datasetId : ''
    },

    /**
     * Compute heading for drawer
     * @returns {String}
     */
    drawerHeading: function () {
      return this.isFile ? 'Attach File to Metadata Records' : 'Create Relationship'
    },

    /**
     * Generates url to create a relationship
     * @returns {String}
     */
    createRelationshipUrl: function () {
      const datasetId = this.$route.params.datasetId
      return `${this.config.apiUrl}/models/v1/datasets/${datasetId}/relationships/${this.relationshipId}/instances/batch`
    },

    /**
     * Compute relationship type icon
     * @returns {String}
     */
    relationshipTypeIcon: function () {
      return this.relationshipVal !== '' ? 'icon-check' : null
    },

    /**
     * Compute destination icon
     * @returns {String}
     */
    destinationIcon: function () {
      return this.selectedItemIds.size > 0 ? 'icon-check' : null
    },

    /**
     * Compute model icon
     * @returns {String}
     */
    modelIcon: function () {
      return defaultTo('icon-graph', prop('icon', this.concept))
    },

    /**
     * Computes concept name
     * @returns {String}
     */
    conceptName: function () {
      return propOr('', 'name', this.concept)
      return defaultTo(defaultName, this.selectedModel)
    },

    /**
     * Computes whether or not to disable next step
     * @returns {Boolean}
     */
    disableButton: function () {
      return this.selectedItemIds.size === 0 || this.relationshipVal === ''
    },

    /**
     * Returns sorted keys
     * @returns {Array}
     */
    placeholderText: function () {
      const conceptTitle = propOr('', 'displayName', this.conceptTitle)
      return `Filter by ${conceptTitle}`
    },
  },

  watch: {
    selectTypeOpen: function () {
      this.resizeTable()
    },

    chooseDestinationOpen: function () {
      this.resizeTable()
    },

    searchResults: function (searchResults) {
      this.resizeTable()
      const conceptTitleObj = this.getConceptTitle(searchResults) || {}
      if (!this.property.value && conceptTitleObj.name) {
        this.conceptTitle = conceptTitleObj
        this.property = dissoc('value', conceptTitleObj)
      }
    },

    relationshipVal: {
      handler: function (val) {
        if (val) {
          this.chooseDestinationOpen = true
          this.relationshipDisplayName = this.getRelationshipDisplayName(val, this.relationshipTypes)
          this.relationshipId = this.getRelationshipId(val, this.relationshipTypes)
        }
      }
    }
  },

  mounted: function () {
    window.addEventListener('resize', this.resizeTable.bind(this))
  },

  unmounted: function () {
    window.removeEventListener('resize', this.resizeTable.bind(this))
  },

  methods: {
    ...mapActions([
      'addRelationshipType'
    ]),

    updateSearchResults: function (searchResults) {
      this.searchResults = searchResults
    },

    /**
     * Gets the relationship ID for the selected relationship so that we could use it
     * in the endpoint request
     * @param {String} relationshipName
     * @param {Array} relationshipTypes
     * @returns {String}
     */
    getRelationshipId: (relationshipName, relationshipTypes) => {
      const rt = relationshipTypes.find(r => r.name === relationshipName)
      return rt ? rt.id : undefined
    },

    /**
     * Get relationship display name
     * @param {String} relationshipName
     * @param {Array} relationshpTypes
     * @returns {String}
     */
    getRelationshipDisplayName: (relationshipName, relationshipTypes) => {
      const rt = relationshipTypes.find(r => r.name === relationshipName)
      return rt ? rt.displayName : undefined
    },

    /**
     * Compute relationship types url
     * @returns {String}
     * @param direction
     */
    relationshipTypesUrl: function (direction) {

      const datasetId = pathOr('', ['params', 'datasetId'], this.$route)
      const conceptsUrl = propOr('', 'conceptsUrl', this.config)

      const originName = propOr('', 'type', this.record)
      const destinationName = propOr('', 'name', this.concept)

      const originModelId = propOr('', 'id', this.getModelByName(originName))
      const destinationModelId = propOr('', 'id', this.getModelByName(destinationName))

      let from = originModelId
      let to = destinationModelId

      if (direction === 'inverse') {
        from = destinationModelId
        to = originModelId
      }
      if (conceptsUrl && datasetId && from && to) {
        return `${conceptsUrl}/datasets/${datasetId}/relationships?from=${from}&to=${to}`
      }
    },

    /**
     * Request relationships
     * @param {String} direction
     * @returns {Promise}
     */
    getRelationships: function (direction) {
      return useGetToken()
        .then(token => {
          return this.sendXhr(this.relationshipTypesUrl(direction), {
            header: {
              'Authorization': `bearer ${token}`
            },
        })
      }).catch(err => useHandleXhrError(err))
    },

    /**
     * Request all relationship types (outbound and inverse directions)
     */
    getAllRelationships: function () {
      const requests = [this.getRelationships('outbound'), this.getRelationships('inverse')]

      Promise.all(requests)
        .then(([a, b]) => {
          const response = [...a, ...b]
          this.relatedFields = uniqBy(prop('name'), response)

          if (this.relatedFields.length === 1) {
            const name = compose(
              prop('name'),
              head
            )(this.relatedFields)

            if (name) {
              this.relationshipVal = name
            }
          }
        })
        .catch(this.handleXhrError)
    },

    /**
     * Callback for window resize, debounced 200ms
     */
    onWindowResize: debounce(
      function () {
        this.resizeTable()
      },
      200
    ),

    /**
     * Results table
     * Compute height of the table's parent and set property to send to the table
     */
    resizeTable: function () {
      this.$nextTick(() => {

        const searchResultsWrap = this.$refs.searchResultsWrap

        if (searchResultsWrap) {
          this.searchResultsHeight = searchResultsWrap.getBoundingClientRect().height
        }
      })
    },

    /**
     * Creates concept title reference
     * @param {Array} list
     * @returns {Object}
     */
    getConceptTitle: function (searchResults) {
      return Methods.getConceptTitle(searchResults)
    },

    /**
     * Opens the select menu based upon node index
     */
    openSelectMenu: function (idx) {
      this.$refs.relationshipInput.open()
    },
    checkBelongsToExists: function () {
      const belongsTo = this.getRelationshipTypeByName('belongs_to')
      if (Object.keys(belongsTo).length === 0) {
        // if not, create a default, then create the file relationship
        return this.createDefaultRelationship()
      }
      return Promise.resolve([])
    },

    createRelationships: function () {
      this.isLoading = true
      if (this.isFile) {

        this.checkBelongsToExists()
          .then(() => this.createFileRelationshipRequests())
          .then(() => this.createRelationshipsSuccess())
          .finally(() => this.isLoading === false)
      } else {
        this.createRecordRelationships().finally(() => this.isLoading = false)
      }
    },

    /**
     * Creates default relationship
     */
    createDefaultRelationship: function () {
      const datasetId = pathOr('', ['params', 'datasetId'], this.$route)
      const url = `${this.config.conceptsUrl}/datasets/${datasetId}/relationships`
      return useGetToken()
        .then(token => {
          return this.sendXhr(url, {
            method: 'POST',
            header: {
              'Authorization': `bearer ${token}`
            },
            body: {
              name: 'belongs_to',
              displayName: 'Belongs To',
              description: '',
              schema: []
            }
          }).then(response => {
            this.addRelationshipType(response)
          })
        }).catch(err => useHandleXhrError(err))
    },

    /**
     * Create file relationships
     */
    createFileRelationship: function () {
      this.createFileRelationshipRequests()
        .then((resp) => {
          // check for errors
          const hasErrors = this.checkForRelationshipErrors(resp)
          if (hasErrors) {
            this.isCreating = false
            return this.handleXhrError()
          }
          const conceptName = propOr('', 'name', this.concept)

          // track adding a relationship between a file and a record
          EventBus.$emit('track-event', {
            name: 'Add a Relationship Between a File and a Record'
          })

          // add relationships to file(s)
          EventBus.$emit('refresh-table-data', {
            name: conceptName,
            count: this.selectedItemIds.size,
            type: 'Add'
          })

          EventBus.$emit('toast', {
            detail: {
              msg: `A new relationship has been created`,
              type: 'success'
            }
          })
          this.closeSideDrawer()
          this.isCreating = false
        })
    },

    /**
     * Creates relationships with file(s)
     */
    createFileRelationshipRequests: function () {
      const datasetId = pathOr('', ['params', 'datasetId'], this.$route)
      const url = `${this.config.conceptsUrl}/datasets/${datasetId}/proxy/package/instances`

      const queues = Array.from(this.selectedItemIds).map(itemId => {
        const recordId = itemId
        const packageId = pathOr('', ['params', 'fileId'], this.$route)
        const linkTarget = {
          'ConceptInstance': {
            id: recordId
          }
        }

        return useGetToken()
          .then(token => {
            return this.sendXhr(url, {
              method: 'POST',
              header: {
                'Authorization': `bearer ${token}`
              },
              body: {
                externalId: packageId,
                targets: [{
                  direction: 'FromTarget',
                  linkTarget,
                  relationshipType: 'belongs_to',
                  relationshipData: []
                }]
              }
            })
          }).catch(err => useHandleXhrError(err))

      })
      // this maps over all the queued responses to guarantee that all responses are returned regardless of error status
      return Promise.all(queues.map(q => {
        return q.catch(err => ({status: err.status}))
      })).catch(err => console.log(err))
    },

    /**
     * Callback for create relationship success
     * Refresh table and close drawer
     */
    createRelationshipsSuccess: function () {
      const conceptName = propOr('', 'name', this.concept)
      const displayName = propOr('', 'displayName', this.concept)

      const numRequests = this.selectedItemIds.size
      const plural = numRequests === 1 ? '' : 's'

      EventBus.$emit('refresh-table-data', {
        name: conceptName,
        count: numRequests,
        displayName,
        type: 'Add'
      })
      EventBus.$emit('toast', {
        detail: {
          msg: `Record${plural} Linked!`,
          type: 'success'
        }
      })
      this.closeSideDrawer()
      this.isCreating = false
    },


    /**
     * Create relationship
     */
    createRecordRelationships: function () {
      // execute batch request
      let body = []
      let to, from = ''
      this.selectedItemIds.forEach(item => {
        if (this.inverseDirection) {
          to = this.$route.params.instanceId
          from = item
        } else {
          to = item
          from = this.$route.params.instanceId
        }
        body.push({
          from,
          to,
          values: []
        })
      })

      return useGetToken()
        .then(token => {
          return this.sendXhr(this.createRelationshipUrl, {
            method: 'POST',
            header: {
              'Authorization': `bearer ${token}`
            },
            body
          })
            .then(() => {
              // track adding a relationship between records
              EventBus.$emit('track-event', {
                name: 'Add a Relationship Between Records'
              })

              this.createRelationshipsSuccess()
            })

        }).catch(err => useHandleXhrError(err))

    },

    /**
     * Handles table column selection change
     * @param {Array} items
     */
    onSelectAll: function (items) {
      this.selectedItemIds = Methods.onSelectAllItems(this.selectedItemIds, items, this.searchResults)
    },

    onSelectIndividual: function (value, item) {
      this.selectedItemIds = Methods.onSelectIndividualItem(this.selectedItemIds, value, item)
    },

    /**
     * Opens the side drawer and sets the drawer title
     * @param {String} conceptId
     */
    openDrawer: function (conceptId) {
      this.concept = (this.concepts || []).find(c => c.id === conceptId) || {}

      this.$nextTick(() => {
        this.visible = true

        // Expand step three if the origin is a file
        if (this.isFile) {
          this.chooseDestinationOpen = true
          this.relationshipVal = 'belongs_to'
        } else {
          this.getAllRelationships()
        }
      })
    },

    /**
     * Handles close-side-drawer event
     */
    closeSideDrawer: function () {
      this.visible = false

      this.$nextTick(() => {
        this.showCancelButton = false
        this.selectedItemIds = new Set()
        this.selectTypeOpen = false
        this.chooseDestinationOpen = false
        this.relationshipVal = ''
        this.conceptTitle.value = ''
      })
    }
  }
}
</script>

<style lang="scss">
@import '../../../../assets/variables';

.side-drawer {
  .full-width {
    width: 100%;
  }

  .search-filter {
    display: flex;
    margin-bottom: 16px;

    input, select, textarea {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }

    button {
      background: $purple_1;
      border: solid 1px transparent;
      border-radius: 0 3px 3px 0;
      cursor: pointer;
      width: 40px;
      height: 40px;
      line-height: 38px;
      text-align: center;

      &:hover {
        background: $purple_3;
      }
    }
  }

  .bf-button.secondary {
    margin-right: 4px;
  }

  .el-checkbox__inner {
    height: 16px;
    width: 16px;
  }
}
.choose-destination-wrap {
  .row-block-collapse-content {
    display: flex;
    flex: 1;
    flex-direction: column;
    overflow: scroll;
  }

  &.open {
    min-height: 350px;
  }
}
</style>
<style lang="scss" scoped>
@import '../../../../assets/variables';

.add-relationship-drawer {
  .circle-icon {
    background: $app-primary-color;
    color: #fff;
    font-size: 16px;
    font-weight: 500;
    -webkit-font-smoothing: antialiased;
    &.complete {
      background: $green_1;
    }
  }
}
.choose-destination-wrap.open {
  flex: 1;
}
.add-relationship-drawer-body {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.relationship-input {
  width: 476px
}
.search-results-wrap {
  flex: 1;
  height: 100%;
  overflow: hidden;
}
.btn-load-more {
  align-self: flex-start;
  color: $app-primary-color;
  font-size: 12px;
  font-weight: 500;
  &:hover, &:focus {
    text-decoration: underline;
  }
}
.destionation-list {
  display: flex;
  li {
    &:before {
      content: ',';
    }
    &:first-child:before {
      content: ''
    }
  }
}
.relationship-val {
  display: inline-block;
}
.flip-icon-arrow {
  transform: rotate(180deg);
}
</style>
