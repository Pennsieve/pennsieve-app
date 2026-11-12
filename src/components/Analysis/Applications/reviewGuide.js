/*
  Help for an app's owner whose release declares no test inputs: app.yml has
  no `review` block (app-deploy-service docs/app-manifest-review.md), so the
  platform builds no fixtures, makes no sample run, and the release report
  has no figures or results.

  Pure helpers: whether to offer the help (reviewHelp), and a ready-to-paste
  review block for each way of declaring test inputs (reviewSnippet), built
  from the app's own input ports and parameters (the parsed app.yml).
*/

export const REVIEW_GUIDE_URL = "https://github.com/Pennsieve/app-deploy-service/blob/main/docs/app-manifest-review.md";

// The ways to declare test inputs, in the order the card offers them.
export const REVIEW_SOURCES = [
  {
    id: "generate",
    label: "A script in the repository",
    when: "The repository has (or can have) a small script that writes synthetic inputs. Best for most apps.",
  },
  {
    id: "files",
    label: "Committed files",
    when: "Small test files (a few MB) are committed to the repository.",
  },
  {
    id: "dataset",
    label: "A public dataset",
    when: "Realistic input is public on Zenodo, Figshare, OSF or OpenNeuro, and small enough (or a few files of it).",
  },
];

/*
  Whether to offer the help for a version: the owner's newest version whose
  fixtures were skipped because app.yml declares no review block.
*/
export function reviewHelp(version, { owner = false } = {}) {
  if (!owner || !version) return false;
  const fx = version.fixtures;
  return String(fx?.status || "").toLowerCase() === "skipped" && fx?.error?.code === "no_review_block";
}

// A file pattern for a port, from its first media type (a guess the author
// edits; "*" when there is no good one).
const EXTENSIONS = [
  [/anndata/, "*.h5ad"],
  [/nwb/, "*.nwb"],
  [/nifti|nii/, "*.nii.gz"],
  [/fcs/, "*.fcs"],
  [/edf/, "*.edf"],
  [/zarr/, "*.zarr"],
  [/^text\/csv/, "*.csv"],
  [/tab-separated|^text\/tsv/, "*.tsv"],
  [/json/, "*.json"],
  [/parquet/, "*.parquet"],
  [/hdf5/, "*.h5"],
  [/tiff/, "*.tif"],
  [/png/, "*.png"],
  [/zip/, "*.zip"],
];

export function portPattern(port) {
  const type = String((port?.mediaTypes || [])[0] || port?.dataType || "").toLowerCase();
  const hit = EXTENSIONS.find(([re]) => re.test(type));
  return hit ? hit[1] : "*";
}

// A YAML key: bare when safe, else quoted.
const key = (name) => (/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name) ? name : JSON.stringify(name));

/*
  The parameters lines: one commented line per parameter, its default
  shown, for the author to uncomment where the sample should run smaller or
  faster. None when the app declares no parameters.
*/
function parameterLines(parameters) {
  const named = (parameters || []).filter((p) => p?.name);
  if (!named.length) return [];
  const lines = ["  # Values for the sample run only (e.g. a smaller one); the rest keep their defaults:", "  # parameters:"];
  for (const p of named) {
    const dflt = p.defaultValue === null || p.defaultValue === undefined || p.defaultValue === "" ? "" : `  # default: ${p.defaultValue}`;
    lines.push(`  #   ${key(p.name)}: <value>${dflt}`);
  }
  return lines;
}

/*
  A review block for one source kind ("generate" | "files" | "dataset"),
  from the app's input ports and parameters, as YAML to paste at the end of
  app.yml. Placeholders the author must fill are in <angle brackets>.
*/
export function reviewSnippet(kind, { inputs = [], parameters = [] } = {}) {
  const ports = (inputs || []).filter((p) => p?.name);
  const lines = ["review:", "  version: 1"];
  if (kind === "generate" || !ports.length) {
    lines.push(
      "  generate:",
      "    # Runs from the repository root, in a Python 3.12 image (numpy, pandas,",
      "    # anndata, h5py, nibabel, ...) with no network. Write the inputs into",
      "    # $REVIEW_INPUT_DIR, laid out as the app reads INPUT_DIR.",
      '    command: python tests/make_fixture.py "$REVIEW_INPUT_DIR"'
    );
  } else {
    lines.push("  inputs:");
    for (const p of ports) {
      lines.push(`    ${key(p.name)}:`);
      if (kind === "files") {
        lines.push(`      files: ["tests/data/${portPattern(p)}"]`);
      } else {
        lines.push(`      dataset: { doi: <10.5281/zenodo.NNNNNNN>, files: ["${portPattern(p)}"] }`);
      }
    }
  }
  lines.push(...parameterLines(parameters));
  return lines.join("\n") + "\n";
}

/*
  The steps the card lists for a source kind, as plain sentences.
*/
export function reviewSteps(kind) {
  const first = {
    generate:
      "Add a small script to the repository (tests/make_fixture.py here) that writes a few tiny inputs, in the folders the app reads: synthetic data is fine.",
    files: "Commit a few small input files to the repository (tests/data/ here), at most a few MB in all.",
    dataset: "Pick a public dataset and, with files, a few of its files; replace the DOI placeholder.",
  }[kind];
  return [
    first,
    "Paste the block at the end of app.yml and adjust the paths or patterns.",
    "Commit, then cut a new release. Pennsieve builds the test inputs, runs the release on them and writes its release report with figures and results.",
  ];
}
