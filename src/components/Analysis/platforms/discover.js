// Pennsieve Discover: a published dataset version, taken as a view of it
// (viewsService viewForDataset).
import { defineAsyncComponent } from "vue";
import IconPennsieveMark from "@/components/icons/IconPennsieveMark.vue";
import { viewForDataset } from "@/utils/viewsService";
import { countPublicDatasets } from "@/utils/publicDatasets";

export default {
  key: "discover",
  name: "Pennsieve Discover",
  desc: "Published, citable research datasets",
  noun: "published datasets",
  // The mark is 100 x 114: a little taller than wide.
  mark: { icon: IconPennsieveMark, iconProps: (s) => ({ width: Math.round(s * 0.42), height: Math.round(s * 0.48), color: "currentColor" }), tone: "brand" },
  title: "Choose a Pennsieve Discover dataset",
  intro: ["A published dataset and its version. The notebook gets its file list; you pick which files to download."],
  picker: defineAsyncComponent(() => import("../DiscoverPicker.vue")),
  selection: () => ({ dataset: null, version: null }),
  ready: (p) => !!p.dataset && p.version != null,
  label: (p) => p.dataset?.name || "",
  sameLabel: (p) => `Version ${p.version} of ${p.dataset?.name}`,
  // A Discover source is the same files by its dataset id and version.
  sameAs: (p, source) => source.sourceDatasetId === p.dataset.id && source.sourceVersion === p.version,
  createView: (p) => viewForDataset({ datasetId: p.dataset.id, version: p.version, name: p.dataset.name }),
  folderName: (p, n) => `dataset-${p.dataset.id}-v${p.version}${n > 1 ? `-${n}` : ""}`,
  count: () => countPublicDatasets(),
  regions: () => [],
  size: (p) => p.dataset?.size || null,
  imaging: () => false,
  publicBucket: false,
  reads: () => false,
};
