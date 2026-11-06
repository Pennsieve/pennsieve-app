// The International Brain Laboratory's open datasets: the Open Data
// catalog's IBL entries (utils/ibl), chosen with OpenDataPicker from that
// part of it.
import { defineAsyncComponent } from "vue";
import iblLogo from "@/assets/images/logos/ibl-logo.png";
import { isIblEntry, countIbl, IBL_PUBLISHER } from "@/utils/ibl";
import { openDataPlatform } from "./openDataPlatform";

export default openDataPlatform({
  key: "ibl",
  name: "International Brain Laboratory",
  desc: "Neuropixels recordings and behaviour across the mouse brain",
  noun: "datasets",
  // Its logo, from its MIT-licensed ibllib.
  mark: { logo: iblLogo, tone: "light" },
  title: "Choose an IBL dataset",
  intro: [
    "A dataset from the ",
    { href: "https://www.internationalbrainlab.com", text: "International Brain Laboratory" },
    " in the Registry of Open Data on AWS, and the folder of it to take: its recordings are under data/, by lab, subject, date and session. Open a folder to start with less. The notebook gets its file list; you pick which files to download.",
  ],
  picker: defineAsyncComponent(() => import("../OpenDataPicker.vue")),
  pickerProps: ({ datasetNote }) => ({ only: isIblEntry, source: "International Brain Laboratory", cardNote: datasetNote }),
  registry: (p) => p.dataset.name,
  viewTitle: (p) => p.dataset.title,
  count: () => countIbl(),
  regions: (p) => p.dataset?.regions || [],
  reads: (entry, publisher) => publisher === IBL_PUBLISHER,
});
