/**
 * useAppManifest
 * --------------
 * Loads an application's committed `app.yml` and hands back the parsed
 * manifest.
 *
 * The manifest only ships on the *detail* endpoint — `GET
 * /applications/store/{uuid}` returns recognized repository files in `assets`,
 * keyed by filename. The applications *list* endpoint omits `assets` entirely,
 * so anything working from a list entry (the workflow builder's app palette,
 * for one) has to fetch the detail before it can see a manifest.
 *
 * Results are memoized module-wide, including misses: dropping the same
 * application onto the canvas repeatedly should not re-request it. `null` means
 * "this application has no usable manifest" and is cached as such.
 */
import { useStore } from "vuex";
import { load as loadYaml } from "js-yaml";

import { parseManifest } from "@/components/Analysis/Applications/applicationSchema";

/** uuid -> {meta, schema} | null (null = looked up, nothing usable) */
const manifestCache = new Map();

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

export const clearManifestCache = () => manifestCache.clear();

export function useAppManifest() {
  const store = useStore();

  /**
   * @param {string} uuid application uuid
   * @returns {Promise<{meta: Object, schema: Object}|null>}
   */
  const loadManifest = async (uuid) => {
    if (!uuid) return null;
    if (manifestCache.has(uuid)) return manifestCache.get(uuid);

    let parsed = null;
    try {
      const detail = await store.dispatch("analysisModule/fetchApplication", uuid);
      parsed = parseManifestText(getManifestAsset(detail?.assets));
    } catch (err) {
      // A failed lookup is cached too — the caller falls back to defaults, and
      // retrying on every drop would just repeat the failure.
      parsed = null;
    }
    manifestCache.set(uuid, parsed);
    return parsed;
  };

  return { loadManifest };
}
