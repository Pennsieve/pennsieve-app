<template>
  <bf-page>
    <bf-rafter slot="heading" class="primary analysis-header" :org-id="orgId">
      <template #breadcrumb>
        <org-breadcrumb page-name="Analysis" :crumbs="breadcrumbCrumbs" :page-route="{ name: 'workflows' }" actions trail-title />
      </template>
    </bf-rafter>
    <!-- The section's views as the page's tabs (AnalysisViewBar); the
         sections themselves are in the secondary nav
         (AnalysisNavigationSecondary), its actions in its content. Without
         views (most sections), no row: only the rule under the title. -->
    <div ref="tabsRow" class="tab-header">
      <div class="views-row">
        <div id="analysis-tab-views" class="tab-views" />
      </div>
    </div>
    <div ref="stageMarker" class="stage-marker" />
    <router-view name="stage" :integrations="integrations" />
  </bf-page>
</template>

<script>
import { mapActions, mapState } from "vuex";
import BfPage from "../../components/layout/BfPage/BfPage.vue";
import BfStage from "../../components/layout/BfStage/BfStage.vue";
import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import OrgBreadcrumb from "../../components/shared/OrgBreadcrumb/OrgBreadcrumb.vue";
import { applicationPageTitle } from "../../components/Analysis/Applications/appCards";
import { useComputeResourcesStore } from "@/stores/computeResourcesStore";
import { useGetToken } from "@/composables/useGetToken";
import EventBus from "@/utils/event-bus";
import { runPageIsNotebook } from "@/components/Analysis/RunMonitor/notebookHelpers";
import { provide, ref } from "vue";
import { useAnalysisStageTop } from "@/composables/useAnalysisStageTop";

export default {
  name: "IntegrationView",
  components: {
    BfPage,
    BfStage,
    BfRafter,
    OrgBreadcrumb,
  },
  setup() {
    const stageMarker = ref(null);
    const tabsRow = ref(null);
    useAnalysisStageTop(stageMarker, [tabsRow]);
    // Its views are the page's tabs (AnalysisViewBar).
    provide("analysisLayout", "sections");
    return { stageMarker, tabsRow };
  },
  computed: {
    ...mapState("integrationsModule", ["integrations"]),
    selectedWorkflow() {
      return this.$store.getters["analysisModule/selectedWorkflow"] || {};
    },
    applicationName() {
      return applicationPageTitle(this.$route.params.uuid, this.$store.getters);
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
    breadcrumbCrumbs() {
      const routeName = this.$route.name;

      // The Builder (Workflows, ?view=builder): a new workflow under Workflows.
      if (routeName === 'workflows' && this.$route.query.view === 'builder') {
        return [{ name: 'Workflows', route: { name: 'workflows' } }, { name: 'New Workflow' }];
      }

      // A section: the trail ends at it (the secondary nav says it too).
      const sections = {
        'runs': 'Runs',
        'notebooks': 'Notebooks',
        'environments': 'Environments',
        'workflows': 'Workflows',
        'apps': 'Apps',
        'compute-nodes': 'Compute Nodes',
      };
      if (sections[routeName]) {
        return [{ name: sections[routeName] }];
      }

      // Sub-pages: parent tab as link + detail name as current
      const subPages = {
        // A notebook's run belongs to Notebooks, any other to Runs.
        'run-detail': this.runIsNotebook
          ? { parent: 'Notebooks', parentRoute: { name: 'notebooks' } }
          : { parent: 'Runs', parentRoute: { name: 'runs' } },
        'run-configure': { parent: 'Runs', parentRoute: { name: 'runs' } },
        'workflow-detail': { parent: 'Workflows', parentRoute: { name: 'workflows' } },
        'workflow-create': { parent: 'Workflows', parentRoute: { name: 'workflows' } },
        'application-detail': { parent: 'Apps', parentRoute: { name: 'apps' } },
        'application-manifest-guide': { parent: 'Apps', parentRoute: { name: 'apps' } },
        'application-manifest-builder': { parent: 'Apps', parentRoute: { name: 'apps' } },
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

/* The title and the tabs read as one header: one rule, under the tabs.
   (The class thrice: over the rafter's own .bf-rafter.compact.primary.) */
.bf-rafter.analysis-header.analysis-header.analysis-header {
  border-bottom: none;
  padding-bottom: 4px;
}
/* The views row: the page's tabs (a detail page's, as a compute node's),
   their underline on the one rule under the header. */
.tab-header {
  box-sizing: border-box;
  padding: 0 32px;
  background: white;
  border-bottom: 1px solid theme.$gray_2;
}
.views-row {
  display: flex;
  height: 40px;
  min-width: 0;
}
/* No views (most sections): no row, only the rule under the title. */
.views-row:has(> .tab-views:empty) {
  display: none;
}
.tab-views {
  display: flex;
  align-items: stretch;
  min-width: 0;
}
.stage-marker {
  height: 0;
}
/* A phone: the views scroll rather than the page. */
@media (max-width: 767px) {
  .tab-header {
    padding: 0 16px;
  }
  .views-row {
    overflow-x: auto;
  }
}
</style>
