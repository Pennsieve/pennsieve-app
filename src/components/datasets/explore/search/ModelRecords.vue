<template>
 <bf-stage>
   <template #actions>
     <stage-actions>
       <template #left>
         <div
           class="model-name-heading"
         >
           <div>
             <IconLockFilled
               v-if="datasetLocked"
               class="mr-8"
               color="#71747C"
               :height="24"
               :width="24"
             />
             Selected model: {{ modelDisplayName }}
           </div>

         </div>
       </template>
       <template #right>
         <router-link
           v-if="selectedModelId !== ''"
           :to="{
            name: 'metadata-record-edit',
            params: {
              modelId: selectedModelId,
              instanceId: 'new'
            }
          }"
         >
           <bf-button
             class="action-button"
           >
             New {{modelDisplayName }}
           </bf-button>
         </router-link>
       </template>
     </stage-actions>
   </template>

   <div class="records-explore">
     <template v-if="hasModels">
       <div class="explore-wrapper">
         <div class="results">
           <div>

             <template v-if="recordCount === 0">
               <bf-empty-page-state
                 class="no-results"
               >
                 <img
                   src="/src/assets/images/illustrations/illo-missing-models.svg"
                   alt=""
                 >
                 <template v-if="propertyCount === 0">
                   <h3> There are no properties for model {{ modelDisplayName }}.</h3>
                   <p>
                     Before you can create a record, you'll need to add some properties to this model.
                   </p>
                   <!--                 <router-link-->
                   <!--                   :to="{-->
                   <!--// &lt;!&ndash;                  name: 'models',&ndash;&gt;-->
                   <!--// &lt;!&ndash;                  params: {&ndash;&gt;-->
                   <!--// &lt;!&ndash;                    conceptId: $route.params.conceptId,&ndash;&gt;-->
                   <!--                  }}"-->
                   <!--                 >-->
                   <!--                   <bf-button-->
                   <!--                     v-if="getPermission('editor')"-->
                   <!--                     class="no-results-button"-->
                   <!--                     :disabled="datasetLocked"-->
                   <!--                   >-->
                   <!--                     Manage Models-->
                   <!--                   </bf-button>-->
                   <!--                 </router-link>-->
                   <!---->
                 </template>
                 <template v-else>
                   <h3> There are no records for model {{ modelDisplayName }}.</h3>
                   <p>
                     A record is an instance of a model. For example, if you have a model defined for a "Patient", each record is associated with an individual patient and has values for the properties defined in the Patient model.
                   </p>
                   <router-link
                     v-if="propertyCount > 0"
                     :to="{
                      name: 'metadata-record',
                      params: {
                        modelId: selectedModelId,
                        instanceId: 'new'
                      }
                    }"
                   >
                     <bf-button
                       v-if="getPermission('editor')"
                       class="no-results-button"
                       :disabled="datasetLocked"
                     >
                       Create a New Record
                     </bf-button>
                   </router-link>
                   <!---->
                 </template>
               </bf-empty-page-state>
             </template>
             <template v-else>

               <search-filter
                 v-for="(filter, idx) in filterParams"
                 :key="filter.id"
                 ref="filters"
                 v-model:filter="filterParams[idx]"
                 class="mb-8"
                 :targets="targets"
                 :is-loading-targets="isLoadingTargets"
                 :disabled="false"
                 :lock-target="false"
                 :show-dataset-label="false"
                 @delete="deleteFilter(idx)"
                 @enter="$emit('enter')"
                 @input-value="onInputValue"
               />
               <!---->

               <div v-show="recordCount > 0">
                 <div class="add-filter-wrapper mb-24">
                   <IconPlus
                     :height="24"
                     :width="24"
                   />
                   <button
                     class="linked"
                     :disabled="search.model === ''"
                     @click="addFilter(true)"
                   >
                     Add Filter
                   </button>
                 </div>
                 <!---->
                 <!--               <div>-->

                 <record-search-results
                   ref="searchResults"
                   class="mb-48 search-results"
                   empty-state-copy="Try a different combination of filters"
                   :dataset="dataset"
                   :dataset-list="[]"
                   :search-criteria="search"
                   :show-search-results="true"
                   :show-controls="false"
                   :show-dataset-column="false"
                   :show-menu-column="false"
                   :show-download-results="false"
                   :is-records-sortable="isSortable"
                   :table-search-params="tableSearchParams"
                   :model="selectedModel"
                   @reset-search-params="resetSearchParams"
                   @sort="setSort"
                   @disable-records-button="isDownloadDisabled = $event"
                 />
                 <!--               </div>-->

               </div>
             </template>
           </div>

         </div>
         <div
           class="models-list-wrap"
           :class="{ 'visible': modelsListVisible }"
         >
           <div
             ref="modelsList"
             class="models-list-scroll"
           >
             <models-list
               :show-heading="false"
               :is-link="false"
               :should-reset.sync="resetModelsList"
               :scrolling-list="true"
               @click="clickModel"
             />
           </div>
         </div>
       </div>

     </template>
     <template v-else>
       <bf-empty-page-state
         class="no-results"
       >
         <img
           src="/src/assets/images/illustrations/illo-missing-models.svg"
           alt=""
         >
         <h3>No metadata models defined</h3>
         <p>
           Before you can create metadata records, you'll need to define one or more models.
         </p>
