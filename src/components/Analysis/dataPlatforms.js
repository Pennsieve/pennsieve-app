// The data platforms a notebook can take a dataset from, as the new notebook
// dialog and the session's Inputs panel present them, in this order. A
// dataset from any of them becomes a view: the notebook starts with its file
// list, and the user picks which files to download.
export const DATA_PLATFORMS = {
  discover: {
    name: "Pennsieve Discover",
    desc: "Published, citable research datasets",
    noun: "published datasets",
  },
  openData: {
    name: "AWS Open Data",
    desc: "The Registry of Open Data on AWS",
    noun: "datasets",
  },
  // Data portals on Pennsieve Discover whose datasets are also in the
  // Registry of Open Data on AWS: a notebook reads them from there
  // (utils/openDataPortals). SPARC's include RE-JOIN's and PRECISION's.
  sparc: {
    name: "SPARC",
    desc: "The peripheral nervous system, with RE-JOIN and PRECISION",
    noun: "datasets",
  },
  epilepsyScience: {
    name: "Epilepsy.Science",
    desc: "Clinical and pre-clinical epilepsy research",
    noun: "datasets",
  },
  // OpenNeuro's datasets are in the Registry of Open Data on AWS; this
  // platform finds them with OpenNeuro's own search (utils/openNeuro).
  openNeuro: {
    name: "OpenNeuro",
    desc: "Open neuroimaging datasets, from its copy on AWS",
    noun: "public datasets",
  },
  // BossDB's public volumes are in the Registry of Open Data on AWS, one
  // Neuroglancer precomputed volume per channel: found with BossDB's own API
  // (utils/bossdb), read in place.
  bossdb: {
    name: "BossDB",
    desc: "Electron microscopy and connectomics volumes",
    noun: "collections",
  },
  // The DANDI Archive's dandisets are in the Registry of Open Data on AWS,
  // as files stored by content: a notebook takes a dandiset version as
  // views-service's own kind of source (utils/dandi).
  dandi: {
    name: "DANDI",
    desc: "Neurophysiology data, mostly NWB, from the DANDI Archive",
    noun: "dandisets",
  },
};

// "1,213 datasets", or "" before the count is known.
export const platformCount = (n, noun) => (Number.isFinite(n) ? `${n.toLocaleString("en-US")} ${noun}` : "");
