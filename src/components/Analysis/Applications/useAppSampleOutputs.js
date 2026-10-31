/*
  The app page's sample outputs (appSamples.js): lists the workspace's
  and the public catalog's workflows (a few pages of each), keeps those the
  app is in, and asks each for its sample output. Loads in the background;
  nothing shows until there's something to show.
*/
import { ref, watch } from "vue";
import { useStore } from "vuex";
import { appSampleEntry, sortEntries, workflowsUsingApp } from "./appSamples";

export function useAppSampleOutputs(sourceUrl, { maxPages = 5, maxWorkflows = 12 } = {}) {
  const store = useStore();
  const entries = ref([]);
  const more = ref(0); // workflows using the app that weren't asked
  const loading = ref(false);
  let seq = 0;

  const listAll = async (visibility) => {
    const out = [];
    let cursor;
    for (let i = 0; i < maxPages; i++) {
      const page = await store.dispatch("analysisModule/listWorkflowDefinitions", { visibility, cursor });
      out.push(...page.workflows);
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    return out;
  };

  const load = async () => {
    const mine = ++seq;
    entries.value = [];
    more.value = 0;
    const url = sourceUrl.value;
    if (!url) return;
    loading.value = true;
    try {
      const lists = await Promise.allSettled([listAll(), listAll("public")]);
      const using = workflowsUsingApp(
        lists.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
        url
      );
      const asked = using.slice(0, maxWorkflows);
      const found = await Promise.all(
        asked.map((wf) =>
          store
            .dispatch("analysisModule/fetchWorkflowExample", wf.uuid)
            .then((example) => appSampleEntry(wf, example && { ...example, fetchedAt: Date.now() }))
            .catch(() => null)
        )
      );
      if (mine !== seq) return;
      entries.value = sortEntries(found.filter(Boolean));
      more.value = using.length - asked.length;
    } finally {
      if (mine === seq) loading.value = false;
    }
  };

  watch(sourceUrl, load, { immediate: true });
  return { entries, more, loading, reload: load };
}
