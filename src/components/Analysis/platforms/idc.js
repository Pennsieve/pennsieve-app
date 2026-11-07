// The NCI Imaging Data Commons's collections, from its copy in the Registry
// of Open Data on AWS (utils/idc): series of any collection, each a folder
// named for people; a slide read in place as a stack, other series files to
// download.
import { defineAsyncComponent } from "vue";
import idcMark from "@/assets/images/logos/idc-mark.svg";
import { IDC_REGISTRY, idcViewName, createIdcView, countIdc } from "@/utils/idc";
import { addedSourceName } from "../JupyterSession/inputsHelpers";

export default {
  key: "idc",
  name: "Imaging Data Commons",
  desc: "Cancer imaging: radiology and pathology slides, as DICOM",
  noun: "collections",
  // Its logo's mark, from its Apache-2.0 web app: drawn on black.
  mark: { logo: idcMark, tone: "fill" },
  title: "Choose Imaging Data Commons series",
  intro: [
    "DICOM series from the NCI ",
    { href: "https://imaging.datacommons.cancer.gov", text: "Imaging Data Commons" },
    ", read from its copy in the Registry of Open Data on AWS. Radiology series are files you download; pathology slides are read in place, a region at a time, as they run to gigabytes.",
  ],
  picker: defineAsyncComponent(() => import("../IdcPicker.vue")),
  selection: () => ({ picks: [] }),
  ready: (p) => p.picks.length > 0,
  label: (p) => (p.picks.length ? idcViewName(p.picks) : ""),
  viewName: (p) => idcViewName(p.picks),
  sameAs: (p, source) => source.openDataset === IDC_REGISTRY && source.viewName === idcViewName(p.picks),
  createView: (p) => createIdcView(p.picks),
  folderName: (p, n) => {
    const collections = [...new Set(p.picks.map((s) => s.collection))];
    return addedSourceName("idc", `${collections.length === 1 ? collections[0] : `${collections.length}-collections`}/`, n);
  },
  count: () => countIdc(),
  regions: () => ["us-east-1"],
  // What's downloaded: slides are read in place.
  size: (p) => p.picks.filter((s) => !s.slide).reduce((n, s) => n + (s.size || 0), 0) || null,
  imaging: (p) => p.picks.length > 0,
  publicBucket: true,
  reads: (entry) => entry === IDC_REGISTRY,
};
