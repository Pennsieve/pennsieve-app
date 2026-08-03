<template>
  <bf-page>
    <template #heading>
      <bf-rafter class="primary">
        <template #breadcrumb>
          <org-breadcrumb page-name="Publishing" :sub-page-name="currentTabName" :page-route="{ name: 'review' }" />
        </template>
      </bf-rafter>
      <div
        v-if="canReviewPublishing"
        class="content-tabs"
      >
        <router-tabs :tabs="tabs" />
      </div>
    </template>

    <template #stage>
      <router-view
        v-if="canReviewPublishing"
        name="stage"
      />

      <bf-empty-page-state v-else-if="!isLoadingPublishers">
        <div class="publishers-only-illustration">
          <IconLockFilled :width="40" :height="40" color="currentColor" />
        </div>
        <h2 class="publishers-only-heading">Available to the Publishers team</h2>
        <p class="publishers-only-copy">
          Reviewing datasets and proposals submitted to this workspace is
          limited to members of the Publishers team. A workspace administrator
          can add you to it.
        </p>
        <p class="publishers-only-copy">
          To request publication of a dataset, or to follow a request you have
          already made, open that dataset and go to its
          <strong>Publishing</strong> tab.
        </p>
        <p class="publishers-only-copy">
          Proposals you have submitted to open repositories are under
          <router-link :to="{ name: 'dataset-proposals' }">
            My Workspace &rsaquo; Data Publishing
          </router-link>.
        </p>
      </bf-empty-page-state>
    </template>
  </bf-page>
</template>

<script>
import { mapActions, mapGetters, mapState } from "vuex";

import BfPage from "../../components/layout/BfPage/BfPage.vue";
import BfStage from "../../components/layout/BfStage/BfStage.vue";
import BfEmptyPageState from "../../components/shared/bf-empty-page-state/BfEmptyPageState.vue";
import IconLockFilled from "../../components/icons/IconLockFilled.vue";
import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import BfButton from "../../components/shared/bf-button/BfButton.vue";
import OrgBreadcrumb from "../../components/shared/OrgBreadcrumb/OrgBreadcrumb.vue";

import EventBus from "../../utils/event-bus";
import { PublicationStatus, PublicationTabs } from "../../utils/constants.js";
import Request from "../../mixins/request";
import RouterTabs from "../../components/shared/routerTabs/routerTabs.vue";

