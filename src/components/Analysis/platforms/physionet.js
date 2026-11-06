// PhysioNet's open-access projects, each its own entry of the Registry of
// Open Data on AWS: a notebook takes a version's folder (utils/physionet).
import { defineAsyncComponent } from "vue";
import physionetMark from "@/assets/images/logos/physionet-mark.svg";
import { countPhysionet } from "@/utils/physionet";
import { openDataPlatform } from "./openDataPlatform";

export default openDataPlatform({
  key: "physionet",
  name: "PhysioNet",
  desc: "Physiological signals and clinical data: ECG, EEG, ICU",
  noun: "open projects",
  // Its logo's network, from its BSD-licensed repository.
  mark: { logo: physionetMark, tone: "light" },
  title: "Choose a PhysioNet project",
  intro: [
    "An open-access project from ",
    { href: "https://physionet.org", text: "PhysioNet" },
    " at a published version, read from its copy in the Registry of Open Data on AWS. The notebook gets its file list; you pick which files to download.",
  ],
  picker: defineAsyncComponent(() => import("../PhysionetPicker.vue")),
  // A version's folder (not the whole project, with every version and its
  // zip).
  ready: (p) => !!p.dataset && !!p.prefix,
  registry: (p) => p.dataset.name,
  viewTitle: (p) => p.dataset.title,
  label: (p) => (p.dataset ? `${p.dataset.title} (${p.dataset.name}/${p.prefix.replace(/\/$/, "")})` : ""),
  count: () => countPhysionet(),
  regions: () => ["us-east-1"],
  imaging: () => false,
});
