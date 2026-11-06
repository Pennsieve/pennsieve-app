// What's chosen on each data platform, kept while the user moves between
// them (PlatformPane binds each platform's picker to its part):
//   discover: { dataset, version }          a Discover dataset version
//   openData, openNeuro, sparc, epilepsyScience, dandi, physionet: { dataset, prefix }
//   bossdb: { picks }                        collections, experiments, channels
import { reactive } from "vue";

export function newSelection() {
  return reactive({
    discover: { dataset: null, version: null },
    openData: { dataset: null, prefix: "" },
    openNeuro: { dataset: null, prefix: "" },
    sparc: { dataset: null, prefix: "" },
    epilepsyScience: { dataset: null, prefix: "" },
    dandi: { dataset: null, prefix: "" },
    physionet: { dataset: null, prefix: "" },
    bossdb: { picks: [] },
  });
}

// Starts a selection over.
export function clearSelection(sel) {
  Object.assign(sel, newSelection());
}

// Whether what's chosen on a platform is enough to take.
export function selectionReady(platform, sel) {
  const part = sel?.[platform];
  if (!part) return false;
  if (platform === "bossdb") return part.picks.length > 0;
  if (platform === "discover") return !!part.dataset && part.version != null;
  // A PhysioNet project's version: its folder (not the whole project, with
  // every version and its zip).
  if (platform === "physionet") return !!part.dataset && !!part.prefix;
  return !!part.dataset;
}