export default {
  name: "PublishingView",

  components: {
    RouterTabs,
    BfButton,
    BfPage,
    BfStage,
    BfRafter,
    BfEmptyPageState,
    IconLockFilled,
    OrgBreadcrumb,
  },

  mixins: [Request],

  computed: {
    ...mapGetters(["isUserPublisher", "publisherTeam", "hasFeature"]),

    ...mapGetters("publishingModule", ["getTotalCount"]),

    ...mapState(["config", "activeOrganization", "primaryNavOpen", "publishersLoading"]),

    /**
     * Reviewing datasets and proposals submitted to the workspace is a
     * Publishers-team function, and publishing-service enforces it server-side.
     * Members request publication from a dataset's own Publishing tab, and
     * track proposals from My Workspace > Data Publishing.
     */
    canReviewPublishing: function () {
      return this.isUserPublisher;
    },

    /**
     * Publisher membership arrives with the workspace's primary data, so hold
     * the gate until it has resolved rather than flashing the empty state at
     * an actual publisher.
     */
    isLoadingPublishers: function () {
      return this.publishersLoading;
    },

    currentTabName() {
      const routeToTab = {
        'review': 'Review',
        'rejected': 'Rejected',
        'published': 'Published',
        'proposed': 'Proposed',
      };
      return routeToTab[this.$route.name] || '';
    },

    ...mapState("publishingModule", ["totalCounts"]),

    tabs: function () {
      return [
        {
          name: "Ready for Review ",
          to: PublicationTabs.REVIEW,
        },
        {
          name:
            "Published (" + this.getTotalCount(PublicationTabs.PUBLISHED) + ")",
          to: PublicationTabs.PUBLISHED,
        },
        {
          name:
            "Rejected (" + this.getTotalCount(PublicationTabs.REJECTED) + ")",
          to: PublicationTabs.REJECTED,
        },
        {
          name:
            "Proposed (" + this.getTotalCount(PublicationTabs.PROPOSED) + ")",
          to: PublicationTabs.PROPOSED,
        },
      ];
    },

    /**
     * Compute publishing tab based on user's publisher role
     * @returns {Array}
     */
    tabs2: function () {
      return [
        {
          route: {
            name: PublicationTabs.REVIEW,
          },
          label: this.isUserPublisher ? "Ready for Review" : "Pending Review",
          type: PublicationTabs.REVIEW,
        },
        {
          route: {
            name: PublicationTabs.PUBLISHED,
          },
          label: "Published",
          type: PublicationTabs.PUBLISHED,
        },
        {
          route: {
            name: PublicationTabs.REJECTED,
          },
          label: "Rejected",
          type: PublicationTabs.REJECTED,
        },
        {
          route: {
            name: PublicationTabs.PROPOSED,
          },
          label: "Proposed",
          type: PublicationTabs.PROPOSED,
        },
      ];
    },
  },

  mounted: function () {
    if (this.canReviewPublishing) {
      this.getPublishingData();
    }
    if (this.$route.params.datasetSettingsPage) {
      this.togglePrimaryNav(true);
    }
  },

  watch: {
    // Publisher membership can land after this view mounts, on a hard refresh
    // straight onto /publishing or on a workspace switch.
    canReviewPublishing: function (canReview) {
      if (canReview) {
        this.getPublishingData();
      }
    },
  },

  beforeRouteEnter(to, from, next) {
    next((vm) => {
      if (vm.hasFeature("sandbox_org_feature")) {
        vm.$router.push({ name: "create-org" });
      }
    });
  },

  methods: {
    ...mapActions("publishingModule", [
      "updateDatasetTotalCount",
      "getDatasetCount",
      "getDatasetProposalCount",
    ]),
    ...mapActions(["togglePrimaryNav"]),

    /**
     * On submit dataset, notify user
     * @param {Object} dataset
     */
    onSubmitDataset: function ({ dataset }) {
      const datasetName = dataset.content ? dataset.content.name : "";

      EventBus.$emit("toast", {
        detail: {
          type: "success",
          msg: `${datasetName} has been submitted for publishing.`,
        },
      });

      // Update total count of datasets
      const count = this.getTotalCount(PublicationStatus.REQUESTED) + 1;
      this.updateDatasetTotalCount({
        type: PublicationStatus.REQUESTED,
        count,
      });

      // Update pending review or ready for review list
      if (this.$route.name === PublicationStatus.REQUESTED) {
        this.$refs.datasetList.fetchDatasets();
      }
    },

    /**
     * Get publishing data and set the total counts
     */
    getPublishingData: function () {
      this.getDatasetCount(PublicationTabs.REVIEW);

      this.getDatasetCount(PublicationTabs.PUBLISHED);

      this.getDatasetCount(PublicationTabs.REJECTED);

      this.getDatasetProposalCount(PublicationTabs.PROPOSED);
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../styles/theme";

.content-tabs {
  background: white;
  border-bottom: 1px solid theme.$gray_2;
  padding: 0 32px;
}

.publishers-only-illustration {
  align-items: center;
  background: theme.$purple_tint;
  border-radius: 50%;
  color: theme.$purple_2;
  display: flex;
  height: 80px;
  justify-content: center;
  margin-bottom: 24px;
  width: 80px;
}

.publishers-only-heading {
  color: theme.$gray_6;
  font-size: 20px;
  font-weight: 500;
  margin: 0 0 8px;
}

.publishers-only-copy {
  margin: 0 0 8px;
  max-width: 480px;
}
</style>
