<template>
  <!-- Analysis's sections, as a dataset's (BfNavigationSecondary), in two
       groups with their status (runs going, notebooks open, a node that
       needs a look), and what's running now. The page's tabs are each
       section's views. Open, it condenses the primary rail; its handle
       collapses both. -->
  <div
    class="bf-navigation secondary"
    :class="[secondaryNavCondensed ? 'condensed' : '']"
    :style="secondaryNavCondensed ? { backgroundImage: condensedBackgroundStyle } : {}"
  >
    <div class="menu-wrap">
      <div
        class="heading-wrap"
        :style="{ backgroundColor: condensedHeaderColor }"
      >
        <IconAnalysis
          v-if="secondaryNavCondensed"
          color="#ffffff"
          :height="20"
          :width="20"
        />
        <span v-else class="heading">Analysis</span>
      </div>

      <template v-for="group in groups" :key="group.label">
        <hr />
        <div v-if="!secondaryNavCondensed" class="group-label">{{ group.label }}</div>
        <bf-navigation-item
          v-for="section in group.sections"
          :key="section.name"
          :link="{ name: routeName(section.to) }"
          :label="section.name"
          :active="section.active"
          :condensed="secondaryNavCondensed"
          :secondary="true"
          :org-id="orgId"
        >
          <template #icon>
            <span class="icon-with-marker">
              <component :is="section.icon" color="currentColor" :height="20" :width="20" />
              <!-- Condensed, a section's status is a dot on its icon. -->
              <span
                v-if="secondaryNavCondensed && section.badge"
                class="marker"
                :class="section.badge.tone"
              />
            </span>
          </template>
          <template v-if="!secondaryNavCondensed && section.badge" #suffix>
            <span class="badge" :class="section.badge.tone" :title="section.badge.title">
              {{ section.badge.text }}
            </span>
          </template>
        </bf-navigation-item>
      </template>

      <!-- What's running: each run and open notebook, a link to its page.
           Runs have no section of their own; this is where they live in
           the nav. Hidden when nothing runs, and on the condensed rail. -->
      <template v-if="!secondaryNavCondensed && running.length">
        <hr />
        <div class="group-label">Running now</div>
        <ul class="running">
          <li v-for="run in running.slice(0, maxRunning)" :key="run.uuid">
            <router-link
              class="running-item"
              :class="{ active: $route.params.runId === run.uuid }"
              :to="{ name: routeName('run-detail'), params: { runId: run.uuid }, query: { from: run.interactive ? 'notebooks' : 'workflows' } }"
              :title="run.name ? `${runLabel(run)} · ${run.name}` : runLabel(run)"
            >
              <span class="pulse" :class="{ notebook: run.interactive }" />
              <span class="running-name">{{ runLabel(run) }}</span>
              <span class="running-kind">{{ run.interactive ? "Notebook" : statusLabel(run.status) }}</span>
            </router-link>
          </li>
        </ul>
        <router-link
          v-if="running.length > maxRunning"
          class="running-more"
          :to="{ name: routeName('runs') }"
        >
          {{ running.length - maxRunning }} more running
        </router-link>
      </template>
    </div>

    <button
      type="button"
      class="collapse-handle"
      :aria-label="secondaryNavCondensed ? 'Expand secondary navigation' : 'Collapse secondary navigation'"
      :aria-expanded="!secondaryNavCondensed"
      @click="toggleMenu"
    >
      <IconArrowLeft
        class="collapse-chevron"
        :class="{ 'is-flipped': secondaryNavCondensed }"
        :width="6"
        :height="10"
        color="currentColor"
      />
    </button>
    <bf-navigation-tertiary
      v-if="secondaryNavCondensed"
      :bk-color="getThemeColors[1]"
    />
  </div>
</template>

