<script setup lang="ts">
import {ref, computed} from "vue";
import {useGetToken} from "../../../../composables/useGetToken";
import {useHandleXhrError, useSendXhr} from "../../../../mixins/request/request_composable";
import PaginationPageMenu from "../../../shared/PaginationPageMenu/PaginationPageMenu.vue";
import {defaultTo, find, head, path, propEq, propOr} from "ramda";
import {useSanitize} from "../../../../composables/useSanitize";
import BfEmptyPageState from "../../../shared/bf-empty-page-state/BfEmptyPageState.vue";
import BfButton from "../../../shared/bf-button/BfButton.vue";
import {useRoute} from "vue-router";
import * as site from '../../../../site-config/site.json';
import {useStore} from "vuex";

interface EntityMetaData {
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
interface Model extends EntityMetaData {
  id: string;
  count: number;
  locked: boolean;
  name: string;
  displayName: string;
  description: string;
  propertyCount: number;
  templateId: string | null;
}
type ValueSingleType = string | number | boolean
type ValueArrayType = string[] | number[] | boolean[]
type ValueType = null | ValueSingleType | ValueArrayType
interface PropertyInstance {
  conceptTitle: boolean;
  dataType: any; // @todo bring back data-type.ts model
  default: boolean;
  displayName: string;
  locked: boolean;
  name: string;
  required: boolean;
  value: ValueType
}
interface ModelRecord extends EntityMetaData {
  id: string;
  type: string;
  values: PropertyInstance[]
}
interface ModelRecordsRoute {
  readonly params: {
    readonly datasetId?: string;
    readonly conceptId?: string;
  }
}
interface ModelRecordsComponentInstance {
  config: { conceptsUrl: string };
  datasetId: string;
  conceptId: string;
  userToken: string | undefined;
  isFilesProxy: boolean;
  concepts: Model[];
  concept: Partial<Model>;
  modelRecordsUrl: string | undefined;
  limit: number;
  offset: number;
  sortDirection: 'asc' | 'desc';
  sortBy: string;
  prefixField: (input: string, encode: boolean) => string;
  resultsLoading: boolean;
  searchResults: ModelRecord[];
  totalResults: number;
  sendXhr: <T>(url: string, opts: object) => Promise<T>;
  logger: (...args: any) => void;
  fetchRecords: () => void;
}

const store = useStore()

const route = useRoute()

const emit = defineEmits(['select-all','select-individual'])

const datasetId = computed(() => {
  return route?.params.datasetId ?? ''
})

const modelRecordsUrl = computed(() => {
  if (!datasetId || !conceptId) {
    return ''
  }
  return `${
    site.conceptsUrl
  }/datasets/${
    datasetId
  }/concepts/${
    conceptId
  }/instances?limit=${
    limit.value
  }&offset=${
    offset.value
  }&orderBy=${
    sortBy.value
  }&ascending=${
    sortDirection.value === 'asc'
  }`
})

const searchResults = ref([])
const formattedResults = ref([])


/**
 * execute the fetch of records from the concept instances endpoint
 */
async function fetchRecords(): Promise<void> {

  if (!modelRecordsUrl.value) return Promise.resolve()

  resultsLoading.value = true
  searchResults.value = []


  try {
    useGetToken()
      .then(async token => {
        console.log(token)


        searchResults.value = await useSendXhr(modelRecordsUrl.value, {
          header: {
            'Authorization': `bearer ${token}`
          },
          method: 'GET',
          body: []
        })
      })
      .catch(useHandleXhrError)
      .finally(() => resultsLoading.value = false)



  } catch (err) {
    resultsLoading.value = false
    console.log(err)
    // instance.logger(['Error', err.statusText ?? err], 'error')
  }

}

/**
 * callback for when the page number is changed
 */

const props = defineProps({
  concept: {
    type: Object,
    default: () => {}
  },
  defaultLimit: {
    type: Number,
    default: 50
  },
  hasRadioSelection: {
    type: Boolean,
    default: false
  },
  radioSelection: {
    type: String,
    default: ''
  },
  hasMultiSelect: {
    type: Boolean,
    default: false
  },
  selectedItemIds: {
    type: Set,
    default: () => new Set()
  }
})

const offset = ref(0)
const limit = ref(50)
const sortBy = ref('createdAt')
const sortDirection = ref('desc')
const resultsLoading = ref(false)
const localRadioSelection = ref([])
const sortedHeadings = ref([])

const recordCount = computed(() => {
  return props.concept?.count ?? 0
})

const conceptId = computed(() => {
  return props.concept?.id
})


function displayValue(property) {
  const dataType = propOr('String', 'dataType', property)
  const propertyValue = propOr('', 'value', property)
  const val = dataType === 'String' ?
    useSanitize(propertyValue) :
    propertyValue
  return Array.isArray(val) ? val.join(', ') : val
}

function multiSelectIsSelected(scope, selectedItemIds) {
  return selectedItemIds.has(scope.row.recordId)
}

function onPaginationPageChange(page) {
  offset.value = (page - 1) * limit.value
  fetchRecords()
}

function onUpdateLimit(limit) {
  offset.value = 0;
  limit.value = limit;
  fetchRecords();
}

function onUpdateSort(value) {
  if (sortBy.value === value) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = sortBy.value || 'createdAt'
  }
  offset.value = 0
  fetchRecords()
}

