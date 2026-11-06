// How big each data platform is ("82 collections"), read once per page and
// shared by the data pickers (PlatformList): each platform's count()
// (platforms/). A count that can't be read is left out.
import { reactive } from "vue";
import { PLATFORMS, PLATFORM_KEYS } from "./platforms";

const counts = reactive({});
const asked = new Set();

// The counts, reading those of the platforms given that aren't yet.
export function usePlatformCounts(keys = PLATFORM_KEYS) {
  for (const k of keys) {
    if (asked.has(k) || !PLATFORMS[k]) continue;
    asked.add(k);
    PLATFORMS[k]
      .count()
      .then((n) => (counts[k] = n))
      .catch(() => asked.delete(k));
  }
  return counts;
}
