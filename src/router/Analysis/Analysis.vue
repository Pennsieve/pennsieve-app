<template>
  <bf-page>
    <bf-rafter slot="heading" class="primary" :org-id="orgId">
      <template #breadcrumb>
        <org-breadcrumb page-name="Analysis" :crumbs="breadcrumbCrumbs" :page-route="{ name: 'runs' }" />
      </template>
    </bf-rafter>
    <div class="content-tabs">
      <router-tabs :tabs="tabs" />
    </div>
    <router-view name="stage" :integrations="integrations" />
  </bf-page>
</template>

<script>
import { mapActions, mapState } from "vuex";
import BfPage from "../../components/layout/BfPage/BfPage.vue";
import BfStage from "../../components/layout/BfStage/BfStage.vue";
import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import RouterTabs from "../../components/shared/routerTabs/routerTabs.vue";
import OrgBreadcrumb from "../../components/shared/OrgBreadcrumb/OrgBreadcrumb.vue";
import { useComputeResourcesStore } from "@/stores/computeResourcesStore";
import { useGetToken } from "@/composables/useGetToken";
import EventBus from "@/utils/event-bus";

export default {
  name: "IntegrationView",
  components: {
    RouterTabs,
    BfPage,
    BfStage,
    BfRafter,
    OrgBreadcrumb,
  },
  computed: {
    ...mapState("integrationsModule", ["integrations"]),
    selectedWorkflow() {
      return this.$store.getters["analysisModule/selectedWorkflow"] || {};
    },
    applicationName() {
      const uuid = this.$route.params.uuid;
      if (!uuid) return '';
      const apps = this.$store.getters["analysisModule/applications"] || [];
      const app = apps.find(a => a.uuid === uuid);
      return app?.name || '';
    },
    computeNodeName() {
      const nodeId = this.$route.params.nodeId;
      if (!nodeId) return '';
      const computeResourcesStore = useComputeResourcesStore();
      const scope = this.orgId ? `workspace:${this.orgId}` : 'account-owner';
      const nodes = computeResourcesStore.getScopedComputeNodes(scope) || [];
      const node = nodes.find(n => n.uuid === nodeId);
      return node?.name || '';
    },
    breadcrumbCrumbs() {
      const routeName = this.$route.name;

      // Top-level tabs: just one crumb (the tab name, as current)
      const topLevelTabs = {
        'runs': 'Runs',
        'workflows': 'Workflows',
        'applications': 'Applications',
        'compute-nodes': 'Compute Nodes',
      };
      if (topLevelTabs[routeName]) {
        return [{ name: topLevelTabs[routeName] }];
      }

      // Sub-pages: parent tab as link + detail name as current
      const subPages = {
        'run-detail': { parent: 'Runs', parentRoute: { name: 'runs' } },
        'run-configure': { parent: 'Runs', parentRoute: { name: 'runs' } },
        'workflow-detail': { parent: 'Workflows', parentRoute: { name: 'workflows' } },
        'workflow-create': { parent: 'Workflows', parentRoute: { name: 'workflows' } },
        'application-detail': { parent: 'Applications', parentRoute: { name: 'applications' } },
        'compute-node-management': { parent: 'Compute Nodes', parentRoute: { name: 'compute-nodes' } },
      };
      const sub = subPages[routeName];
      if (sub) {
        const detailNames = {
          'run-detail': 'Run Details',
          'run-configure': 'Configure Run',
          'workflow-detail': this.selectedWorkflow?.name || 'Workflow',
          'workflow-create': 'New Workflow',
          'application-detail': this.applicationName || 'Application',
          'compute-node-management': this.computeNodeName || 'Compute Node',
        };
        return [
          { name: sub.parent, route: sub.parentRoute },
          { name: detailNames[routeName] },
        ];
      }

      return [];
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
    const p1 = this.fetchIntegrations();
    const p2 = this.fetchComputeNodes();
    const p3 = this.fetchApplications();

    return Promise.all([p1, p2, p3]);
  },

  methods: {
    ...mapActions("integrationsModule", ["fetchIntegrations"]),
    ...mapActions("analysisModule", ["fetchComputeNodes", "fetchApplications"]),
  },

  data() {
    return {
      tabs: [
        {
          name: "Runs",
          to: "runs",
        },
        {
          name: "Workflows",
          to: "workflows",
        },
        {
          name: "Applications",
          to: "applications",
        },
        {
          name: "Compute Nodes",
          to: "compute-nodes",
        },
      ],
    };
  },
};
</script>

<style scoped lang="scss">
@use "../../styles/theme";

.content-tabs {
  background: white;
  border-bottom: 1px solid theme.$gray_2;
  padding: 0 32px;
  margin-bottom: 8px;
}
</style>
