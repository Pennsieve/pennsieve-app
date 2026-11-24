// The Pennsieve app as the notebooks' host: its site config, its Cognito
// session, and the workspace being viewed as the scope. realtime is a
// function: the app makes its client after this runs. This file stays in
// the app when the notebook code moves to @pennsieve/notebooks.

import { configureNotebooks } from "./host";
import { createPennsieveBackend } from "./pennsieveBackend";
import { useGetAllTokens, useGetToken } from "@/composables/useGetToken";
import { runScopeChannel } from "@/realtime/channels";

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
  });
}
