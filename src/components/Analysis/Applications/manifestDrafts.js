// A draft app.yml for an app, kept in this browser only, so its inputs and
// outputs can be tried in the workflow builder before a pull request and a
// release. Nothing is published: the workflow builder uses the draft for that
// app's steps (marked as a draft) until it's cleared or the app is released.
//
// localStorage can be missing or refuse writes (private windows, blocked
// site data); every access is guarded and a draft is simply absent then.

const KEY = (uuid) => `pennsieve.appManifestDraft.${uuid}`;

export function saveManifestDraft(uuid, yaml) {
  if (!uuid || !yaml) return false;
  try {
    localStorage.setItem(KEY(uuid), JSON.stringify({ yaml, savedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

// { yaml, savedAt } or null.
export function getManifestDraft(uuid) {
  if (!uuid) return null;
  try {
    const raw = localStorage.getItem(KEY(uuid));
    const draft = raw ? JSON.parse(raw) : null;
    return draft && typeof draft.yaml === "string" ? draft : null;
  } catch {
    return null;
  }
}

export function clearManifestDraft(uuid) {
  if (!uuid) return;
  try {
    localStorage.removeItem(KEY(uuid));
  } catch {
    // Nothing stored, or storage blocked: nothing to clear.
  }
}

// Whether a release made after the draft was saved replaces it.
export function draftOutdatedBy(draft, versions) {
  const saved = Date.parse(draft?.savedAt || "");
  if (Number.isNaN(saved)) return false;
  return (versions || []).some((v) => Date.parse(v?.createdAt || "") > saved);
}