<script>
import { markRaw } from "vue";
import { useComputeResourcesStore } from "@/stores/computeResourcesStore";
import { useGetToken } from "@/composables/useGetToken";
import { RUNNING_STATUSES } from "@/components/Analysis/RunMonitor/runHelpers";
import { mapActions, mapGetters, mapState } from "vuex";
import BfNavigationItem from "./bf-navigation-item/BfNavigationItem.vue";
import BfNavigationTertiary from "../bf-navigation-tertiary/BfNavigationTertiary.vue";
import IconArrowLeft from "../icons/IconArrowLeft.vue";
import IconAnalysis from "../icons/IconAnalysis.vue";
import IconProcedure from "../icons/IconProcedure.vue";
import IconActivity from "../icons/IconActivity.vue";
import IconStorage from "../icons/IconStorage.vue";
import { environmentsServiceUrl } from "@/utils/environmentsService";
import IconNotebook from "../icons/IconNotebook.vue";
import IconApp from "../icons/IconApp.vue";
import IconComputeNode from "../icons/IconComputeNode.vue";
import CustomTheme from "../../mixins/custom-theme";
import { runPageIsNotebook } from "@/components/Analysis/RunMonitor/notebookHelpers";

export default {
  name: "AnalysisNavigationSecondary",
  components: {
    BfNavigationItem,
    BfNavigationTertiary,
    IconArrowLeft,
    IconAnalysis,
  },
  mixins: [CustomTheme],
  props: {
    orgId: {
      type: String,
      default: "",
    },
  },
  setup() {
    return { computeResourcesStore: useComputeResourcesStore() };
  },
  data() {
    return {
      hasEnvironments: !!environmentsServiceUrl(),
      // The workspace's runs still going; polled while Analysis is open.
      running: [],
      maxRunning: 5,
      pollTimer: null,
    };
  },
  computed: {
    ...mapState(["secondaryNavCondensed"]),
    ...mapGetters(["primaryNavOpen"]),
    getThemeColors() {
      return this.getTheme(this.orgId);
    },
    // A run's page sits under no section's path: it belongs to Notebooks for
    // a notebook's run, else Workflows (as do configuring a run, a new
    // workflow and a workflow's page). An app's and a node's pages are under
    // their section's path.
    // My Analysis (in My Workspace) rather than a workspace's: the same
    // sections, its routes prefixed "my-", the user's own runs and nodes.
    mine() {
      return this.$route.matched.some((r) => r.name === "my-analysis");
    },
    runIsNotebook() {
      return runPageIsNotebook(this.$route, this.$store.getters["analysisModule/workflowInstances"]);
    },
    runningWorkflows() {
      return this.running.filter((r) => !r.interactive).length;
    },
    openNotebooks() {
      return this.running.filter((r) => r.interactive).length;
    },
    nodes() {
      const scope = this.mine ? "user-owned" : `workspace:${this.orgId}`;
      return this.computeResourcesStore.getScopedComputeNodes(scope) || [];
    },
    // A node that needs a look: failed (red), or changing (amber).
    nodeBadge() {
      const failed = this.nodes.filter((n) => n.status === "Failed").length;
      if (failed) {
        return { text: "!", tone: "bad", title: `${failed} compute node${failed > 1 ? "s" : ""} failed` };
      }
      const changing = this.nodes.filter((n) => ["Pending", "Updating", "Destroying"].includes(n.status)).length;
      if (changing) {
        return { text: "•", tone: "warn", title: `${changing} compute node${changing > 1 ? "s" : ""} updating` };
      }
      return null;
    },
    // Two groups: what's happening (runs, notebook sessions) and what it's
    // done with (workflows, apps, compute). A run's page sits under no
    // section's path: it belongs to Notebooks for a notebook's run, else Runs
    // (as does configuring a run); a workflow's page and a new one, to
    // Workflows.
    groups() {
      // The route's name without My Analysis's "my-", so one set of rules.
      const name = this.mine ? (this.$route.name || "").replace(/^my-/, "") : this.$route.name;
      const runPage = name === "run-detail";
      const under = (section) => this.$route.matched.some((r) => r.name === this.routeName(section));
      return [
        {
          label: "Run",
          sections: [
            {
              name: "Runs",
              to: "runs",
              icon: markRaw(IconActivity),
              active: under("runs") || (runPage && !this.runIsNotebook) || name === "run-configure",
              badge: this.runningWorkflows
                ? { text: this.runningWorkflows, tone: "live", title: `${this.runningWorkflows} running` }
                : null,
            },
            {
              name: "Notebooks",
              to: "notebooks",
              icon: markRaw(IconNotebook),
              active: under("notebooks") || (runPage && this.runIsNotebook),
              badge: this.openNotebooks
                ? { text: this.openNotebooks, tone: "live", title: `${this.openNotebooks} open` }
                : null,
            },
          ],
        },
        {
          label: "Build & resources",
          sections: [
            {
              name: "Workflows",
              to: "workflows",
              icon: markRaw(IconProcedure),
              active: under("workflows") || ["workflow-create", "workflow-detail"].includes(name),
              badge: null,
            },
            {
              name: "Apps",
              to: "apps",
              icon: markRaw(IconApp),
              active: under("apps") || (name || "").startsWith("application-"),
              badge: null,
            },
            // Only where the site has environments-service
            ...(this.hasEnvironments
              ? [
                  {
                    name: "Environments",
                    to: "environments",
                    icon: markRaw(IconStorage),
                    active: under("environments"),
                    badge: null,
                  },
                ]
              : []),
            {
              name: "Compute Nodes",
              to: "compute-nodes",
              icon: markRaw(IconComputeNode),
              active: under("compute-nodes") || name === "compute-node-management",
              badge: this.nodeBadge,
            },
          ],
        },
      ];
    },
    condensedHeaderColor() {
      if (this.secondaryNavCondensed && this.getThemeColors.length >= 2) {
        return this.pSBC(-0.25, this.getThemeColors[0]) || "";
      }
      return "";
    },
    condensedBackgroundStyle() {
      if (this.getThemeColors.length >= 2) {
        const darkened0 = this.pSBC(-0.25, this.getThemeColors[0]) || this.getThemeColors[0];
        const darkened1 = this.pSBC(-0.25, this.getThemeColors[1]) || this.getThemeColors[1];
        const color1 = this.pSBC(-0.1, darkened0, darkened1, true);
        return `linear-gradient(to top, ${darkened1}, ${color1})`;
      }
      return "";
    },
  },
  watch: {
    // A run started or ended from a page: look again soon.
    "$route.fullPath"() {
      this.fetchRunning();
    },
  },
  mounted() {
    this.toggleSecondaryNav(true);
    this.fetchRunning();
    this.pollTimer = setInterval(this.fetchRunning, 20000);
  },
  beforeUnmount() {
    clearInterval(this.pollTimer);
    // As BfNavigationSecondary: restore the primary rail on the way out.
    this.toggleSecondaryNav(false);
    this.togglePrimaryNav(true);
  },
  methods: {
    ...mapActions(["toggleSecondaryNav", "togglePrimaryNav", "condenseSecondaryNav"]),
    routeName(name) {
      return this.mine ? `my-${name}` : name;
    },
    // The recent runs, those still going kept: its own fetch, so the nav
    // doesn't depend on the run list a page has filtered. A workspace's; in
    // My Analysis, with no organization, the user's outside any workspace.
    async fetchRunning() {
      const api = this.$store.state.config?.api2Url;
      const orgId = this.$store.state.activeOrganization?.organization?.id;
      if (!api || (!orgId && !this.mine)) return;
      const params = new URLSearchParams({ limit: "50" });
      if (!this.mine) params.set("organization_id", orgId);
      try {
        const token = await useGetToken();
        const resp = await fetch(`${api}/compute/workflows/runs?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) return;
        const result = await resp.json();
        const runs = result.runs || result || [];
        this.running = runs
          .filter((r) => RUNNING_STATUSES.includes(r.status))
          .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
      } catch {
        // Best-effort: the nav keeps what it had.
      }
    },
    // What runs, not the run's timestamped id (that's in the tooltip).
    runLabel(run) {
      return run.workflowName || run.name || "Run";
    },
    statusLabel(status) {
      return { NOT_STARTED: "Queued", STARTED: "Running", FINALIZING: "Finishing" }[status] || "Running";
    },
    toggleMenu() {
      this.togglePrimaryNav(!this.primaryNavOpen);
      this.condenseSecondaryNav(!this.secondaryNavCondensed);
    },
  },
};
</script>

<style scoped lang="scss">
@use "sass:color";
@use "../../styles/theme";
@use "../../styles/navigation";

.bf-navigation {
  background: theme.$gray_1;
  box-shadow: -1px 0 0 rgba(64, 69, 84, 0.2) inset;
  padding-right: 1px;
  z-index: 99;

  &.condensed {
    box-shadow: none;
    padding-right: 0;
  }
}

hr {
  background-color: theme.$gray_2;
  height: 1px;
  border: 0;
  margin: 0 24px;
  .condensed & {
    margin: 0;
  }
}

.menu-wrap {
  margin-top: 0 !important;
}

/* As a dataset's heading row: the section's name; condensed, a 56px block
   in the darkened theme colour with the Analysis icon. */
/* 69px, so the rule under it is at 69px from the top, as the page header's
   and the primary nav's divider (OrgBreadcrumb). */
.heading-wrap {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  height: 69px;
  padding: 0 24px;
  white-space: nowrap;

  .condensed & {
    justify-content: center;
    margin-left: 6px;
    padding: 10px;
  }
}
/* The sections' colours, legible on the grey panel: dark text, a hover
   you can see but lighter than the chosen one (half way to $gray_2), the
   chosen one navy on the
   tint with a navy edge. Not the workspace's theme colour, which is too
   light on this grey. The condensed rail keeps the shared white. */
.bf-navigation:not(.condensed) :deep(.bf-navigation-item.secondary) {
  color: theme.$gray_6;

  .svg-icon {
    color: theme.$gray_5;
  }
  &:hover,
  &:focus-visible {
    background: color.mix(theme.$gray_1, theme.$gray_2, 50%);
    color: theme.$purple_3;

    .svg-icon {
      color: theme.$purple_3;
    }
  }
  &.router-link-active {
    background: theme.$purple_tint;
    border-right: 4px solid theme.$purple_3;
    color: theme.$purple_3;

    .svg-icon {
      color: theme.$purple_3;
    }
  }
}
.heading {
  color: theme.$gray_6;
  font-size: 16px;
  font-weight: 600;
}
/* A group's name, over its sections: small caps, as the app's filter
   headings. */
.group-label {
  padding: 16px 24px 4px;
  color: theme.$gray_4;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
/* A section's status: a count (running, open) or a node's state. */
.badge {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  box-sizing: border-box;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  text-align: center;

  /* Running is the run monitor's cyan (runHelpers); green means done. */
  &.live {
    background: #e0f7fb;
    color: #0e7490;
  }
  &.warn {
    background: #fdf1dc;
    color: #a3620a;
  }
  &.bad {
    background: #fbe3e3;
    color: #b42318;
  }
}
.icon-with-marker {
  position: relative;
  display: inline-flex;
}
.marker {
  position: absolute;
  top: -2px;
  right: -3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9);

  &.live {
    background: #06b6d4;
  }
  &.warn {
    background: #f79009;
  }
  &.bad {
    background: #f04438;
  }
}
/* Running now: one line a run, a pulsing dot (the run monitor's running
   cyan a workflow's, purple a notebook's), what runs, and its state. */
.running {
  list-style: none;
  margin: 0;
  padding: 0 12px 8px;
}
.running-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 6px;
  color: theme.$gray_6;
  font-size: 13px;
  text-decoration: none;

  &:hover {
    background: theme.$gray_2;
  }
  &.active {
    background: theme.$purple_tint;
    color: theme.$purple_3;
  }
}
.running-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.running-kind {
  flex-shrink: 0;
  color: theme.$gray_4;
  font-size: 11px;
}
.pulse {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #06b6d4;
  animation: pulse 2s ease-in-out infinite;

  &.notebook {
    background: theme.$purple_1;
  }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
@media (prefers-reduced-motion: reduce) {
  .pulse {
    animation: none;
  }
}
.running-more {
  display: block;
  padding: 0 24px 12px;
  color: theme.$purple_2;
  font-size: 12px;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
</style>
