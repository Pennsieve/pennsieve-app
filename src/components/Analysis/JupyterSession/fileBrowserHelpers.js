// The session's file browser shows what the session's Jupyter server lists
// (it lists hidden files too: pennsieve-jupyter-session's allow_hidden). It
// hides dot-files and dot-folders, such as each input's .pennsieve/ (its
// view's crate) and a dataset's .datalad/, unless the user asks for them.

export const isHidden = (entry) => (entry?.name || "").startsWith(".");

// The entries to show, in the order given.
export const visibleEntries = (entries, showHidden = false) =>
  showHidden ? entries || [] : (entries || []).filter((e) => !isHidden(e));

// The user's choice, remembered in this browser. Storage can be unavailable
// (a private window, blocked site data): then it's off, and not kept.
const SHOW_HIDDEN_KEY = "pennsieve.sessionFiles.showHidden";

export function readShowHidden(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(SHOW_HIDDEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeShowHidden(value, storage = globalThis.localStorage) {
  try {
    storage?.setItem(SHOW_HIDDEN_KEY, value ? "true" : "false");
  } catch {
    // not kept
  }
}
