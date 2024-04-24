<template>
  <bf-page>
    <bf-rafter
      slot="heading"
      title="Integrations"
      class="primary"
      :org-id="orgId"
    >
      <template #description>
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
            Compute Nodes are compute resources that are available to your
            organization for data analysis.
          </p>
          <p v-if="this.$route.name === 'accounts'">
            Compute Resource Accounts that are available to your organization.
          </p>
        </div>
      </template>
      <template #tabs>
        <router-tabs :tabs="tabs" />
      </template>
    </bf-rafter>
    <router-view name="stage" :integrations="integrations" />
  </bf-page>
</template>

<script>
import { mapState } from "vuex";
import BfPage from "../../components/layout/BfPage/BfPage.vue";
import BfStage from "../../components/layout/BfStage/BfStage.vue";
import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import RouterTabs from "../../components/shared/routerTabs/routerTabs.vue";

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
  data() {
    return {
      tabs: [
        {
          name: "Applications",
          to: "applications",
        },
        {
          name: "Webhooks",
          to: "webhooks",
        },
        {
          name: "Compute Nodes",
          to: "compute-nodes",
        },
        {
          name: "Accounts",
          to: "accounts",
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
