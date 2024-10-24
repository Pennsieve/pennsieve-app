<template>
  <bf-page>
    <template #heading>
      <bf-rafter
        title="Publishing"
        class="primary"
      >
        <template #description>
          <p>
            Here, you can see all your pending and published datasets. Published datasets are publicly available through the Pennsieve platform and associated project portals.
          </p>
        </template>

        <template #tabs>
          <router-tabs :tabs="tabs" />


<!--          <ul-->
<!--            slot="tabs"-->
<!--            class="tabs unstyled"-->
<!--          >-->
<!--            <li-->
<!--              v-for="tab in tabs"-->
<!--              :key="tab.route.name"-->
<!--            >-->
<!--              <router-link :to="tab.route">-->
<!--                {{ tab.label }} ({{ this.getTotalCount(tab.type) }})-->
<!--              </router-link>-->
<!--            </li>-->
<!--          </ul>-->
        </template>


      </bf-rafter>
    </template>

    <template #stage>
      <router-view name="stage"/>
    </template>

  </bf-page>
</template>

<script>
import {
  mapActions,
  mapGetters,
  mapState
} from 'vuex'

import BfPage from '../../components/layout/BfPage/BfPage.vue'
import BfStage from '../../components/layout/BfStage/BfStage.vue'
import BfRafter from '../../components/shared/bf-rafter/BfRafter.vue'
import BfButton from '../../components/shared/bf-button/BfButton.vue'

import EventBus from '../../utils/event-bus'
import { PublicationStatus, PublicationTabs } from '../../utils/constants.js'
import Request from '../../mixins/request'
import RouterTabs from "../../components/shared/routerTabs/routerTabs.vue";

export default {
  name: 'PublishingView',

  components: {
    RouterTabs,
    BfButton,
    BfPage,
    BfStage,
    BfRafter
  },

  mixins: [
    Request
  ],

  computed: {
    ...mapGetters([
      'isUserPublisher',
      'publisherTeam',
      'hasFeature'
    ]),

    ...mapGetters('publishingModule', [
      'getTotalCount'
    ]),

    ...mapState([
      'config', 'activeOrganization', 'primaryNavOpen'
    ]),

    ...mapState('publishingModule', [
      'totalCounts'
    ]),

    tabs: function() {
      return [
        {
          name: this.isUserPublisher ? 'Ready for Review ' : 'Pending Review (' + this.getTotalCount(PublicationTabs.REVIEW) + ')',
          to: PublicationTabs.REVIEW
        },
        {
          name: 'Published (' + this.getTotalCount(PublicationTabs.PUBLISHED) + ')',
          to: PublicationTabs.PUBLISHED
        },
        {
          name: 'Rejected (' + this.getTotalCount(PublicationTabs.REJECTED) + ')',
          to: PublicationTabs.REJECTED,
        },
        {
          name: 'Proposed (' + this.getTotalCount(PublicationTabs.PROPOSED) + ')',
          to: PublicationTabs.PROPOSED,
        }
      ]
    },

    /**
     * Compute publishing tab based on user's publisher role
     * @returns {Array}
     */
    tabs2: function() {
      return [
        {
          route: {
            name: PublicationTabs.REVIEW,
          },
          label: this.isUserPublisher ? 'Ready for Review' : 'Pending Review',
          type: PublicationTabs.REVIEW
        },
        {
          route: {
            name: PublicationTabs.PUBLISHED,
          },
          label: 'Published',
          type: PublicationTabs.PUBLISHED
        },
        {
          route: {
            name: PublicationTabs.REJECTED,
          },
          label: 'Rejected',
          type: PublicationTabs.REJECTED
        },
        {
          route: {
            name: PublicationTabs.PROPOSED,
          },
          label: 'Proposed',
          type: PublicationTabs.PROPOSED
        }
      ]
    },
  },

  mounted: function() {
    this.getPublishingData()
    if (this.$route.params.datasetSettingsPage) {
      this.togglePrimaryNav(true)
    }

  },

  //  beforeRouteEnter(to, from, next) {
  //   next(vm => {
  //    if (vm.hasFeature('sandbox_org_feature')) {
  //     vm.$router.push({name: 'create-org'})
  //   }
  //   })
  // },

  methods: {
    ...mapActions('publishingModule', [
      'updateDatasetTotalCount',
      'getDatasetCount',
      'getDatasetProposalCount'
    ]),
    ...mapActions(['togglePrimaryNav']),

    /**
     * On submit dataset, notify user
     * @param {Object} dataset
     */
    // onSubmitDataset: function({dataset}) {
    //   const datasetName = dataset.content
    //     ? dataset.content.name
    //     : ''
    //
    //   EventBus.$emit('toast', {
    //     detail: {
    //       type: 'success',
    //       msg: `${datasetName} has been submitted for publishing.`
    //     }
    //   })
    //
    //   // Update total count of datasets
    //   const count = this.getTotalCount(PublicationStatus.REQUESTED) + 1
    //   this.updateDatasetTotalCount({
    //     type: PublicationStatus.REQUESTED,
    //     count
    //   })
    //
    //   // Update pending review or ready for review list
    //   if (this.$route.name === PublicationStatus.REQUESTED) {
    //     this.$refs.datasetList.fetchDatasets()
    //   }
    // },

    /**
     * Get publishing data and set the total counts
     */
    getPublishingData: function() {

      this.getDatasetCount(PublicationTabs.REVIEW)

      this.getDatasetCount(PublicationTabs.PUBLISHED)

      this.getDatasetCount(PublicationTabs.REJECTED)

      this.getDatasetProposalCount(PublicationTabs.PROPOSED)

    }
  }
}
</script>