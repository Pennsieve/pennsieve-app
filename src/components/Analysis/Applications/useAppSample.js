/*
  An app's own sample output: the PDF summary of one of its app runs, set by
  its owner (GET /apps/example). One quick request, so the app page shows it
  first; pdfSource gives a fresh signed link for the viewer.
*/
import { ref, watch } from "vue";
import { useStore } from "vuex";
import { PDF_URL_FRESH_MS } from "../Workflows/runExamples";

export function useAppSample(sourceUrl) {
  const store = useStore();
  const sample = ref(null);
  let fetchedAt = 0;
  let seq = 0;

  const load = async () => {
    const mine = ++seq;
    sample.value = null;
    const url = sourceUrl.value;
    if (!url) return;
    try {
      const found = await store.dispatch("analysisModule/fetchAppExample", url);
      if (mine !== seq) return;
      sample.value = found || null;
      fetchedAt = Date.now();
    } catch {
      // nothing shown
    }
  };
  watch(sourceUrl, load, { immediate: true });

  // A signed link to the PDF, asked again when the one in hand is old.
  const pdfSource = async () => {
    if (sample.value?.pdfUrl && Date.now() - fetchedAt < PDF_URL_FRESH_MS) return sample.value.pdfUrl;
    const found = await store.dispatch("analysisModule/fetchAppExample", sourceUrl.value);
    sample.value = found || null;
    fetchedAt = Date.now();
    return found?.pdfUrl || null;
  };

  return { sample, reload: load, pdfSource };
}