function onSelectAll(items) {
  emit('select-all', items)
}

function onSelectIndividual(value, item) {
  emit('select-individual', value, item)
}

function getProperty(displayName) {
  const firstRow = defaultTo({}, head(this.searchResults))
  if (path(['content', 'name'], firstRow)) {
    return this.getFileName(displayName)
  }
  const values = <[]>propOr([], 'values', firstRow)
  if (values.length === 0) {
    return displayName
  }
  const propertyObj = find(propEq('displayName', displayName), values)
  const value = propOr('', 'name', propertyObj)
  if (displayName === 'Date Created') return 'createdAt'
  if (value){
    return value
  }
}

function getPermission(value) {
  return store.getters.getPermission(value)
}

const conceptName = computed(() => {
  return props.concept?.name ?? ''
})

const propertyCount = computed(() => {
  return props.concept?.propertyCount ?? 0
})

const datasetLocked = computed(() => {
  return store.getters.datasetLocked
})

</script>

<template>
  <div class="concept-search-results">
    <div class="results-table">
      <div class="record-pagination">
        <div>
          <pagination-page-menu
            class="mr-24"
            pagination-item-label="Results"
            :page-size="limit"
            @update-page-size="onUpdateLimit"
          />
<!--          <button-->
<!--            class="dataset-filter-dropdown el-dropdown-link"-->
<!--            @click="downloadRecordCsv"-->
<!--          >-->
<!--            <span class="el-dropdown-text-link">-->
<!--              Download Results-->
<!--            </span>-->
<!--            <IconDirectDownload-->
<!--              class="ml-8 download-icon"-->
<!--              :height="20"-->
<!--              :width="20"-->
<!--            />-->
<!--          </button>-->
        </div>

        <el-pagination
          :page-size="limit"
          :pager-count="5"
          :current-page="offset / limit + 1"
          layout="prev, pager, next"
          :total="recordCount"
          @current-change="onPaginationPageChange"
        />
      </div>
      <el-table
        v-if="!(recordCount === 0 && !resultsLoading)"
        ref="table"
        :empty-text="resultsLoading ? 'Loading...' : 'No Data'"
        :data="formattedResults"
        width="100%"
        :border="true"
        @bf-sort="onUpdateSort"
        @select-all="onSelectAll"
      >
        <el-table-column
          v-if="hasMultiSelect"
          width="36"
          type="selection"
          :fixed="true"
        >
          <template #default="scope">
            <el-checkbox
              :value="multiSelectIsSelected(scope, selectedItemIds)"
              @change="value => onSelectIndividual(value, scope.row)"
            />
          </template>
        </el-table-column>
        <el-table-column
          v-if="hasRadioSelection"
          width="36"
          :fixed="true"
        >
          <template #default="scope">
            <el-radio
              v-model="localRadioSelection"
              class="radio-selection"
              :label="scope.row.recordId"
            />
          </template>
        </el-table-column>
        <el-table-column
          v-for="(heading, index) in sortedHeadings"
          :key="heading"
          :item="heading"
          :prop="getProperty(heading)"
          :label="heading"
          :fixed="index === 0"
          min-width="200"
          :resizable="true"
        >
          <template #default="scope">
            <template v-if="index === 0 && !scope.row[heading].value && scope.row[heading].value !== 0 && !hasRadioSelection && !hasMultiSelect">
              <router-link
                v-if="getPermission('editor')"
                :to="{
                  name: 'metadata-record',
                  query: {
                    name: heading
                  },
                  params: {
                    conceptId,
                    instanceId: scope.row.recordId
                  }
                }"
              >
                Add a Value
              </router-link>
              <router-link
                v-else
                :to="{
                  name: 'metadata-record',
                  params: {
                    instanceId: scope.row.recordId
                  }
                }"
              >
                Untitled Record
              </router-link>
            </template>
            <router-link
              v-if="index === 0 && !hasRadioSelection && !hasMultiSelect"
              :to="{name: 'metadata-record', params: { conceptId: $route.params.conceptId, instanceId: scope.row.recordId }}"
              v-html="displayValue(scope.row[heading])"
            />
            <span
              v-if="index > 0 || hasRadioSelection || hasMultiSelect"
              v-html="displayValue(scope.row[heading])"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <bf-empty-page-state
      v-if="recordCount === 0 && !resultsLoading"
      class="no-results"
    >
      <img
        src="../../../../../src/assets/images/illustrations/illo-search.svg"
        alt=""
      >
      <h3>There are no Records for {{ conceptName }}.</h3>
      <p v-if="propertyCount === 0">
        Before you can create a record, you'll need to add some properties to this model.
      </p>
      <router-link
        v-if="propertyCount > 0"
        :to="{
          name: 'metadata-record',
          params: {
            conceptId: conceptId,
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
      <router-link
        v-else
        :to="{
          name: 'models',
          params: {
            conceptId: conceptId
          },
          query: {
            open: 1
          }
        }"
      >
        <bf-button
          v-if="getPermission('editor')"
          class="no-results-button"
        >
          Add Properties
        </bf-button>
      </router-link>
    </bf-empty-page-state>

    <bf-empty-page-state
      v-if="searchResults.length === 0 && recordCount !== 0 && !resultsLoading"
      class="no-results"
    >
      <img
        src="../../../../../src/assets/images/illustrations/illo-search.svg"
        alt=""
      >
      <h3>No Results found.</h3>
      <p>
        Try removing some filters or <router-link
          :to="{ name: 'records' }"
          class=""
        >
          browse
        </router-link> a different concept.
      </p>
    </bf-empty-page-state>

    <template>
      <div
        v-loading="resultsLoading"
        class="is-loading"
        element-loading-background="transparent"
      />
    </template>
  </div>
