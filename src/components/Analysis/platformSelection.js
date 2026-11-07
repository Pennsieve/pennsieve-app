// What's chosen on each data platform, kept while the user moves between
// them (PlatformPane binds each platform's picker to its part): each
// platform's selection() (platforms/), e.g. Discover's { dataset, version },
// most others' { dataset, prefix }, BossDB's { picks }.
import { reactive } from "vue";
import { PLATFORMS, PLATFORM_KEYS } from "./platforms";

export function newSelection() {
  return reactive(Object.fromEntries(PLATFORM_KEYS.map((k) => [k, PLATFORMS[k].selection()])));
}

// Starts a selection over.
export function clearSelection(sel) {
  Object.assign(sel, newSelection());
}

// Whether what's chosen on a platform is enough to take.
export function selectionReady(platform, sel) {
  const part = sel?.[platform];
  return !!part && !!PLATFORMS[platform]?.ready(part);
}
