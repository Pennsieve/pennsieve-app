// Any dataset of the Registry of Open Data on AWS anyone can read, from
// views-service's catalog.
import { defineAsyncComponent } from "vue";
import IconOpenData from "@/components/icons/IconOpenData.vue";
import { openDataCatalog } from "@/utils/viewsService";
import { openDataPlatform } from "./openDataPlatform";

export default openDataPlatform({
  key: "openData",
  name: "AWS Open Data",
  desc: "The Registry of Open Data on AWS",
  noun: "datasets",
  // A neutral cloud and data store, not AWS's logo.
  mark: { icon: IconOpenData, iconProps: (s) => ({ width: Math.round(s * 0.6), height: Math.round(s * 0.6) }), tone: "teal" },
  title: "Choose an AWS Open Data dataset",
  intro: [
    "A dataset from the ",
    { href: "https://registry.opendata.aws/", text: "Registry of Open Data on AWS" },
    ", and the folder of it to take. The notebook gets its file list; you pick which files to download.",
  ],
  picker: defineAsyncComponent(() => import("../OpenDataPicker.vue")),
  registry: (p) => p.dataset.name,
  viewTitle: (p) => p.dataset.title,
  count: () => openDataCatalog().then((list) => list.filter((d) => d.anonymous).length),
});
