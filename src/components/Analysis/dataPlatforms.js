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
  // PhysioNet's open-access projects are in the Registry of Open Data on
  // AWS, one entry per project: a notebook takes a version's folder like
  // any Open Data dataset's (utils/physionet).
  physionet: {
    name: "PhysioNet",
    desc: "Physiological signals and clinical data: ECG, EEG, ICU",
    noun: "open projects",
  },
  // The Allen Institute's atlases, observatories and cell collections, each
  // an entry of the Registry of Open Data on AWS (utils/allen).
  allen: {
    name: "Allen Institute",
    desc: "Brain atlases, observatories and cell collections",
    noun: "datasets",
  },
};

// The platforms as the data pickers list them: one group, in this order.
export const PLATFORM_GROUPS = [
  { label: "Data platforms", keys: ["discover", "openData", "sparc", "epilepsyScience", "openNeuro", "bossdb", "dandi", "physionet", "allen"] },
];

// The groups with only the platforms offered (keys), empty groups left out.
export const groupsOf = (offered) =>
  PLATFORM_GROUPS.map((g) => ({ ...g, keys: g.keys.filter((k) => offered.includes(k)) })).filter((g) => g.keys.length);

// "1,213 datasets", or "" before the count is known.
export const platformCount = (n, noun) => (Number.isFinite(n) ? `${n.toLocaleString("en-US")} ${noun}` : "");
