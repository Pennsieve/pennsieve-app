<template>
  <bf-page>
    <bf-rafter slot="heading" class="primary" :org-id="orgId">
      <template #breadcrumb>
        <org-breadcrumb page-name="Analysis" :crumbs="breadcrumbCrumbs" :page-route="{ name: 'notebooks' }" />
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
import { runPageIsNotebook } from "@/components/Analysis/RunMonitor/notebookHelpers";

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
    // Whether the run on a run page is a notebook's (Notebooks tab) rather than
    // a workflow's, from the runs already loaded.
    runIsNotebook() {
      return runPageIsNotebook(this.$route, this.$store.getters["analysisModule/workflowInstances"]);
    },
    // A run's page sits under no tab's path: it lights up Notebooks for a
    // notebook's run, else Workflows (as do configuring a run and a new
    // workflow).
    tabs() {
      const runPage = (route) => route.name === "run-detail";
      return [
        { name: "Notebooks", to: "notebooks", activeWhen: (route) => runPage(route) && this.runIsNotebook },
        {
          name: "Workflows",
          to: "workflows",
          activeWhen: (route) =>
            (runPage(route) && !this.runIsNotebook) || ["run-configure", "workflow-create"].includes(route.name),
        },
        { name: "Gallery", to: "gallery" },
        { name: "Compute Nodes", to: "compute-nodes" },
      ];
    },
    breadcrumbCrumbs() {
      const routeName = this.$route.name;

      // Top-level tabs: just one crumb (the tab name, as current)
      const topLevelTabs = {
        'notebooks': 'Notebooks',
        'workflows': 'Workflows',
        'gallery': 'Gallery',
        'compute-nodes': 'Compute Nodes',
      };
      if (topLevelTabs[routeName]) {
        return [{ name: topLevelTabs[routeName] }];
      }

      // Sub-pages: parent tab as link + detail name as current
      const subPages = {
        // A notebook's run belongs to Notebooks, any other to Workflows' Live.
        'run-detail': this.runIsNotebook
          ? { parent: 'Notebooks', parentRoute: { name: 'notebooks' } }
          : { parent: 'Workflows', parentRoute: { name: 'workflows' } },
        'run-configure': { parent: 'Workflows', parentRoute: { name: 'workflows' } },
        'workflow-detail': { parent: 'Gallery', parentRoute: { name: 'gallery' } },
        'workflow-create': { parent: 'Workflows', parentRoute: { name: 'workflows', query: { view: 'builder' } } },
        'application-detail': { parent: 'Gallery', parentRoute: { name: 'gallery', query: { view: 'apps' } } },
        'application-manifest-guide': { parent: 'Gallery', parentRoute: { name: 'gallery', query: { view: 'apps' } } },
        'application-manifest-builder': { parent: 'Gallery', parentRoute: { name: 'gallery', query: { view: 'apps' } } },
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
          'application-manifest-guide': 'Manifest Guide',
          'application-manifest-builder': 'Create Manifest',
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
    const p2 = this.fetchComputeNodes({ force: true });
    const p3 = this.fetchApplications();

    return Promise.all([p1, p2, p3]);
  },

  watch: {
    // When the active org changes while Analysis is mounted (e.g. user
    // switches orgs from a menu without leaving the page), refetch
    // org-scoped data. clearState resets analysisModule.applicationsLoaded
    // before this fires, so the action's built-in short-circuit will not skip.
    "$store.state.activeOrganization.organization.id"(newId, oldId) {
      if (newId && newId !== oldId) {
        this.fetchApplications();
        this.fetchComputeNodes({ force: true });
      }
    },
  },

  methods: {
    ...mapActions("integrationsModule", ["fetchIntegrations"]),
    ...mapActions("analysisModule", ["fetchComputeNodes", "fetchApplications"]),
  },

  data() {
    return {
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
}
</style>
