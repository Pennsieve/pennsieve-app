// How big each data platform is ("82 collections"), read once per page and
// shared by the data pickers (PlatformList). A count that can't be read is
// left out.
import { reactive } from "vue";
import { countPublicDatasets } from "@/utils/publicDatasets";
import { countOpenNeuro } from "@/utils/openNeuro";
import { countDandi } from "@/utils/dandi";
import { countBossdb } from "@/utils/bossdb";
import { countPhysionet } from "@/utils/physionet";
import { countAllen } from "@/utils/allen";
import { OPEN_DATA_PORTALS, portalDatasetIds } from "@/utils/openDataPortals";
import { openDataCatalog } from "@/utils/viewsService";

const counts = reactive({});
const asked = new Set();

const COUNTERS = {
  discover: () => countPublicDatasets(),
  openNeuro: () => countOpenNeuro(),
  dandi: () => countDandi(),
  bossdb: () => countBossdb(),
  physionet: () => countPhysionet(),
  allen: () => countAllen(),
  openData: () => openDataCatalog().then((list) => list.filter((d) => d.anonymous).length),
  ...Object.fromEntries(Object.keys(OPEN_DATA_PORTALS).map((p) => [p, () => portalDatasetIds(p).then((ids) => ids.length)])),
};

// The counts, reading those of the platforms given that aren't yet.
export function usePlatformCounts(keys = Object.keys(COUNTERS)) {
  for (const k of keys) {
    if (asked.has(k) || !COUNTERS[k]) continue;
    asked.add(k);
    COUNTERS[k]()
      .then((n) => (counts[k] = n))
      .catch(() => asked.delete(k));
  }
  return counts;
}
