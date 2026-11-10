<template>
  <bf-stage slot="stage" no-padding>
    <!-- As Apps, the Workflows Library and Public Datasets: the filters on
         the left (folded until opened), what's listed and the action over
         the search and Sort, the results and their pages. The search,
         filters, sort and pages are the server's (datasetSearchParams). -->
    <FacetLayout
      v-if="!isEmptyOrg"
      class="datasets-facets"
      storage-key="pennsieve.datasets.filtersPanel"
      default-folded
      :chips="filterChips"
      @remove="removeChip"
      @clear-all="clearFilters"
    >
      <template #intro>
        <ContentIntro text="This workspace's datasets: where you store, analyze and share your data.">
          <template #actions>
            <bf-button v-if="!isWorkspaceGuest" @click="openNewDatasetDialog">+ New Dataset</bf-button>
          </template>
        </ContentIntro>
      </template>

      <!-- One choice each: the search takes one status, role and collection -->
      <template #filters>
        <FacetSection v-if="statusOptions.length > 1" title="Status" :clearable="statusFilter !== ANY" @clear="statusFilter = ANY">
          <FacetRadios v-model="statusFilter" :options="statusOptions" label="Status" />
        </FacetSection>
        <FacetSection title="Your role" :clearable="roleFilter !== ANY" @clear="roleFilter = ANY">
          <FacetRadios v-model="roleFilter" :options="ROLE_OPTIONS" label="Your role" />
        </FacetSection>
        <FacetSection v-if="collectionOptions.length > 1" title="Collection" :clearable="collectionFilter !== ANY" @clear="collectionFilter = ANY">
          <FacetRadios v-model="collectionFilter" :options="collectionOptions" label="Collection" />
        </FacetSection>
      </template>

      <template #toolbar>
        <el-input
          v-model="searchQuery"
          class="toolbar-search"
          placeholder="Search datasets…"
          clearable
          @keyup.enter="searchDatasetsByQuery"
          @clear="searchDatasetsByQuery"
        >
          <template #prefix>
            <IconMagnifyingGlass :height="20" :width="20" color="#71747c" />
          </template>
        </el-input>
        <label class="sort-control toolbar-sort">
          Sort
          <el-select v-model="sortChoice" class="sort-select">
            <el-option v-for="o in SORTS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </label>
      </template>

      <!-- The results line, how many a page, and the pages -->
      <div v-if="hasDatasets" class="dataset-list-controls mb-16">
        <p class="results-heading">{{ searchHeading }}</p>
        <div class="dataset-list-controls-menus">
          <pagination-page-menu
            class="mr-24"
            pagination-item-label="Datasets"
            :page-size="datasetSearchParams.limit"
            @update-page-size="updateDatasetSearchLimit"
          />
          <el-pagination
            :page-size="datasetSearchParams.limit"
            :pager-count="5"
            :current-page="curDatasetSearchPage"
            layout="prev, pager, next"
            :total="datasetTotalCount"
            @current-change="onPaginationPageChange"
          />
        </div>
      </div>
      <div
        v-if="hasDatasets && isLoadingDatasetsError === false"
        class="dataset-list-item-wrap"
        v-loading="isLoadingDatasets"
      >
        <bf-dataset-list-item
          v-for="dataset in datasets"
          :key="dataset.content.id"
          :dataset="dataset"
          @show-locked-dialog="dialogLockedVisible = true"
        />
      </div>

      <div
        v-if="hasDatasets && isLoadingDatasetsError === false"
        class="dataset-list-controls mt-16"
      >
        <pagination-page-menu
          class="mr-24"
          pagination-item-label="Datasets"
          :page-size="datasetSearchParams.limit"
          @update-page-size="updateDatasetSearchLimit"
        />

        <el-pagination
          :page-size="datasetSearchParams.limit"
          :pager-count="5"
          :current-page="curDatasetSearchPage"
          layout="prev, pager, next"
          :total="datasetTotalCount"
          @current-change="onPaginationPageChange"
        />
      </div>

      <bf-empty-page-state
        v-if="isNoResultsFound"
        class="no-results-found-wrapper"
      >
        <img
          src="../../../assets/images/illustrations/illo-search.svg"
          height="78"
          width="99"
          alt="No results found"
        />

        <h2>No results found</h2>
        <p>
          No datasets match your search and filters.
        </p>
        <bf-button class="secondary" @click="clearSearchAndFilters">Clear search and filters</bf-button>
      </bf-empty-page-state>
    </FacetLayout>

    <bf-create-new-dataset
      :datasets="datasets"
      :integrations="integrations"
      :dialog-visible="newDatasetDialogOpen"
      @close-dialog="onCloseCreateDialog"
    />

    <bf-empty-page-state v-if="isEmptyOrg && !isWorkspaceGuest">
      <img
        src="../../../assets/images/illustrations/illo-datasets.svg"
        alt="Add datasets illustration"
      />

      <h2 class="bf-empty-state-title">Create a dataset</h2>
      <p>Datasets are where you store, analyze, and share your data.</p>
      <bf-button class="new-dataset-button" @click="openNewDatasetDialog">
        New Dataset
      </bf-button>
    </bf-empty-page-state>

  </bf-stage>
