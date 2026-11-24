// The scope's runs for the notebooks overview, page by page, kept current by
// run status events: a known run's status changes in place; an unknown one
// (just started elsewhere) refetches the list, once per burst.

import { onBeforeUnmount, ref } from "vue";
import { notebookBackend } from "./host";

// Newest first; runs without a start time last.
const byStartDesc = (a, b) => {
  const ta = new Date(a.startedAt).getTime();
  const tb = new Date(b.startedAt).getTime();
  if (isNaN(ta)) return 1;
  if (isNaN(tb)) return -1;
  return tb - ta;
};

export function useNotebookRuns({ refetchDelayMs = 1500 } = {}) {
  const runs = ref([]);
  const cursor = ref(null);
  let refetchTimer = null;

  async function refresh() {
    try {
      const page = await notebookBackend().listRuns();
      runs.value = [...page.runs].sort(byStartDesc);
      cursor.value = page.cursor;
    } catch (err) {
      runs.value = [];
      cursor.value = null;
      throw err;
    }
  }

  async function loadMore() {
    if (!cursor.value) return;
    const page = await notebookBackend().listRuns({ cursor: cursor.value });
    const known = new Set(runs.value.map((r) => r.uuid));
    runs.value = [...runs.value, ...page.runs.filter((r) => !known.has(r.uuid))];
    cursor.value = page.cursor;
  }

  function applyStatus({ runId, status }) {
    if (!runId) return;
    const run = runs.value.find((r) => r.uuid === runId);
    if (run) {
      run.status = status;
      return;
    }
    clearTimeout(refetchTimer);
    refetchTimer = setTimeout(() => {
      refetchTimer = null;
      refresh().catch((err) => console.error("Failed to refetch runs:", err));
    }, refetchDelayMs);
  }

  // Live updates while the page is open.
  let unsubscribe = null;
  function subscribe() {
    unsubscribe?.();
    unsubscribe = notebookBackend().subscribeRunStatus(applyStatus);
  }
  onBeforeUnmount(() => {
    unsubscribe?.();
    clearTimeout(refetchTimer);
  });

  return { runs, cursor, refresh, loadMore, applyStatus, subscribe };
}
