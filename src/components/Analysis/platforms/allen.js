// The Allen Institute's open datasets: the Open Data catalog's allen-
// entries (utils/allen), chosen with OpenDataPicker from that part of it.
import { defineAsyncComponent } from "vue";
import allenMark from "@/assets/images/logos/allen-mark.svg";
import { isAllenEntry, countAllen } from "@/utils/allen";
import { openDataPlatform } from "./openDataPlatform";

export default openDataPlatform({
  key: "allen",
  name: "Allen Institute",
  desc: "Brain atlases, observatories and cell collections",
  noun: "datasets",
  // Its logo's a/, with its blessing.
  mark: { logo: allenMark, tone: "light" },
  title: "Choose an Allen Institute dataset",
  intro: [
    "A dataset from the ",
    { href: "https://alleninstitute.org/open-science/", text: "Allen Institute" },
    " in the Registry of Open Data on AWS, and the folder of it to take. Most are large: open a folder to start with less. The notebook gets its file list; you pick which files to download.",
  ],
  picker: defineAsyncComponent(() => import("../OpenDataPicker.vue")),
  pickerProps: { only: isAllenEntry, source: "Allen Institute" },
  registry: (p) => p.dataset.name,
  viewTitle: (p) => p.dataset.title,
  count: () => countAllen(),
  reads: (entry) => isAllenEntry({ name: entry, anonymous: true }),
});
