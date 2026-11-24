// The Pennsieve app as the notebooks' host: its site config, its Cognito
// session, and the workspace being viewed as the scope. realtime is a
// function: the app makes its client after this runs. This file stays in
// the app when the notebook code moves to @pennsieve/notebooks.

import { configureNotebooks } from "@pennsieve/notebooks/notebooks/host";
import { createPennsieveBackend } from "@pennsieve/notebooks/notebooks/pennsieveBackend";
import { useGetAllTokens, useGetToken } from "@/composables/useGetToken";
import { runScopeChannel } from "@/realtime/channels";
import EventBus from "@/utils/event-bus";
import { defineAsyncComponent } from "vue";
import { isFeatureEnabled } from "@/utils/features";
import { PLATFORM_KEYS, registerPlatform } from "@pennsieve/notebooks/components/Analysis/platforms/index";
import workspacePlatform from "./workspacePlatform";

// Realtime payloads arrive as JSON text or already parsed.
const parseEventData = (data) => {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

export function setupAppNotebooks({ siteConfig, store, router, realtime }) {
  // A workspace's own datasets, as a data platform for the quick launcher.
  registerPlatform(workspacePlatform);

  // The active workspace, or the user's own outside one (My Workspace).
  const scope = () => {
    const organizationId = store.state.activeOrganization?.organization?.id;
    if (organizationId) return { kind: "workspace", organizationId };
    return { kind: "user", userId: store.state.profile?.id };
  };

  // Every run of the workspace, or the user's own runs. The route's
  // workspace, not activeOrganization: that stays set in My Workspace, where
  // a personal run's events go to the user's channel.
  const subscribeRunStatus = (handler) => {
    const client = realtime?.();
    if (!client) return () => {};
    const channel = client.subscribe(runScopeChannel(router.currentRoute.value.params.orgId, store.state.profile?.id));
    const onStatus = (raw) => {
      const data = parseEventData(raw);
      handler({ runId: data.runId, status: data.status });
    };
    channel.bind("workflow-run-status", onStatus);
    return () => {
      channel.unbind("workflow-run-status", onStatus);
      channel.unsubscribe();
    };
  };

  configureNotebooks({
    endpoints: siteConfig,
    getToken: useGetToken,
    getTokens: useGetAllTokens,
    backend: createPennsieveBackend({
      endpoints: siteConfig,
      scope,
      getToken: useGetToken,
      getTokens: useGetAllTokens,
      subscribeRunStatus,
    }),
    user: () => store.state.profile || null,
    members: () => store.state.orgMembers || [],
    pennsieveAppUrl: "",
    // The New notebook launcher: the quick one where the site has it, else
    // the dialog. Loaded when the notebooks page first opens it.
    components: {
      launcher: defineAsyncComponent(() =>
        isFeatureEnabled("quickLauncher")
          ? import("@pennsieve/notebooks/launch/QuickLaunchDialog.vue")
          : import("@/components/Analysis/RunMonitor/NewNotebookDialog.vue")
      ),
    },
    launch: {
      // In a workspace its datasets come first; My Workspace has none.
      get platforms() {
        const others = PLATFORM_KEYS.filter((k) => k !== workspacePlatform.key);
        return scope().kind === "workspace" ? [workspacePlatform.key, ...others] : others;
      },
      // Where a user adds a compute node: the workspace's, or their own.
      get computeNodes() {
        const orgId = router.currentRoute.value.params.orgId;
        return orgId ? { name: "compute-nodes", params: { orgId } } : { name: "my-compute-nodes" };
      },
    },
    notify: ({ type, message }) => EventBus.$emit("toast", { detail: { type, msg: message } }),
    locations: {
      // The run's page, in its workspace or in My Analysis for a personal run.
      run: (runId) => {
        const orgId = router.currentRoute.value.params.orgId;
        return orgId ? { name: "run-detail", params: { orgId, runId } } : { name: "my-run-detail", params: { runId } };
      },
      // The run's notebook page.
      notebook: (runId) => {
        const orgId = router.currentRoute.value.params.orgId;
        return orgId ? { name: "run-notebook", params: { orgId, runId } } : { name: "my-run-notebook", params: { runId } };
      },
      // A notebook picked from the list: its run's page in a workspace; in
      // My Workspace, its notebook.
      listedRun: (runId) =>
        router.currentRoute.value.params.orgId
          ? { name: "run-detail", params: { runId } }
          : { name: "my-run-notebook", params: { runId } },
    },
  });
}