</template>

<script>
import { mapActions, mapGetters, mapState } from "vuex";
import { mergeDeepRight, propOr } from "ramda";
import BfRafter from "../../shared/bf-rafter/BfRafter.vue";
import BfButton from "../../shared/bf-button/BfButton.vue";
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";
import DialogBody from "../../shared/dialog-body/DialogBody.vue";
import BfDialogHeader from "../../shared/bf-dialog-header/BfDialogHeader.vue";
import BfDatasetListItem from "./dataset-list-item/BfDatasetListItem.vue";
import BfCreateNewDataset from "./bf-create-new-dataset/BfCreateNewDataset.vue";
import FacetLayout from "../../Analysis/Facets/FacetLayout.vue";
import FacetSection from "../../Analysis/Facets/FacetSection.vue";
import FacetRadios from "../../Analysis/Facets/FacetRadios.vue";
import ContentIntro from '@/components/shared/ContentIntro/ContentIntro.vue';
import PaginationPageMenu from "../../shared/PaginationPageMenu/PaginationPageMenu.vue";

import Sorter from "../../../mixins/sorter";
import Request from "../../../mixins/request";
import IconArrowRight from "../../icons/IconArrowRight.vue";
import IconMagnifyingGlass from "../../icons/IconMagnifyingGlass.vue";
import { useGetToken } from "@/composables/useGetToken";
import toQueryParams from "@/utils/toQueryParams";