</template>

<!--<script>-->
<!--import {mapGetters} from 'vuex'-->
<!--import TableFunctions from '../../../../mixins/table-functions'-->
<!--import FormatDate from '../../../../mixins/format-date'-->
<!--import {defaultTo, find, head, path, propEq, propOr} from 'ramda'-->

<!--import Logger from '@/mixins/logger'-->
<!--import Request from '@/mixins/request'-->
<!--import EncodeInternalFields from '@/mixins/encode-internal-fields'-->

<!--import BfEmptyPageState from '../../../shared/bf-empty-page-state/BfEmptyPageState.vue'-->
<!--import BfButton from '../../../shared/bf-button/BfButton.vue'-->

<!--import EventBus from '../../../../utils/event-bus.js'-->
<!--import PaginationPageMenu from "../../../shared/PaginationPageMenu/PaginationPageMenu.vue";-->
<!--import IconDirectDownload from "../../../icons/IconDirectDownload.vue";-->
<!--// import {Computed} from "@/typescript/lib/model-records/computed";-->
<!--// import {Methods} from "@/typescript/lib/model-records/methods";-->

<!--export default {-->
<!--  name: 'ModelRecordsResults',-->

<!--  components: {-->
<!--    IconDirectDownload,-->
<!--    BfEmptyPageState,-->
<!--    BfButton,-->
<!--    PaginationPageMenu-->
<!--  },-->

<!--  mixins: [-->
<!--    TableFunctions,-->
<!--    FormatDate,-->
<!--    Logger,-->
<!--    Request,-->
<!--    EncodeInternalFields-->
<!--  ],-->

<!--  props: {-->
<!--    concept: {-->
<!--      type: Object,-->
<!--      default: () => {}-->
<!--    },-->
<!--    defaultLimit: {-->
<!--      type: Number,-->
<!--      default: 50-->
<!--    },-->
<!--    hasRadioSelection: {-->
<!--      type: Boolean,-->
<!--      default: false-->
<!--    },-->
<!--    radioSelection: {-->
<!--      type: String,-->
<!--      default: ''-->
<!--    },-->
<!--    hasMultiSelect: {-->
<!--      type: Boolean,-->
<!--      default: false-->
<!--    },-->
<!--    selectedItemIds: {-->
<!--      type: Set,-->
<!--      default: () => new Set()-->
<!--    }-->
<!--  },-->

<!--  data() {-->
<!--    return {-->
<!--      resultsLoading: true,-->
<!--      displaySearchError: false,-->
<!--      searchResults: [],-->
<!--      formattedResults: [],-->
<!--      sortedHeadings: [],-->
<!--      proxyModel: {-->
<!--        id: '',-->
<!--        name: 'Files'-->
<!--      },-->
<!--      offset: 0,-->
<!--      limit: this.defaultLimit,-->
<!--      sortBy: 'createdAt',-->
<!--      sortDirection: 'desc',-->
<!--      headings: [],-->
<!--      localRadioSelection: ''-->
<!--    }-->
<!--  },-->

<!--  computed: {-->
<!--    ...mapGetters([-->
<!--      'getPermission',-->
<!--      'dataset',-->
<!--      'config',-->
<!--      'filesProxyId',-->
<!--      'hasFeature',-->
<!--      'datasetLocked'-->
<!--    ]),-->

<!--    datasetId: function() {-->
<!--      return Computed.datasetId(this.$route)-->
<!--    },-->

<!--    conceptId: function() {-->
<!--      return Computed.conceptId(this.concept)-->
<!--    },-->

<!--    /**-->
<!--     * Returns the concept name-->
<!--     * @returns {String}-->
<!--     */-->
<!--    conceptName: function() {-->
<!--      return Computed.conceptName(this.concept)-->
<!--    },-->

<!--    /**-->
<!--     * Returns the number of records in that concept-->
<!--     * @returns {Number}-->
<!--     */-->
<!--    recordCount: function() {-->
<!--      return Computed.recordCount(this.concept)-->
<!--    },-->

<!--    propertyCount: function() {-->
<!--      return Computed.propertyCount(this.concept)-->
<!--    },-->

<!--    nonSortableColumns: function() {-->
<!--      return Computed.nonSortableColumns(this.searchResults)-->
<!--    },-->

<!--    modelRecordsUrl: function() {-->
<!--      return Computed.modelRecordsUrl(this)-->
<!--    },-->
<!--  },-->

<!--  watch: {-->

<!--    searchResults: function(searchResults) {-->
<!--      if (!searchResults) {-->
<!--        return-->
<!--      }-->


<!--      this.formattedResults = this.formatSearchResults(searchResults)-->
<!--      this.sortedHeadings = this.getHeadings(searchResults, ['dataType', 'createdAt'])-->
<!--      this.$emit('search-results-changed', searchResults)-->
<!--    },-->

<!--    /**-->
<!--     * initialize and re-fetch records when concept changes-->
<!--     */-->
<!--    concept: {-->
<!--      handler: function() {-->
<!--        this.offset = 0;-->
<!--        this.limit = this.defaultLimit;-->
<!--        this.fetchRecords()-->
<!--      },-->
<!--      immediate: true,-->
<!--    },-->

<!--    radioSelection: {-->
<!--      handler: function(val) {-->
<!--        this.localRadioSelection = val-->
<!--      },-->
<!--      immediate: true-->
<!--    },-->

<!--    localRadioSelection: {-->
<!--      handler: function(val) {-->
<!--        this.$emit('radio-selection', val)-->
<!--      }-->
<!--    },-->

<!--    selectedItemIds: {-->
<!--      /**-->
<!--       * make sure the select all checkbox doesn't get out of sync-->
<!--       * @param items {Set}-->
<!--       */-->
<!--      handler: function(items) {-->
<!--        if (this.$refs.table && items.size === 0) {-->
<!--          this.$refs.table.clearSelection()-->
<!--        }-->
<!--      },-->
<!--      immediate: true-->
<!--    }-->
<!--  },-->

<!--  methods: {-->
<!--    /**-->
<!--     * Executes search query by applying filters-->
<!--     */-->
<!--    fetchRecords: function() {-->
<!--      console.log('trying to fetch records')-->
<!--      Methods.fetchRecords(this)-->
<!--    },-->

<!--    /**-->
<!--     * Gets file name key given a displayName-->
<!--     * @param {String} displayName-->
<!--     * @returns {String}-->
<!--     */-->
<!--    getFileName: function(displayName) {-->
<!--      switch (displayName) {-->
<!--        case 'Date Created':-->
<!--          return 'createdAt'-->
<!--        case 'Size':-->
<!--          return 'storage'-->
<!--        case 'Kind':-->
<!--          return 'type'-->
<!--        default:-->
<!--          return 'name'-->
<!--      }-->
<!--    },-->

<!--    /**-->
<!--     * Gets the property name for the displayName-->
<!--     * @param {String} displayName-->
<!--     */-->
<!--    getProperty: function(displayName) {-->
<!--      const firstRow = defaultTo({}, head(this.searchResults))-->
<!--      if (path(['content', 'name'], firstRow)) {-->
<!--        return this.getFileName(displayName)-->
<!--      }-->
<!--      const values = propOr([], 'values', firstRow)-->
<!--      if (values.length === 0) {-->
<!--        return displayName-->
<!--      }-->
<!--      const propertyObj = find(propEq('displayName', displayName), values)-->
<!--      const value = propOr('', 'name', propertyObj)-->
<!--      if (displayName === 'Date Created') return 'createdAt'-->
<!--      if (value){-->
<!--        return value-->
<!--      }-->
<!--    },-->

<!--    downloadRecordCsv: function() {-->
<!--      EventBus.$emit('trigger-record-csv-download', { model: this.conceptName, datasets: [this.dataset.content.intId], filters: []})-->
<!--    },-->

<!--    multiSelectIsSelected: function(scope, selectedItemIds) {-->
<!--      return selectedItemIds.has(scope.row.recordId)-->
<!--    },-->

<!--    onPaginationPageChange: function(page) {-->
<!--      Methods.onPaginationPageChange(this, page)-->
<!--    },-->

<!--    onUpdateLimit: function(limit) {-->
<!--      Methods.onUpdateLimit(this, limit)-->
<!--    },-->

<!--    onUpdateSort: function(sortBy) {-->
<!--      Methods.onUpdateSort(this, sortBy)-->
<!--    },-->

<!--    onSelectAll: function(items) {-->
<!--      this.$emit('select-all', items)-->
<!--    },-->

<!--    onSelectIndividual: function(value, item) {-->
<!--      this.$emit('select-individual', value, item)-->
<!--    },-->

<!--  }-->
<!--}-->
<!--</script>-->

<style lang="scss">
@import '../../../../assets/variables';

.concept-search-results {

  .is-loading {
    padding: 8px 0;
  }

  .heading {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin-bottom: 8px;

    h2 {
      font-size:20px;
      font-weight: 600;
      line-height: 24px;
      margin: 0;
      padding-right: 16px;
    }
  }

  .results-count {
    color: $gray_4;
    margin-right: 32px;
  }

  .no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    h3 {
      margin: 20px 0 0;
      text-align: center;
      font-size: 16px;
      font-weight: 600;
      line-height: 16px;
      color: #000000;
    }

    p {
      color: $gray_4;
      font-size: 14px;
      line-height: 16px;
      margin: 6px 0;
      max-width: 576px;
      text-align: center;
    }

    img {
      height: 78px;
      width: 99px;
    }
  }

  .no-results-button{
    margin-top: 8px;
    height: 40px;
    width: 179px;
  }

  .el-table--border td {
    border-right: 1px solid transparent;
  }
}

.download-icon {
  margin-top: -4px;
}

.record-pagination {
  margin-bottom: 14px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;

  .el-dropdown-text-link:not(:hover, :active) {
    color: $gray_6;
  }
}

.radio-selection {
  .el-radio__label {
    display: none !important;
  }
}
</style>
