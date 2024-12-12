<template>
  <bf-page>
    <bf-rafter slot="heading" title="Analysis" class="primary" :org-id="orgId">
      <template #description>
        <div class="description">
          <p>
            The pennsieve platform allows users to register applications to
            allow users to expand the functionality of the platform through
            custom actions and webhooks.
          </p>
          <hr />
        </div>
        <div slot="description" class="description">
          <p v-if="this.$route.name === 'applications'">
            Applications support actions on various entities on the platform
            such as "Files", "Records", and "Datasets". Registered applications
            can be triggered from the action-menu associated with the targeted
            entities.
            <a
              href="https://docs.pennsieve.io/docs/introduction-to-integrations"
              target="_blank"
            >
              What's this?
            </a>
          </p>
          <p v-if="this.$route.name === 'webhooks'">
            Webhooks provide mechanisms to notify external applications of
            events that happen on the Pennsieve platform, such as "File
            Uploaded", or "Description updated".
            <a
              href="https://docs.pennsieve.io/docs/preventing-files-from-being-included-during-publishing"
              target="_blank"
            >
              What's this?
            </a>
          </p>
          <p v-if="this.$route.name === 'compute-nodes'">
            Compute Nodes are deployed to run analytic pipelines through the
            Pennsieve platform. You can register compute nodes through the
            Pennsieve Agent. Each Compute Node is associated with an account,
            which can be a cloud-provider or a local cluster.
          </p>
          <p v-if="this.$route.name === 'applications'">
            Applications allow users to run analytic workflows on the platform.
          </p>
          <p v-if="this.$route.name === 'activity'">
            Monitor the activity of your analytic pipeline runs.
          </p>
        </div>
      </template>
      <template #tabs>
        <router-tabs
          :tabs="isFeatureFlagEnabled ? pennsieveAnalysisFeature : tabs"
        />
      </template>
    </bf-rafter>
    <router-view name="stage" :integrations="integrations" />
  </bf-page>
</template>

<script>
import {mapActions, mapState} from "vuex";
import BfPage from "../../components/layout/BfPage/BfPage.vue";
import BfStage from "../../components/layout/BfStage/BfStage.vue";
import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import RouterTabs from "../../components/shared/routerTabs/routerTabs.vue";
import {useGetToken} from "@/composables/useGetToken";
import EventBus from "@/utils/event-bus";
import { pathOr, propOr } from "ramda";
import {
  isEnabledForAllDevOrgs,
  isEnabledForImmuneHealth,
  isEnabledForTestOrgs,
} from "../../utils/feature-flags";

export default {
  name: "IntegrationView",
  components: {
    RouterTabs,
    BfPage,
    BfStage,
    BfRafter,
  },
  computed: {
    ...mapState("integrationsModule", ["integrations"]),
    ...mapState(["activeOrganization", "config"]),
    activeOrganizationId: function () {
      return pathOr(
        "Organization",
        ["organization", "id"],
        this.activeOrganization
      );
    },
    isFeatureFlagEnabled: function () {
      return (
        isEnabledForTestOrgs(this.activeOrganizationId) ||
        isEnabledForImmuneHealth(this.activeOrganizationId) ||
        isEnabledForAllDevOrgs(this.config.apiUrl)
      );
    },
  },
  // From Router
  props: {
    orgId: {
      type: String,
      default: "",
    },
    datasetId: {
      type: String,
      default: "",
    },
  },

  async mounted() {
    const p1 = this.fetchIntegrations()
    const p2 = this.fetchComputeNodes()
    const p3 = this.fetchApplications()

    return Promise.all([p1,p2,p3])
  },

  methods:{
    ...mapActions("integrationsModule", ["fetchIntegrations"]),
    ...mapActions("analysisModule", ["fetchComputeNodes", "fetchApplications"]),

  },

  data() {
    return {
      tabs: [
        {
          name: "Integrations",
          to: "integrations",
        },
        {
          name: "Webhooks",
          to: "webhooks",
        },
      ],
      pennsieveAnalysisFeature: [
        {
          name: "Configuration",
          to: "compute-nodes",
        },
        {
          name: "Applications",
          to: "applications",
        },
        {
          name: "Activity",
          to: "activity",
        },
      ],
    };
  },
};
</script>

<style scoped lang="scss">
@import "../../assets/variables";

.description {
  max-width: 600px;
}
</style>