export default {
  name: "BfDatasetList",

  components: {
    IconMagnifyingGlass,
    IconArrowRight,
    BfRafter,
    BfButton,
    BfDatasetListItem,
    BfCreateNewDataset,
    BfEmptyPageState,
    DialogBody,
    BfDialogHeader,
    FacetLayout,
    FacetSection,
    FacetRadios,
    ContentIntro,
    PaginationPageMenu,
  },

  mixins: [Request, Sorter],

  props: {
    orgId: {
      type: String,
      default: "",
    },
  },

  data: function () {
    return {
      newDatasetDialogOpen: false,
      dialogLockedVisible: false,
      sortBy: "content.name",
      sortOptions: [
        {
          label: "Sort by Name",
          value: "content.name",
        },
        {
          label: "Sort by Last Updated",
          value: "content.updatedAt",
        },
      ],
      carouselDialog: "",
      searchQuery: "",
      filterName: "",
      // "Any" in a filter: the search's "" (radios need a value).
      ANY: "any",
      ROLE_OPTIONS: [
        { value: "any", label: "Any" },
        { value: "owner", label: "Owner" },
        { value: "manager", label: "Manager" },
        { value: "editor", label: "Editor" },
        { value: "viewer", label: "Viewer" },
      ],
      // The search's order and direction in one choice (the API's orderBy
      // and orderDirection).
      SORTS: [
        { value: "IntId:Desc", label: "Newest" },
        { value: "IntId:Asc", label: "Oldest" },
        { value: "UpdatedAt:Desc", label: "Recently updated" },
        { value: "Name:Asc", label: "Name A–Z" },
        { value: "Name:Desc", label: "Name Z–A" },
      ],
    };
  },

  computed: {
    ...mapState([
      "isLoadingDatasets",
      "isLoadingDatasetsError",
      "datasetFilters",
      "activeOrganization",
      "datasets",
    ]),

    ...mapState("integrationsModule", ["integrations"]),

    ...mapState(["orgDatasetStatuses"]),

    ...mapState("collectionsModule", ["collections"]),

    ...mapState("datasetModule", ["datasetSearchParams", "datasetTotalCount"]),

    ...mapGetters(["activeOrganization", "config", "teams", "hasFeature"]),

    ...mapGetters("datasetModule", ["curDatasetSearchPage"]),
    filteredDatasets() {
      return this.datasets.filter(
        (dataset) => dataset.content.datasetType !== "release"
      );
    },
    // The filter panel's options: the workspace's statuses (with their
    // colours) and collections, each with Any first.
    statusOptions() {
      const statuses = (this.orgDatasetStatuses || []).filter((st) => st.displayName);
      return [
        { value: this.ANY, label: "Any" },
        ...statuses.map((st) => ({ value: st.name, label: st.displayName, color: st.color })),
      ];
    },
    collectionOptions() {
      return [
        { value: this.ANY, label: "Any" },
        ...(this.collections || []).map((c) => ({ value: String(c.id), label: c.name })),
      ];
    },
    // Each filter reads and sets the search's own parameter ("" for Any),
    // keeping the others.
    statusFilter: {
      get() {
        return this.datasetSearchParams.status || this.ANY;
      },
      set(v) {
        this.setFilters({ status: v });
      },
    },
    roleFilter: {
      get() {
        return this.datasetSearchParams.withRole || this.ANY;
      },
      set(v) {
        this.setFilters({ withRole: v });
      },
    },
    collectionFilter: {
      get() {
        const id = this.datasetSearchParams.collectionId;
        return id === "" || id === null || id === undefined ? this.ANY : String(id);
      },
      set(v) {
        this.setFilters({ collectionId: v });
      },
    },
    sortChoice: {
      get() {
        return `${this.datasetSearchParams.orderBy}:${this.datasetSearchParams.orderDirection}`;
      },
      set(v) {
        const [orderBy, orderDirection] = v.split(":");
        this.updateDatasetSearchOrderBy(orderBy);
        this.updateDatasetSearchOrderDirection(orderDirection);
      },
    },
    // The filters set, as removable chips over the results.
    filterChips() {
      const chips = [];
      const label = (options, value) => options.find((o) => o.value === value)?.label || value;
      if (this.statusFilter !== this.ANY) chips.push({ key: "status", label: label(this.statusOptions, this.statusFilter) });
      if (this.roleFilter !== this.ANY) chips.push({ key: "withRole", label: `Your role: ${label(this.ROLE_OPTIONS, this.roleFilter)}` });
      if (this.collectionFilter !== this.ANY) chips.push({ key: "collectionId", label: label(this.collectionOptions, this.collectionFilter) });
      return chips;
    },

    /**
     * Compute the search heading
     * @returns {String}
     */
    searchHeading: function () {
      const start = this.datasetSearchParams.offset + 1;
      const pageRange =
        this.datasetSearchParams.limit * this.curDatasetSearchPage;
      const end =
        pageRange < this.datasetTotalCount ? pageRange : this.datasetTotalCount;
      const query = this.datasetSearchParams.query;

      let searchHeading = `Displaying ${start}-${end} of ${this.datasetTotalCount} results`;

      return query === "" ? searchHeading : `${searchHeading} for “${query}”`;
    },

    // No datasets at all: none, with no search or filter sent.
    isEmptyOrg: function () {
      return (
        !this.isLoadingDatasets &&
        this.isLoadingDatasetsError === false &&
        this.datasets.length === 0 &&
        !this.datasetSearchParams.query &&
        this.filterChips.length === 0
      );
    },

    // Nothing for the search or the filters (not an empty workspace).
    isNoResultsFound: function () {
      return (
        !this.isLoadingDatasets &&
        (this.datasets.length === 0 || this.isLoadingDatasetsError === true) &&
        (!!this.datasetSearchParams.query || this.filterChips.length > 0)
      );
    },

    datasetUrl: function() {
      const params = toQueryParams(this.datasetSearchParams);
      return `${this.config.apiUrl}/datasets/paginated?${params}&includeBannerUrl=true`;
    },

    /**
     * Computes if datasets exist
     * @returns {Boolean}
     */
    hasDatasets: function () {
      return this.datasets.length > 0;
    },

    /**
     * Compute page heading
     */
    pageHeading: function () {
      return "Datasets";
    },

    isWorkspaceGuest: function () {
      return propOr(false, "isGuest", this.activeOrganization);
    },
  },

  watch: {
    hasDatasets: {
      handler: function (bool) {
        if (bool) {
          this.isLoading = false;
        }
      },
      immediate: true,
    },
    activeOrganization: {
      handler: function () {
        // Clear search query keywords on org switch
        this.searchQuery = "";
        this.fetchDatasets();
      },
    },
    datasetUrl:{
      handler: function () {
        this.fetchDatasets();
      }
    }
  },

  /**
   * Save dataset filter state
   * @params {Object} to
   * @params {Object} from
   * @params {Function} next
   */
  beforeRouteLeave(to, from, next) {
    if (this.datasetFilters.filterName === "") {
      const datasetFilters = {
        filterName: this.filterName,
        filterOwner: this.filterOwner,
        filterType: this.filterType,
        sortBy: this.sortBy,
        sortDirection: this.sortDirection,
      };

      this.setDatasetFilters(datasetFilters);
    }
    next();
  },

  mounted: function () {
    // Set the local search query to match vuex
    this.searchQuery = this.datasetSearchParams.query;
    const { filterOwner, filterType, sortBy, sortDirection } =
      this.datasetFilters;

    this.filterOwner = filterOwner;
    this.filterType = filterType;
    this.sortBy = sortBy;
    this.sortDirection = sortDirection;

    this.fetchDatasets();
  },

  methods: {
    ...mapActions([
      "setDatasetFilters",
      "setIsLoadingDatasets",
      "setIsLoadingDatasetsError",
      "setDatasets",
    ]),
    ...mapActions("datasetModule", [
      "updateDatasetSearchOrderDirection",
      "updateDatasetSearchLimit",
      "updateDatasetSearchQuery",
      "updateDatasetSearchOnlyMyDatasets",
      "updateDatasetSearchStatus",
      "updateDatasetSearchWithRole",
      "updateDatasetSearchWithCollection",
      "updateDatasetSearchOrderBy",
      "updateDatasetSearchFilters",
      "updateDatasetOffset",
      "updateDatasetTotalCount",
    ]),

    getDatasetsUrl: async function () {
      return useGetToken().then((t) => {
        const params = toQueryParams(
          mergeDeepRight(this.datasetSearchParams, { api_key: t })
        );
        return `${this.config.apiUrl}/datasets/paginated?${params}&includeBannerUrl=true`;
      });
    },

    fetchDatasets: async function () {
      return this.setIsLoadingDatasets(true)
        .then(async () => {
          return this.getDatasetsUrl()
            .then((url) => {
              return this.sendXhr(url, {});
            })
            .then((response) => {
              this.setIsLoadingDatasetsError(false);
              return this.setDatasetData(response);
            });
        })
        .catch((err) => {
          console.log(err);
          this.setDatasetData([]);
          this.setIsLoadingDatasetsError(true);
        })
        .finally(() => this.setIsLoadingDatasets(false));
    },

    /**
     * Set dataset data
     * @param {Object} response
     */
    setDatasetData: function (response) {
      const datasets = propOr([], "datasets", response);
      const datasetTotal = propOr(0, "totalCount", response);
      return this.setDatasets(datasets).then(() => {
        return this.updateDatasetTotalCount(datasetTotal);
      });
    },

    onCloseCreateDialog: function () {
      this.newDatasetDialogOpen = false;
    },

    searchDatasetsByQuery: function () {
      this.updateDatasetSearchQuery(this.searchQuery);
    },

    /**
     * Update offset
     */
    onPaginationPageChange: function (page) {
      const offset = (page - 1) * this.datasetSearchParams.limit;
      this.updateDatasetOffset(offset);
      this.fetchDatasets();
    },

    /**
     * Open New Dataset Dialog
     */
    openNewDatasetDialog: function () {
      this.newDatasetDialogOpen = true;
    },

    /**
     * Set the filter panel's filters (status, role, collection; "any" for
     * Any) together, keeping the ones not given; back to the first page.
     * @param {Object} changes
     */
    setFilters: function (changes) {
      const current = {
        status: this.statusFilter,
        withRole: this.roleFilter,
        collectionId: this.collectionFilter,
      };
      const next = { ...current, ...changes };
      const param = (v) => (v === this.ANY ? "" : v);
      this.updateDatasetSearchFilters({
        status: param(next.status),
        withRole: param(next.withRole),
        collectionId: param(next.collectionId),
      });
    },

    removeChip: function (chip) {
      this.setFilters({ [chip.key]: this.ANY });
    },

    clearFilters: function () {
      this.setFilters({ status: this.ANY, withRole: this.ANY, collectionId: this.ANY });
    },

    clearSearchAndFilters: function () {
      this.searchQuery = "";
      this.searchDatasetsByQuery();
      this.clearFilters();
    },
  },
};
</script>

