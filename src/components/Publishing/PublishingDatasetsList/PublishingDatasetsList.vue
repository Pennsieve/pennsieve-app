<template>
  <bf-stage element-loading-background="transparent">
    <template #actions>
      <div class="actions-wrapper">
        <form
          class="mb-8 dataset-search-form"
          @submit.prevent="searchDatasetsByQuery"
        >
          <el-input
            ref="input"
            v-model="searchQuery"
            class="dataset-search-input icon-prefix"
            placeholder="Find Datasets"
            @keyup.enter.native="searchDatasetsByQuery"
          >
            <template #prefix>
              <IconMagnifyingGlass
                slot="prefix"
                :height="24"
                :width="24"
                color="#71747c"
              />
            </template>
          </el-input>
        </form>

        <div class="button-wrapper">
          <bf-button class="primary" @click="$router.push(publisherTeamRoute)">
            {{
              activeOrganization.isAdmin
                ? "Manage Publishers"
                : "View Publishers"
            }}
          </bf-button>
        </div>
      </div>
    </template>

    <div>
      <p v-if="hasDatasets" class="mb-24">
        {{ searchHeading }}
      </p>

      <div class="dataset-list-controls mb-16">
        <div class="dataset-list-controls-menus">
          <pagination-page-menu
            class="mr-24"
            pagination-item-label="Datasets"
            :page-size="publishingSearchParams.limit"
            @update-page-size="onPageLimitChange"
          />

          <dataset-sort-menu
            class="mr-24"
            :order-by="publishingSearchParams.orderBy"
            @select="onDatasetSortSelect"
          />

          <button class="button-icon small icon-sort" @click="setSortDir">
            <IconSort
              :class="[sortIconDirection === 'down' ? 'svg-flip' : '']"
              color="currentColor"
              :dir="sortIconDirection"
              :height="20"
              :width="20"
            />
          </button>
        </div>

        <el-pagination
          :page-size="publishingSearchParams.limit"
          :pager-count="5"
          :current-page="curPage"
          layout="prev, pager, next"
          :total="publishingSearchParams.totalCount"
          @current-change="onPaginationPageChange"
        />
      </div>
      <div v-loading="isLoadingDatasets" element-loading-background="#FBFBFD">
        <div
          v-if="hasDatasets && isLoadingDatasetsError === false"
          class="dataset-list-item-wrap"
        >
          <published-dataset-list-item
            v-for="dataset in datasets"
            :key="generateKey(dataset)"
            :dataset="dataset"
            @publish-dataset="publishDataset"
          />
        </div>
        <bf-empty-page-state v-if="!hasDatasets">
          No datasets found
        </bf-empty-page-state>
      </div>
    </div>
  </bf-stage>
</template>

<script>
import { mapActions, mapGetters, mapState } from "vuex";
import { pathOr } from "ramda";

import PublishedDatasetListItem from "../PublishedDatasetListItem/PublishedDatasetListItem.vue";
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";
import DatasetSortMenu from "../../datasets/DatasetSortMenu/DatasetSortMenu.vue";
import PaginationPageMenu from "../../shared/PaginationPageMenu/PaginationPageMenu.vue";

import Request from "../../../mixins/request/index";
import DatasetPublishedData from "../../../mixins/dataset-published-data";

import toQueryParams from "../../../utils/toQueryParams.js";
import { PublicationStatus } from "../../../utils/constants";
import IconMagnifyingGlass from "../../icons/IconMagnifyingGlass.vue";
import IconSort from "../../icons/IconSort.vue";
import { useGetToken } from "@/composables/useGetToken";
import {
  useHandleXhrError,
  useSendXhr,
} from "@/mixins/request/request_composable";

