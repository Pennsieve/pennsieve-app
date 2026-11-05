// The data platforms a notebook can take a dataset from, as the new notebook
// dialog and the session's Inputs panel present them. A dataset from either
// becomes a view: the notebook starts with its file list, and the user picks
// which files to download.
export const DATA_PLATFORMS = {
  discover: {
    name: "Pennsieve Discover",
    desc: "Published, citable research datasets",
    noun: "published datasets",
  },
  // OpenNeuro's datasets are in the Registry of Open Data on AWS; this
  // platform finds them with OpenNeuro's own search (utils/openNeuro).
  openNeuro: {
    name: "OpenNeuro",
    desc: "Open neuroimaging datasets, from its copy on AWS",
    noun: "public datasets",
  },
  openData: {
    name: "AWS Open Data",
    desc: "The Registry of Open Data on AWS",
    noun: "datasets",
  },
};

// "1,213 datasets", or "" before the count is known.
export const platformCount = (n, noun) => (Number.isFinite(n) ? `${n.toLocaleString("en-US")} ${noun}` : "");