<style scoped lang="scss">
@use '../../../styles/theme';
@use  '../../../styles/element/pagination';
@use '../../../styles/element/dialog';

.no-results-found-wrapper {
  img {
    height: 99px;
    width: 99px;
  }
}
.new-dataset-button {
  margin: 13px 0;
  height: 40px;
  width: 137px;
}

.bf-empty-state-title {
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  line-height: 16px;
}
/* The filter layout fills the stage, and grows with a long list (not held
   to the stage's height) so the filters stay beside it as the page scrolls. */
.datasets-facets {
  flex: 1 0 auto;
}
/* The search fills the toolbar's row up to Sort, as on Apps. */
.toolbar-search {
  flex: 1;
  min-width: 0;
}
.sort-control {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: theme.$gray_5;
}
.sort-select {
  width: 170px;
}
.results-heading {
  margin: 0;
  font-size: 13px;
  color: theme.$gray_5;
}
/* The page size and pages as quiet as the results line: 13px grey, the
   current page navy (not the pager's orange), as the rest of the page. */
.dataset-list-controls {
  :deep(.dataset-filter-dropdown),
  :deep(.el-dropdown-text-link) {
    font-size: 13px;
    color: theme.$gray_5;
  }
  :deep(.el-pagination) {
    --el-pagination-font-size: 13px;
    --el-pagination-text-color: #{theme.$gray_5};
    --el-pagination-button-color: #{theme.$gray_5};
    --el-pagination-hover-color: #{theme.$purple_3};
  }
  :deep(.el-pager li.is-active) {
    color: theme.$purple_3;
    font-weight: 600;
  }
}
.dataset-list-controls {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
.dataset-list-controls-menus {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  .el-dropdown {
    flex-shrink: 0;
  }
}
</style>
