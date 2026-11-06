// The DANDI Archive's dandisets, from its copy in the Registry of Open Data
// on AWS: a dandiset version is views-service's own kind of source, each
// file read from its blob (utils/dandi).
import { defineAsyncComponent } from "vue";
import dandiLogo from "@/assets/images/logos/dandi-logo.svg";
import { createDandiView, openDataViewName } from "@/utils/viewsService";
import { DANDI_REGISTRY, dandiViewTitle, countDandi } from "@/utils/dandi";
import { addedSourceName } from "../JupyterSession/inputsHelpers";

const viewName = (p) => openDataViewName(dandiViewTitle(p.dataset), p.prefix);

export default {
  key: "dandi",
  name: "DANDI",
  desc: "Neurophysiology data, mostly NWB, from the DANDI Archive",
  noun: "dandisets",
  // From its Apache-2.0 repository.
  mark: { logo: dandiLogo, tone: "light" },
  title: "Choose a dandiset",
  intro: [
    "A dandiset from the ",
    { href: "https://dandiarchive.org", text: "DANDI Archive" },
    " at a published version (or its draft), read from its copy in the Registry of Open Data on AWS. The notebook gets its file list; you pick which files to download.",
  ],
  picker: defineAsyncComponent(() => import("../DandiPicker.vue")),
  selection: () => ({ dataset: null, prefix: "" }),
  ready: (p) => !!p.dataset,
  label: (p) => (p.dataset ? `${p.dataset.name} (DANDI:${p.dataset.id}${p.prefix ? `/${p.prefix}` : ""}, ${p.dataset.version})` : ""),
  viewName,
  sameAs: (p, source) => source.openDataset === DANDI_REGISTRY && source.viewName === viewName(p),
  createView: (p) => createDandiView({ dandiset: p.dataset.id, version: p.dataset.version, title: dandiViewTitle(p.dataset), prefix: p.prefix }),
  folderName: (p, n) => addedSourceName(DANDI_REGISTRY, p.prefix || `${p.dataset.id}/`, n),
  count: () => countDandi(),
  regions: () => ["us-east-2"],
  size: (p) => p.dataset?.size || null,
  imaging: () => false,
  publicBucket: true,
  reads: (entry) => entry === DANDI_REGISTRY,
};
