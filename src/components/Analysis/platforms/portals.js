// Data portals built on Pennsieve Discover whose datasets are also in the
// Registry of Open Data on AWS (utils/openDataPortals): a notebook reads a
// dataset's folder from there, at its latest version. SPARC's include
// RE-JOIN's and PRECISION's.
import { defineAsyncComponent } from "vue";
import sparcLogo from "@/assets/images/logos/sparc-logo.svg";
import epilepsyScienceLogo from "@/assets/images/logos/epilepsy-science-logo.svg";
import { OPEN_DATA_PORTALS, portalDatasetIds } from "@/utils/openDataPortals";
import { imagingTerms, openDataPlatform } from "./openDataPlatform";

const PortalPicker = defineAsyncComponent(() => import("../PortalPicker.vue"));

function portal(key, { name, desc, mark }) {
  const { registry, url } = OPEN_DATA_PORTALS[key];
  return openDataPlatform({
    key,
    name,
    desc,
    noun: "datasets",
    mark,
    title: `Choose a ${name} dataset`,
    intro: [
      "A dataset published on ",
      { href: url, text: name },
      ", read from its copy in the Registry of Open Data on AWS at its latest version. The notebook gets its file list; you pick which files to download.",
    ],
    picker: PortalPicker,
    pickerProps: { portal: key },
    registry: () => registry,
    viewTitle: (p) => p.dataset.name,
    // Its name, and the folder when it's below the dataset's own.
    label: (p) => {
      if (!p.dataset) return "";
      const f = p.prefix.replace(/\/$/, "");
      return f && f !== String(p.dataset.id) ? `${p.dataset.name} (${f})` : p.dataset.name;
    },
    count: () => portalDatasetIds(key).then((ids) => ids.length),
    regions: () => ["us-east-1"],
    imaging: (p) => imagingTerms(p.dataset?.keywords),
    reads: (entry) => entry === registry,
  });
}

export const sparc = portal("sparc", {
  name: "SPARC",
  desc: "The peripheral nervous system, with RE-JOIN and PRECISION",
  mark: { logo: sparcLogo, tone: "light" },
});

// Its mark is square with its own background: it fills the tile.
export const epilepsyScience = portal("epilepsyScience", {
  name: "Epilepsy.Science",
  desc: "Clinical and pre-clinical epilepsy research",
  mark: { logo: epilepsyScienceLogo, tone: "fill" },
});
