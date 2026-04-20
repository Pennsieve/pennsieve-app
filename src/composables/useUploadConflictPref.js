// Persists the user's upload-conflict preference to localStorage.
//
// Values: 'ask' (default, surface the dialog on conflict) | 'replace' |
// 'keepBoth'. An invalid or missing value falls back to 'ask'.
//
// localStorage is intentionally the MVP storage — no server-side user-
// preferences API exists today and adding one is out of scope for
// shipping the conflict-resolution UX. The preference is per-browser
// per-origin; users who change machines will re-see the dialog once
// until they pick "Remember my choice" again. Acceptable for v1.
const KEY = "pennsieve.uploadConflictPref";
const VALID = new Set(["ask", "replace", "keepBoth"]);

export function getUploadConflictPref() {
  try {
    const v = localStorage.getItem(KEY);
    return VALID.has(v) ? v : "ask";
  } catch {
    // Private-browsing / disabled-storage fallback
    return "ask";
  }
}

export function setUploadConflictPref(v) {
  if (!VALID.has(v)) return;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // no-op: private browsing or quota; the in-dialog choice still
    // applies to the current upload.
  }
}