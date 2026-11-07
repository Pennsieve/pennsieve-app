// The Human Cell Atlas's open-access projects, from its copy in the
// Registry of Open Data on AWS (utils/hca): several at once, each the files
// picked, under their own names, in a folder named after it.
import { defineAsyncComponent } from "vue";
import hcaMark from "@/assets/images/logos/hca-mark.png";
import { HCA_REGISTRY, hcaViewName, hcaFolder, createHcaView, countHca } from "@/utils/hca";
import { addedSourceName } from "../JupyterSession/inputsHelpers";

export default {
  key: "hca",
  name: "Human Cell Atlas",
  desc: "Single-cell projects and matrices from the HCA Data Portal",
  noun: "projects",
  // Its Data Portal's mark, from its Apache-2.0 repository.
  mark: { logo: hcaMark, tone: "light" },
  title: "Choose Human Cell Atlas projects",
  intro: [
    "Open-access projects from the ",
    { href: "https://data.humancellatlas.org", text: "Human Cell Atlas Data Portal" },
    ", read from its copy in the Registry of Open Data on AWS: as many as you need, each with the files you pick (its matrices to start with), in a folder named after it.",
  ],
  picker: defineAsyncComponent(() => import("../HcaPicker.vue")),
  selection: () => ({ picks: [] }),
  ready: (p) => p.picks.length > 0,
  label: (p) => (p.picks.length ? hcaViewName(p.picks) : ""),
  viewName: (p) => hcaViewName(p.picks),
  sameAs: (p, source) => source.openDataset === HCA_REGISTRY && source.viewName === hcaViewName(p.picks),
  createView: (p) => createHcaView(p.picks),
  folderName: (p, n) => addedSourceName("hca", `${p.picks.length === 1 ? hcaFolder(p.picks[0]) : `${p.picks.length}-projects`}/`, n),
  count: () => countHca(),
  regions: () => ["us-east-1"],
  size: (p) => p.picks.reduce((n, x) => n + x.files.reduce((m, f) => m + (f.size || 0), 0), 0) || null,
  imaging: () => false,
  publicBucket: true,
  reads: (entry) => entry === HCA_REGISTRY,
};
