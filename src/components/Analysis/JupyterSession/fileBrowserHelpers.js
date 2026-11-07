// The session's file browser shows what the session's Jupyter server lists
// (it lists hidden files too: pennsieve-jupyter-session's allow_hidden). It
// hides dot-files and dot-folders, such as each input's .pennsieve/ (its
// view's crate) and a dataset's .datalad/, unless the user asks for them.

export const isHidden = (entry) => (entry?.name || "").startsWith(".");

// Not on the disk: a file or folder a view holds that isn't downloaded. A
// stack (read in place, never downloaded) isn't one.
export const isRemote = (entry) => !!entry?.virtual && entry.type !== "stack";

// The entries to show, in the order given: without hidden ones unless
// showHidden, and without remote ones when onlyLocal.
export const visibleEntries = (entries, showHidden = false, onlyLocal = false) =>
  (entries || []).filter((e) => (showHidden || !isHidden(e)) && !(onlyLocal && isRemote(e)));

// The user's choices, remembered in this browser. Storage can be
// unavailable (a private window, blocked site data): then they're off, and
// not kept.
const SHOW_HIDDEN_KEY = "pennsieve.sessionFiles.showHidden";
const ONLY_LOCAL_KEY = "pennsieve.sessionFiles.onlyDownloaded";

function readFlag(key, storage) {
  try {
    return storage?.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeFlag(key, value, storage) {
  try {
    storage?.setItem(key, value ? "true" : "false");
  } catch {
    // not kept
  }
}

export const readShowHidden = (storage = globalThis.localStorage) => readFlag(SHOW_HIDDEN_KEY, storage);
export const writeShowHidden = (value, storage = globalThis.localStorage) => writeFlag(SHOW_HIDDEN_KEY, value, storage);
export const readOnlyLocal = (storage = globalThis.localStorage) => readFlag(ONLY_LOCAL_KEY, storage);
export const writeOnlyLocal = (value, storage = globalThis.localStorage) => writeFlag(ONLY_LOCAL_KEY, value, storage);
