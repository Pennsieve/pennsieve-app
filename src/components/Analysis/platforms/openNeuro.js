// OpenNeuro's datasets, from its copy in the Registry of Open Data on AWS
// (the openneuro entry, a folder per dataset), found with OpenNeuro's own
// search (utils/openNeuro).
import { defineAsyncComponent } from "vue";
import openNeuroMark from "@/assets/images/logos/openneuro-mark.svg";
import { OPENNEURO_REGISTRY, countOpenNeuro } from "@/utils/openNeuro";
import { imagingTerms, openDataPlatform } from "./openDataPlatform";

export default openDataPlatform({
  key: "openNeuro",
  name: "OpenNeuro",
  desc: "Open neuroimaging datasets, from its copy on AWS",
  noun: "public datasets",
  // Its logo's cube, from its MIT-licensed repository.
  mark: { logo: openNeuroMark, tone: "light" },
  title: "Choose an OpenNeuro dataset",
  intro: [
    "A dataset from ",
    { href: "https://openneuro.org", text: "OpenNeuro" },
    ", read from its copy in the Registry of Open Data on AWS at its latest version. The notebook gets its file list; you pick which files to download.",
  ],
  picker: defineAsyncComponent(() => import("../OpenNeuroPicker.vue")),
  registry: () => OPENNEURO_REGISTRY,
  viewTitle: (p) => p.dataset.name,
  label: (p) => (p.dataset ? `${p.dataset.name} (${p.prefix || p.dataset.id})` : ""),
  count: () => countOpenNeuro(),
  regions: () => ["us-east-1"],
  size: (p) => p.dataset?.size || null,
  imaging: (p) => imagingTerms(p.dataset?.modalities),
  reads: (entry) => entry === OPENNEURO_REGISTRY,
});
