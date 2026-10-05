/**
 * useAppManifest
 * --------------
 * Loads an application's committed `app.yml` and hands back the parsed
 * manifest, optionally for a specific released version.
 *
 * The manifest only ships on the *detail* endpoint — `GET
 * /applications/store/{uuid}` returns recognized repository files in `assets`,
 * keyed by filename. The applications *list* endpoint omits `assets` entirely,
 * so anything working from a list entry (the workflow builder's app palette,
 * for one) has to fetch the detail before it can see a manifest.
 *
 * Versions: the top-level `assets` reflect the repository as it is now, which
 * we treat as the latest version. A version's own app.yml is read from
 * `versions[i].assets` when the backend provides it. Every result carries
 * `exact` — true only when the manifest is known to belong to the requested
 * version — so callers can avoid replacing one version's parameters with
 * another's.
 *
 * Application details are memoized module-wide, including misses: dropping the
 * same application onto the canvas repeatedly should not re-request it.
 */
import { useStore } from "vuex";
import { load as loadYaml } from "js-yaml";

import { parseManifest } from "@/components/Analysis/Applications/applicationSchema";

/** uuid -> Promise<detail|null> (null = lookup failed) */
const detailCache = new Map();

/** Pull the manifest text out of an `assets` map, whatever its casing. */
export const getManifestAsset = (assets) => {
  if (!assets) return "";
  const key = Object.keys(assets).find((k) => /^app\.ya?ml$/i.test(k));
  return key ? assets[key] : "";
};

/**
 * Parse manifest text. Returns null rather than throwing: a malformed app.yml
 * should leave a caller on its existing defaults, not break the flow it is in.
 */
export const parseManifestText = (raw) => {
  if (!raw || !raw.trim()) return null;
  try {
    const doc = loadYaml(raw);
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return null;
    return parseManifest(doc);
  } catch (err) {
    return null;
  }
};

/** Most recently created version entry, matching the version pickers. */
const latestVersionOf = (versions = []) =>
  [...versions].sort(
    (a, b) =>
      (new Date(b.createdAt).getTime() || 0) -
      (new Date(a.createdAt).getTime() || 0),
  )[0] || null;

/**
 * Resolve the manifest for `version` from an application detail response.
 *
 * - The version entry's own `assets` win when present.
 * - Otherwise the top-level manifest is used; it is `exact` only when no
 *   version was asked for, or the one asked for is the latest.
 *
 * @param {Object} detail   GET /applications/store/{uuid} response
 * @param {string} [version]
 * @returns {{meta: Object, schema: Object, exact: boolean}|null}
 */
export const resolveManifest = (detail, version) => {
  if (!detail) return null;
  const versions = detail.versions || [];

  if (version) {
    const entry = versions.find((v) => v.version === version);
    if (entry?.assets) {
      const parsed = parseManifestText(getManifestAsset(entry.assets));
      return parsed ? { ...parsed, exact: true } : null;
    }
  }

  const parsed = parseManifestText(getManifestAsset(detail.assets));
  if (!parsed) return null;
  const latest = latestVersionOf(versions)?.version;
  return { ...parsed, exact: !version || version === latest };
};

export const clearManifestCache = () => detailCache.clear();

export function useAppManifest() {
  const store = useStore();

  const loadDetail = (uuid) => {
    if (!detailCache.has(uuid)) {
      detailCache.set(
        uuid,
        // A failed lookup is cached too — the caller falls back to defaults,
        // and retrying on every drop would just repeat the failure.
        store
          .dispatch("analysisModule/fetchApplication", uuid)
          .catch(() => null),
      );
    }
    return detailCache.get(uuid);
  };

  /**
   * @param {string} uuid application uuid
   * @param {string} [version] version tag; omitted = latest
   * @returns {Promise<{meta: Object, schema: Object, exact: boolean}|null>}
   */
  const loadManifest = async (uuid, version) => {
    if (!uuid) return null;
    return resolveManifest(await loadDetail(uuid), version);
  };

  return { loadManifest };
}
