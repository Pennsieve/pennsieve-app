// BossDB's public volumes, from its copy in the Registry of Open Data on AWS
// (utils/bossdb): whole collections, experiments or channels, several at
// once, as a view of their folders whose volumes are read in place.
import { defineAsyncComponent } from "vue";
import bossdbLogo from "@/assets/images/logos/bossdb-logo.svg";
import { createOpenDataViewOf } from "@/utils/viewsService";
import { BOSSDB_REGISTRY, bossdbViewName, countBossdb } from "@/utils/bossdb";
import { addedSourceName } from "../JupyterSession/inputsHelpers";

export default {
  key: "bossdb",
  name: "BossDB",
  desc: "Electron microscopy and connectomics volumes",
  noun: "collections",
  // Its logo, with its owners' blessing.
  mark: { logo: bossdbLogo, tone: "light" },
  title: "Choose BossDB data",
  intro: [
    "Volumes from ",
    { href: "https://bossdb.org", text: "BossDB" },
    ", read from its copy in the Registry of Open Data on AWS: whole collections, experiments or channels, as many as you need. The notebook reads each volume in place, a region at a time; nothing is downloaded up front.",
  ],
  picker: defineAsyncComponent(() => import("../BossdbPicker.vue")),
  selection: () => ({ picks: [] }),
  ready: (p) => p.picks.length > 0,
  label: (p) => (p.picks.length ? bossdbViewName(p.picks) : ""),
  viewName: (p) => bossdbViewName(p.picks),
  sameAs: (p, source) => source.openDataset === BOSSDB_REGISTRY && source.viewName === bossdbViewName(p.picks),
  createView: (p) => createOpenDataViewOf({ dataset: BOSSDB_REGISTRY, name: bossdbViewName(p.picks), prefixes: p.picks.map((x) => x.prefix) }),
  // Named after what's chosen: bossdb-witvliet2020-Dataset_1-em for one,
  // its collection for several of one.
  folderName: (p, n) => {
    const one = p.picks.length === 1 ? p.picks[0].prefix : p.picks[0].prefix.split("/")[0];
    return addedSourceName(BOSSDB_REGISTRY, `${one.replace(/\/$/, "").replaceAll("/", "-")}/`, n);
  },
  count: () => countBossdb(),
  regions: () => ["us-east-1"],
  size: () => null,
  imaging: () => false,
  publicBucket: true,
  reads: (entry) => entry === BOSSDB_REGISTRY,
};