export default {
  name: "PublishingDatasetsList",

  components: {
    IconSort,
    IconMagnifyingGlass,
    BfEmptyPageState,
    DatasetSortMenu,
    PaginationPageMenu,
    PublishedDatasetListItem,
  },

  mixins: [DatasetPublishedData, Request],

  props: {
    publicationStatus: {
      type: Array,
      default: () => {
        return ["requested"];
      },
    },
  },

  data() {
    return {
      isLoadingDatasetsError: false,
      searchQuery: "",
    };
  },

  watch: {
    $route: function () {
      this.clearSearchParams().then(() => {
        this.fetchDatasets();
      });
    },
  },

  computed: {
    ...mapGetters(["publisherTeam"]),
    ...mapState(["config", "activeOrganization"]),

    ...mapState("publishingModule", [
      "publishingSearchParams",
      "isLoadingDatasets",
    ]),

    ...mapGetters("publishingModule", ["getTotalCount", "getDatasets"]),

    publisherTeamRoute: function () {
      if (!this.$route.params || !this.publisherTeam) return "";
      return `/${this.$route.params.orgId}/teams/${this.publisherTeam.id}`;
    },

    /**
     * Compute publishing statuses
     * This is to account for the ready for review/pending review tab
     * which is a combination of REQUESTED, ACCEPTED, and FAILED
     * @returns {String}
     */
    includedPublicationStatuses: function () {
      const [head, ...tail] = this.publicationStatus;
      return this.publicationStatus.includes(PublicationStatus.REQUESTED)
        ? PublicationStatus.REQUESTED
        : head;
    },

    /**
     * Compute the datasets by the includedPublicationStatuses
     * @returns {Array}
     */
    datasets: function () {
      return this.getDatasets(this.$route.name);
    },

    /**
     * Compute endpoint URL to get datasets
     * @return {String}
     */
    getDatasetsUrl: function () {
      useGetToken().then((token) => {
        const queryParams = toQueryParams({
          publicationStatus: this.publicationStatus,
          publicationType: this.publicationType,
          api_key: token,
          includeBannerUrl: true,
          includePublishStatus: true,
          ...this.datasetSearchParams,
        });

        return `${this.config.apiUrl}/datasets/paginated?${queryParams}`;
      });
    },

    hasDatasets: function () {
      return this.datasets.length > 0;
    },

    /**
     * Compute current page
     * @returns {Number}
     */
    curPage: function () {
      return (
        this.publishingSearchParams.offset / this.publishingSearchParams.limit +
        1
      );
    },

    /**
     * Compute dataset icon sort direction
     * @returns {String}
     */
    sortIconDirection: function () {
      return this.publishingSearchParams.orderDirection === "Asc"
        ? "up"
        : "down";
    },

    /**
     * Compute the search heading
     * @returns {String}
     */
    searchHeading: function () {
      const start = this.publishingSearchParams.offset + 1;
      const pageRange = this.publishingSearchParams.limit * this.curPage;
      const end =
        pageRange < this.publishingSearchParams.totalCount
          ? pageRange
          : this.publishingSearchParams.totalCount;
      const query = this.publishingSearchParams.query;

      let searchHeading = `Displaying ${start}-${end} of ${this.publishingSearchParams.totalCount} results`;

      return query === "" ? searchHeading : `${searchHeading} for “${query}”`;
    },
  },

  // beforeRouteEnter: function(to, from, next) {
  //   next(vm => {
  //     vm.getInitialData()
  //     next()
  //   })
  // },

  mounted() {
    this.clearSearchParams().then(() => {
      this.fetchDatasets();
    });
  },

  methods: {
    ...mapActions("publishingModule", [
      "updateDatasets",
      "updatePublishingTotalCount",
      "updatePublishingSearchOrderDirection",
      "updatePublishingSearchLimit",
      "updatePublishingSearchQuery",
      "updatePublishingSearchOrderBy",
      "updatePublishingOffset",
      "fetchDatasets",
      "clearSearchParams",
    ]),

    /**
     * Publish dataset
     * @param {String} id
     */
    publishDataset: function (id) {
      useGetToken()
        .then((token) => {
          return useSendXhr(
            `${this.config.apiUrl}/datasets/${id}/publication/accept?api_key=${token}&publicationType=publication`,
            {
              method: "POST",
            }
          );
        })
        .catch(useHandleXhrError);
    },

    /**
     * Set sort direction
     */
    setSortDir: function () {
      const orderDirection =
        this.publishingSearchParams.orderDirection === "Asc" ? "Desc" : "Asc";

      this.updatePublishingSearchOrderDirection(orderDirection);
    },

    /**
     * Update offset
     * @param {Number} page
     */
    onPaginationPageChange: function (page) {
      const offset = (page - 1) * this.publishingSearchParams.limit;
      this.updatePublishingOffset(offset);
    },

    /**
     * Update dataset sort
     * @param {Object} selection
     */
    onDatasetSortSelect: function (selection) {
      this.updatePublishingSearchOrderBy(selection.value);
    },

    /**
     * Update search query and execute the search
     */
    searchDatasetsByQuery: function () {
      this.updatePublishingSearchQuery(this.searchQuery);
    },

    /**
     * Update the page limit
     * @param {Number} pageSize
     */
    onPageLimitChange: function (pageSize) {
      this.updatePublishingSearchLimit(pageSize);
    },

    /**
     * Account for different dataset object shapes
     * in the published tabs (content object
     * may not be available if the user does not
     * have permissions to the dataset)
     * @returns {String}
     */
    generateKey: function (dataset) {
      const datasetId =
        pathOr("", ["content", "intId"], dataset) || dataset.sourceDatasetId;
      return datasetId;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../assets/_variables.scss";

.actions-wrapper {
  display: flex;
  flex: 1;
  flex-direction: row;
  justify-content: space-between;

  .button-wrapper {
    align-self: flex-start;
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
.dataset-search-form {
  max-width: 400px;
  width: 100%;
}
</style>
