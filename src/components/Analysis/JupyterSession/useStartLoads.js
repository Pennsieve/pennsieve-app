// Loads asked from the notebook's start card (StartCard.vue): each layout's
// starter cell, put in once all of its files are in the session, downloaded
// first when needed. Kept by the notebook, not the card, so a load finishes
// even after the card is gone (another load's cell went in first, or the
// card was hidden).
import { computed, reactive, ref, watch } from "vue";

// rows: a ref of the card's rows ({ key, source, code, state, layout });
// insert(code): puts a cell in.
export function useStartLoads({ inputs, rows, insert }) {
  // key -> { seen }: seen once its download is under way, so a failure from
  // before isn't taken for this one's.
  const pending = reactive(new Map());
  const error = ref("");

  async function load(row) {
    if (row.state.all) return insert(row.code);
    error.value = "";
    pending.set(row.key, { seen: row.state.under });
    if (row.state.under) return;
    await inputs.requestEntries(row.source, row.state.left);
    if (inputs.requestError) {
      pending.delete(row.key);
      error.value = inputs.requestError;
    }
  }

  watch(
    rows,
    (list) => {
      for (const row of list) {
        const p = pending.get(row.key);
        if (!p) continue;
        if (row.state.under) p.seen = true;
        else if (row.state.all) {
          pending.delete(row.key);
          insert(row.code);
        } else if (row.state.failed && p.seen) {
          pending.delete(row.key);
          error.value = `${row.layout.entry.label} didn't download.`;
        }
      }
    },
    { deep: true }
  );

  const waiting = computed(() => new Set(pending.keys()));
  return { load, waiting, error };
}
