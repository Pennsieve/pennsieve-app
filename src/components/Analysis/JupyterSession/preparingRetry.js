import { InputsPreparing } from "@/composables/useJupyterSession";

// The files asked for while a view's records are being prepared wait here
// and are asked for again when the sidecar says (InputsPreparing's
// retryAfter), together with any asked for meanwhile, for up to budgetMs.
// onState({ preparing, error }) follows: preparing while some wait; error
// when asking failed, or took too long.
export const PREPARE_BUDGET_MS = 30 * 60 * 1000;
export const PREPARE_TOO_LONG = "The view's records took too long to prepare. Try again in a few minutes.";

export function createPreparingRetry({
  send,
  onState,
  keyOf,
  budgetMs = PREPARE_BUDGET_MS,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (t) => clearTimeout(t),
}) {
  const pending = new Map();
  let timer = null;
  let since = null;

  const reset = () => {
    if (timer) clearTimer(timer);
    timer = null;
    pending.clear();
    since = null;
  };

  async function run() {
    timer = null;
    const files = [...pending.values()];
    if (!files.length) return;
    try {
      await send(files);
      reset();
      onState({ preparing: false, error: null });
    } catch (e) {
      if (e instanceof InputsPreparing && now() - since < budgetMs) {
        onState({ preparing: true, error: null });
        timer = setTimer(run, e.retryAfter * 1000);
        return;
      }
      reset();
      onState({ preparing: false, error: e instanceof InputsPreparing ? PREPARE_TOO_LONG : e?.message || String(e) });
    }
  }

  return {
    // Asks for files, with any still waiting.
    request(files) {
      for (const f of files) pending.set(keyOf(f), f);
      if (since == null) since = now();
      if (timer) clearTimer(timer);
      timer = null;
      return run();
    },
    // Stops waiting: the files waiting aren't asked for again.
    stop() {
      const was = pending.size > 0;
      reset();
      if (was) onState({ preparing: false, error: null });
    },
  };
}