<!---->
         <router-link
           :to="{
// <!--                name: 'models',-->
// <!--                params: {-->
// <!--                  conceptId: $route.params.conceptId,-->
// <!--                }-->
              }"
         >
           <bf-button
             v-if="getPermission('editor')"
             class="no-results-button"
             :disabled="datasetLocked"
           >
             Manage Models
           </bf-button>
         </router-link>
       </bf-empty-page-state>
     </template>
   </div>
<!---->
 </bf-stage>
</template>

<script>
import { mapState, mapGetters, mapActions} from 'vuex'
import { pathOr, propOr, findIndex, propEq } from 'ramda'
import {v1 as uuidv1} from "uuid";
import debounce from 'lodash.debounce'
import Cookies from 'js-cookie'

import BfRafter from '../../../shared/bf-rafter/BfRafter.vue'
import BfButton from '../../../shared/bf-button/BfButton.vue'
import SearchFilter from '../../../SearchAllData/SearchFilter/SearchFilter.vue'
import RecordSearchResults from '../../../Metadata/RecordSearchResults.vue'
import BfEmptyPageState from '../../../shared/bf-empty-page-state/BfEmptyPageState.vue'
import ModelsList from '../../../datasets/records/ModelsList/ModelsList.vue'

import ValidateFiltersMixin from '../../../SearchAllData/validate-filters-mixin'
import StatBlock from '../../../shared/StatBlock/StatBlock.vue'

import { MAX_SORTABLE_RECORD_COUNT } from '../../../../utils/constants'
import IconLockFilled from "../../../icons/IconLockFilled.vue";
import IconPlus from "../../../icons/IconPlus.vue";
import StageActions from "@/components/shared/StageActions/StageActions.vue";
import {useGetToken} from "@/composables/useGetToken";

const formatNumber = (number) => new Intl.NumberFormat('en-EN').format(number)

const searchParams = {
  limit: 25,
  offset: 0,
  orderBy: null,
  ascending: false,
  orderDirection: 'asc'
}

/**
 * Transform models to a label/value list
 * @returns {Array}
 */
const transformModelListItems = (models) => {
  return models.map(model => {
    return {
      label: model.displayName,
      value: model.name
    }
  })
}

