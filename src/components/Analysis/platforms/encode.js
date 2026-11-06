// ENCODE's released experiments, from its copy in the Registry of Open Data
// on AWS (utils/encode): several at once, each the files picked, in a
// folder named after it.
import { defineAsyncComponent } from "vue";
import encodeLogo from "@/assets/images/logos/encode-logo.png";
import { ENCODE_REGISTRY, encodeViewName, createEncodeView, countEncode } from "@/utils/encode";
import { addedSourceName } from "../JupyterSession/inputsHelpers";

export default {
  key: "encode",
  name: "ENCODE",
  desc: "Functional genomics: ChIP-seq, RNA-seq, ATAC-seq and more",
  noun: "experiments",
  // Its logo, from its MIT-licensed portal.
  mark: { logo: encodeLogo, tone: "light" },
  title: "Choose ENCODE experiments",
  intro: [
    "Released experiments from ",
    { href: "https://www.encodeproject.org", text: "ENCODE" },
    ", read from its copy in the Registry of Open Data on AWS: as many as you need, each with the files you pick (its default analysis to start with), in a folder named after it.",
  ],
  picker: defineAsyncComponent(() => import("../EncodePicker.vue")),
  selection: () => ({ picks: [] }),
  ready: (p) => p.picks.length > 0,
  label: (p) => (p.picks.length ? encodeViewName(p.picks) : ""),
  viewName: (p) => encodeViewName(p.picks),
  sameAs: (p, source) => source.openDataset === ENCODE_REGISTRY && source.viewName === encodeViewName(p.picks),
  createView: (p) => createEncodeView(p.picks),
  folderName: (p, n) => addedSourceName("encode", `${p.picks.length === 1 ? p.picks[0].accession : `${p.picks.length}-experiments`}/`, n),
  count: () => countEncode(),
  regions: () => ["us-west-2"],
  size: (p) => p.picks.reduce((n, x) => n + x.files.reduce((m, f) => m + (f.size || 0), 0), 0) || null,
  imaging: () => false,
  publicBucket: true,
  reads: (entry) => entry === ENCODE_REGISTRY,
};