export default {
  name: 'ModelRecords',

  components: {
    StageActions,
    IconPlus,
    IconLockFilled,
    BfButton,
    BfEmptyPageState,
    BfRafter,
    SearchFilter,
    RecordSearchResults,
    ModelsList,
    StatBlock
  },

  mixins: [ ValidateFiltersMixin ],

  mounted: function() {
      this.fetchModels()
  },

  props: {
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
      search: {
        model: null,
        isModelInvalid: false,
        filters: [],
        datasets: []
      },
      modelsListVisible: true,
      resetModelsList: false,
      isLoadingTargets: false,
      tableSearchParams: Object.assign({}, searchParams),
      datasetList: [],
      isDownloadDisabled: false
    }
  },

  computed: {
    ...mapState('metadataModule', [
      'models',
      'filters',
      'filterParams',
      'selectedModel'
    ]),

    ...mapState([
      'lastRoute',
      'dataset',
    ]),

    ...mapGetters([
      'modelsCount',
      'totalRecordsCount',
      'datasetIntId',
      'getPermission',
      'datasetLocked',
      'getDataset'
    ]),

    /**
     * Compute and format total models
     * @returns {String}
     */
    totalModels: function() {
      return formatNumber(this.modelsCount)
    },

    /**
     * Compute and format total records
     * @returns {String}
     */
    totalRecords: function() {
      return formatNumber(this.totalRecordsCount)
    },

    /**
     * Compute direction for models list arrow based on if it is visible
     * @returns {String}
     */
    modelsListArrowDir: function() {
      return this.modelsListVisible ? 'right' : 'left'
    },

    /**
     * Compute if the dataset has models
     * @returns {Boolean}
     */
    hasModels: function() {
      return this.modelsList.length > 0
    },

    /**
     * Compute models list for `SelectModel`
     * @returns {Array}
     */
    modelsList: function() {
      return transformModelListItems(this.models)
    },
    /**
     * Compute all filter items
     * @returns {Array}
     */
    targets: function() {
      return [
        {
          label: 'Models',
          type: 'model',
          items: this.modelsList
        }
      ]
    },

    /**
     * Compute the number of records in the model
     * @returns {Number}
     */
    recordCount: function() {
      if (this.selectedModel){
        return this.selectedModel.count || 0
      }
      return 0
    },

    /**
     * Compute the number of properties in the model
     */
    propertyCount: function() {
      if (this.selectedModel) {
        return this.selectedModel.propertyCount || 0
      }
      return 0
    },

    /**
     * Get the model's display name
     */
    modelDisplayName: function() {
      return propOr('Unknown', 'displayName', this.selectedModel)
      // return this.selectedModel.displayName || 'Files'
    },

    selectedModelId: function () {
      return propOr('', 'id', this.selectedModel)
    },

    // /**
    //  * Compute search models to limit to the current model
    //  * @returns {Array}
    //  */
    // searchModels: function() {
    //   return [
    //     {
    //       label: this.model.displayName,
    //       value: this.model.name
    //     }
    //   ]
    // },

    /**
     * Compute if the records are sortable
     * This is depending on if the records are under
     * a certain count
     * @returns {Boolean}
     */
    isSortable: function() {
      return this.selectedModel.count < MAX_SORTABLE_RECORD_COUNT
    }
  },

  watch: {
    selectedModel: {
      handler: function(models) {
        this.executeSearch()
      },
      immediate: true
    },
    models : {
      handler: function() {
        if (this.$route.params.conceptId){
          const m = (this.models || []).find(c => c.id === this.$route.params.conceptId) || {}
          this.setSelectedModel(m.name)
        } else if (this.models && this.models.length >0 ) {
          let selModel = this.models[0]
          for (let i = 0; i < this.models.length; i++) {
            if (this.models[i].count > selModel.count) {
              selModel = this.models[i]
            }
          }
          this.setSelectedModel(selModel.name)
        }
      }
    }
  },



  methods: {
    ...mapActions('metadataModule', [
      'fetchModels',
      'clearRecords',
      'clearFilters',
      'removeFilter',
      'fetchModelProps',
      'setSelectedModel'
    ]),


    // /**
    //  * Toggle models list visibility and scroll list to the top
    //  */
    // toggleModelsList: function() {
    //   this.modelsListVisible = !this.modelsListVisible
    //
    //   // Scroll list to the top
    //   if (this.modelsListVisible) {
    //     this.$refs.modelsList.scrollTop = 0
    //     this.resetModelsList = true
    //   }
    // },


    clickModel: function(ev) {
      this.setSelectedModel(ev.name)
    },
    /**
     * Add filter
     */
    addFilter: function(shouldFocus = false) {
      const ds = this.getDataset()

      const datasetId = pathOr('', ['content', 'id'], ds)
      const datasetIntId = pathOr('', ['content', 'intId'], ds)
      const datasetName = pathOr('', ['content', 'name'], ds)

      const newFilter = {
        id: uuidv1(),
        type: 'model',
        target: this.selectedModel.name,
        targetLabel: this.selectedModel.displayName,
        property: '',
        propertyLabel: '',
        propertyType: '',
        operation: '',
        operationLabel: '',
        operators: [],
        value: '',
        isInvalid: false,
        datasetId,
        datasetName,
        datasetIntId
      }

      this.filterParams.push(newFilter)

      if (shouldFocus) {
        this.$nextTick(() => {
          this.focusFilter(this.search.filters.length - 1)
        })
      }
    },

    /**
     * Focus on the last filter
     * @param {Number} idx
     */
    focusFilter: function(idx = 0) {
      const filter = this.$refs.filters[idx]

      if (filter) {
        filter.focus()
      }
    },

    /**
     * Delete filter
     * @params {Number} idx
     */
    deleteFilter: function(idx) {
      let f = this.filterParams[idx]
      this.removeFilter(f.id)
      this.filterParams.splice(idx, 1)
    },

    /**
     * Navigate to records details route
     * @param {Object} record
     */
    navigateToRecord: function(record) {
      const recordId = propOr('', 'recordId', record)
      const datasetId = propOr('', 'datasetId', record)
      const modelId = propOr('', 'modelId', record)

      this.$router.push({
        name: 'metadata-record',
        params: {
          instanceId: recordId,
          conceptId: modelId,
          datasetId: datasetId
        }
      })
    },

    /**
     * Resets table search params for pagination
     */
    resetSearchParams: function() {
      this.tableSearchParams = Object.assign({}, searchParams)

      // this.$nextTick(() => {
      //   if(this.search.filters.length) {
      //     this.$refs.searchResults.fetchRecords()
      //   } else {
      //     this.$refs.searchResults.fetchRecordsV1()
      //   }
      // })
    },

    /**
     * Execute search based on search criteria
     */
    executeSearch: function() {
      const isSearchInvalid = this.validateSearch()

      if (isSearchInvalid) {
        return
      }

      this.tableSearchParams = Object.assign({}, searchParams)

    },

    /**
     * Download search results as a CSV
     * Invoke the method on the searchResults components
     */
    downloadRecordCsv: function() {
      this.$refs.searchResults.downloadRecordCsv()
    },

    onInputValue: debounce(function(ev) {
      this.executeSearch()
    }, 500),

    setSort: function(sortOpts) {
      // Update the sorting data
      this.tableSearchParams = {
        ...this.tableSearchParams,
        ...sortOpts
      }

      // // Fetch results using new sorting params
      // this.$nextTick(() => {
      //   if(this.search.filters.length) {
      //     this.$refs.searchResults.fetchRecords()
      //   } else {
      //     this.$refs.searchResults.fetchRecordsV1()
      //   }
      // })
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../../../assets/_variables.scss';


.explore-wrapper {
  display: flex;
  flex-direction: row;
}

.search-results {
  width: 100%;

}
.records-explore {
  display: flex;
  flex-direction: column;

  .results {
    display: flex;
    flex: 1;
    flex-direction: column;
    width: calc(100% - 250px);
  }



}

.section-heading {
  margin-bottom: 8px;
  color: $purple_3;
  font-size: larger;
}

.models-list-wrap {
  background: #fff;
  //box-shadow: -3px 1px 11px 0 rgba(0,0,0,0.21);
  //height: calc(100vh - 130px);
  overflow: hidden;
  //position: absolute;
  right: 0;
  //top: 0px;
  transform: translate3d(100%, 0, 0);
  transition: transform .3s ease-out;
  width: 250px;
  will-change: transform;
  z-index: 3;
  &.visible {
    transform: translate3d(0, 0, 0);
  }
}
.search-model {
  .stat-block {
    color: white;
    text-align: center;
    .stat {
      font-size: 16px;
      font-weight: 600;
      line-height: 22px;
      margin: 0;
    }
    .label {
      font-size: 12px;
    }
  }
}

.search-model {
  background: #fff;
}

h3 {
  margin: 0 0 16px;
}

h2 {
  font-size:20px;
  font-weight: 600;
  line-height: 24px;
  margin: 0 0 16px;
}

p {
  margin: 0 0 16px;
}

.no-results {
  img {
    height: 120px;
  }
}

.file-meta-data-info {
  border: 1px solid $gray_2;
  margin-left: 16px;
  border-radius: 4px;
  flex: 0 0 260px;
  max-width: 260px;
  overflow-wrap: anywhere;
}

.header {
  height: 38px;
  font-size: 16px;
  background-color: $gray_1;
  border-bottom: 1px solid $gray_2;
  line-height: 38px;
  padding-left: 16px;
  color: $gray_4;
}

.model-name-heading {
  color: $purple_3;
  margin: 0 0 0 16px;
  text-transform: capitalize;
  font-size: 18px;
  align-items: center;
  display: flex;
}



.models-list-scroll {
  height: 100%;
  overflow: hidden;
}

.add-filter-wrapper {
  display: flex;
  align-items: center;
}

.btn-toggle-models-list {
  align-items: center;
  background: #fff;
  //box-shadow: -3px 1px 11px 0 rgba(0, 0, 0, 0.21);
  display: flex;
  height: 32px;
  //left: -33px;
  justify-content: center;
  //position: absolute;
  top: 20px;
  width: 33px;

  &:after {
    background: white;
    content: '';
    height: 100%;
    pointer-events: none;
    //position: absolute;
    top: 0;
    right: -5px;
    width: 5px;
  }
}




.stage-wrapper {
  display: flex;
  flex-direction: row;

  .results {
    flex: 1;
    min-width: 0;
    //margin-right: 16px;
    display: flex;
    flex-direction: column;
  }
}

.records-table .model-title {
  //color: $purple_1;
  text-decoration: none;
  &:hover, &:focus {
    outline: none;
    text-decoration: underline;
  }
}
</style>
