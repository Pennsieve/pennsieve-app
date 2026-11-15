// Starter code for a session file, by its type: a few small cells (load it,
// summarize it, plot it) the file browser offers on a file's Code action.
// They're templates, not generated: the same file always gets the same code,
// and a cell is only added, never run. The session image is slim, so the
// libraries a snippet needs come from the user's environment; its first line
// says which they are.
import { sessionPathCode } from "./pathCode";

const isR = (kernelName = "") => {
  const k = kernelName.toLowerCase();
  return k === "r" || k.startsWith("r ");
};

// A file's type, from its name: the longest known extension, so
// "a.nii.gz" is nii.gz and "a.csv.gz" is csv.
const TYPES = {
  csv: "table", "csv.gz": "table", tsv: "table", "tsv.gz": "table", txt: "table",
  parquet: "parquet",
  xlsx: "excel", xls: "excel",
  json: "json",
  nwb: "nwb",
  edf: "edf", bdf: "edf",
  h5: "hdf5", hdf5: "hdf5",
  h5ad: "h5ad",
  nii: "nifti", "nii.gz": "nifti",
  fcs: "fcs",
  npy: "npy",
  mat: "mat",
  png: "image", jpg: "image", jpeg: "image",
  tif: "tiff", tiff: "tiff",
};

export function fileKind(name) {
  const parts = String(name || "").toLowerCase().split("/").pop().split(".");
  for (let i = 1; i < parts.length; i++) {
    const kind = TYPES[parts.slice(i).join(".")];
    if (kind) return kind;
  }
  return null;
}

const needs = (...libs) => `# Needs ${libs.join(", ")} (from your environment)`;
const lines = (...l) => l.join("\n");

// Python snippets per kind: [{ id, label, title, code(p) }], p the file's
// path as code.
const PYTHON = {
  table: [
    { id: "load", label: "Load", title: "Read it into a pandas DataFrame", code: (p, sep) => lines(needs("pandas"), "import pandas as pd", "", `df = pd.read_csv(${p}${sep})`, "df.head()") },
    { id: "summary", label: "Summarize", title: "Columns, types and statistics", code: (p, sep) => lines(needs("pandas"), "import pandas as pd", "", `df = pd.read_csv(${p}${sep})`, "print(df.shape)", "df.describe(include=\"all\").T") },
    { id: "plot", label: "Plot", title: "A histogram of each numeric column", code: (p, sep) => lines(needs("pandas", "matplotlib"), "import pandas as pd", "import matplotlib.pyplot as plt", "", `df = pd.read_csv(${p}${sep})`, "df.select_dtypes(\"number\").hist(figsize=(10, 6), bins=30)", "plt.tight_layout()", "plt.show()") },
  ],
  parquet: [
    { id: "load", label: "Load", title: "Read it into a pandas DataFrame", code: (p) => lines(needs("pandas", "pyarrow"), "import pandas as pd", "", `df = pd.read_parquet(${p})`, "df.head()") },
    { id: "summary", label: "Summarize", title: "Columns, types and statistics", code: (p) => lines(needs("pandas", "pyarrow"), "import pandas as pd", "", `df = pd.read_parquet(${p})`, "print(df.shape)", "df.describe(include=\"all\").T") },
    { id: "plot", label: "Plot", title: "A histogram of each numeric column", code: (p) => lines(needs("pandas", "pyarrow", "matplotlib"), "import pandas as pd", "import matplotlib.pyplot as plt", "", `df = pd.read_parquet(${p})`, "df.select_dtypes(\"number\").hist(figsize=(10, 6), bins=30)", "plt.tight_layout()", "plt.show()") },
  ],
  excel: [
    { id: "load", label: "Load", title: "Read its sheets into pandas DataFrames", code: (p) => lines(needs("pandas", "openpyxl"), "import pandas as pd", "", `sheets = pd.read_excel(${p}, sheet_name=None)  # every sheet, by name`, "for name, df in sheets.items():", "    print(name, df.shape)", "df = next(iter(sheets.values()))", "df.head()") },
    { id: "summary", label: "Summarize", title: "Columns, types and statistics of the first sheet", code: (p) => lines(needs("pandas", "openpyxl"), "import pandas as pd", "", `df = pd.read_excel(${p})`, "print(df.shape)", "df.describe(include=\"all\").T") },
  ],
  json: [
    { id: "load", label: "Load", title: "Read it with the json module", code: (p) => lines("import json", "", `with open(${p}) as f:`, "    data = json.load(f)", "type(data)") },
    { id: "summary", label: "Summarize", title: "Its top-level keys or length", code: (p) => lines("import json", "", `with open(${p}) as f:`, "    data = json.load(f)", "if isinstance(data, dict):", "    for key, value in data.items():", "        print(f\"{key}: {type(value).__name__}\")", "else:", "    print(f\"{type(data).__name__} of {len(data)}\")") },
  ],
  nwb: [
    { id: "load", label: "Load", title: "Open it with pynwb (data is read when you index it)", code: (p) => lines(needs("pynwb"), "from pynwb import NWBHDF5IO", "", `io = NWBHDF5IO(${p}, mode="r")`, "nwb = io.read()", "nwb") },
    { id: "summary", label: "Summarize", title: "What it holds: acquisition, processing, units", code: (p) => lines(needs("pynwb"), "from pynwb import NWBHDF5IO", "", `io = NWBHDF5IO(${p}, mode="r")`, "nwb = io.read()", "print(nwb.session_description, nwb.session_start_time)", "print(\"acquisition:\", list(nwb.acquisition))", "for name, module in nwb.processing.items():", "    print(f\"processing/{name}:\", list(module.data_interfaces))", "if nwb.units is not None:", "    print(\"units:\", len(nwb.units))") },
    { id: "plot", label: "Plot", title: "The first 10 s of its first acquired time series", code: (p) => lines(needs("pynwb", "matplotlib"), "import numpy as np", "import matplotlib.pyplot as plt", "from pynwb import NWBHDF5IO", "", `io = NWBHDF5IO(${p}, mode="r")`, "nwb = io.read()", "ts = next(v for v in nwb.acquisition.values() if hasattr(v, \"data\"))", "rate = ts.rate or 1 / np.median(np.diff(ts.timestamps[:1000]))", "n = int(10 * rate)", "data = np.asarray(ts.data[:n])", "t = np.arange(len(data)) / rate", "plt.figure(figsize=(10, 4))", "plt.plot(t, data.reshape(len(data), -1)[:, :8], lw=0.6)  # up to 8 channels", "plt.xlabel(\"time (s)\")", "plt.title(ts.name)", "plt.show()") },
  ],
  edf: [
    { id: "load", label: "Load", title: "Open it with MNE (data is read when you ask)", code: (p) => lines(needs("mne"), "import mne", "", `raw = mne.io.read_raw(${p}, preload=False)`, "raw") },
    { id: "summary", label: "Summarize", title: "Channels, sampling rate and duration", code: (p) => lines(needs("mne"), "import mne", "", `raw = mne.io.read_raw(${p}, preload=False)`, "print(f\"{len(raw.ch_names)} channels, {raw.info['sfreq']} Hz, {raw.times[-1]:.0f} s\")", "print(raw.ch_names)") },
    { id: "plot", label: "Plot", title: "The first 10 s of up to 16 channels, stacked", code: (p) => lines(needs("mne", "matplotlib"), "import numpy as np", "import matplotlib.pyplot as plt", "import mne", "", `raw = mne.io.read_raw(${p}, preload=False)`, "picks = raw.ch_names[:16]", "data, t = raw.get_data(picks=picks, tmin=0, tmax=10, return_times=True)", "offset = np.nanmax(np.ptp(data, axis=1)) or 1", "plt.figure(figsize=(10, 6))", "for i, row in enumerate(data):", "    plt.plot(t, row - i * offset, lw=0.5)", "plt.yticks([-i * offset for i in range(len(picks))], picks)", "plt.xlabel(\"time (s)\")", "plt.show()") },
  ],
  hdf5: [
    { id: "load", label: "Load", title: "Open it with h5py (data is read when you index it)", code: (p) => lines(needs("h5py"), "import h5py", "", `f = h5py.File(${p}, "r")`, "list(f)") },
    { id: "summary", label: "Summarize", title: "Its groups and datasets, with shapes", code: (p) => lines(needs("h5py"), "import h5py", "", "def show(name, obj):", "    if isinstance(obj, h5py.Dataset):", "        print(f\"{name}  {obj.shape} {obj.dtype}\")", "", `with h5py.File(${p}, "r") as f:`, "    f.visititems(show)") },
  ],
  h5ad: [
    { id: "load", label: "Load", title: "Open it with anndata, backed (not read into memory)", code: (p) => lines(needs("anndata"), "import anndata as ad", "", `adata = ad.read_h5ad(${p}, backed="r")`, "adata") },
    { id: "summary", label: "Summarize", title: "Cells, genes and annotations", code: (p) => lines(needs("anndata"), "import anndata as ad", "", `adata = ad.read_h5ad(${p}, backed="r")`, "print(adata)", "adata.obs.head()") },
  ],
  nifti: [
    { id: "load", label: "Load", title: "Open it with nibabel", code: (p) => lines(needs("nibabel"), "import nibabel as nib", "", `img = nib.load(${p})`, "print(img.shape, img.header.get_zooms())", "img") },
    { id: "plot", label: "Plot", title: "Its middle slice in each direction", code: (p) => lines(needs("nibabel", "matplotlib"), "import numpy as np", "import nibabel as nib", "import matplotlib.pyplot as plt", "", `img = nib.load(${p})`, "vol = np.asanyarray(img.dataobj)", "vol = vol[..., 0] if vol.ndim > 3 else vol  # the first volume of a 4D image", "x, y, z = (s // 2 for s in vol.shape[:3])", "fig, axes = plt.subplots(1, 3, figsize=(12, 4))", "for ax, sl in zip(axes, (vol[x, :, :], vol[:, y, :], vol[:, :, z])):", "    ax.imshow(np.rot90(sl), cmap=\"gray\")", "    ax.axis(\"off\")", "plt.show()") },
  ],
  fcs: [
    { id: "load", label: "Load", title: "Read its events into a pandas DataFrame", code: (p) => lines(needs("flowkit"), "import flowkit as fk", "", `sample = fk.Sample(${p})`, "df = sample.as_dataframe(source=\"raw\")", "df.head()") },
    { id: "summary", label: "Summarize", title: "Events and channels", code: (p) => lines(needs("flowkit"), "import flowkit as fk", "", `sample = fk.Sample(${p})`, "print(sample.event_count, \"events\")", "sample.channels") },
    { id: "plot", label: "Plot", title: "Forward against side scatter (or its first two channels)", code: (p) => lines(needs("flowkit", "matplotlib"), "import flowkit as fk", "import matplotlib.pyplot as plt", "", `sample = fk.Sample(${p})`, "df = sample.as_dataframe(source=\"raw\")", "df.columns = df.columns.get_level_values(0)", "x, y = (\"FSC-A\", \"SSC-A\") if {\"FSC-A\", \"SSC-A\"} <= set(df.columns) else df.columns[:2]", "plt.figure(figsize=(5, 5))", "plt.hexbin(df[x], df[y], gridsize=150, bins=\"log\", cmap=\"viridis\")", "plt.xlabel(x)", "plt.ylabel(y)", "plt.show()") },
  ],
  npy: [
    { id: "load", label: "Load", title: "Open it with NumPy, memory-mapped", code: (p) => lines(needs("numpy"), "import numpy as np", "", `arr = np.load(${p}, mmap_mode="r")`, "print(arr.shape, arr.dtype)") },
    { id: "plot", label: "Plot", title: "A line for 1-D data, an image for 2-D", code: (p) => lines(needs("numpy", "matplotlib"), "import numpy as np", "import matplotlib.pyplot as plt", "", `arr = np.load(${p}, mmap_mode="r")`, "plt.figure(figsize=(10, 4))", "if arr.ndim == 1:", "    plt.plot(arr[:100_000])", "else:", "    plt.imshow(arr.reshape(arr.shape[0], -1)[:2000, :2000], aspect=\"auto\")", "    plt.colorbar()", "plt.show()") },
  ],
  mat: [
    { id: "load", label: "Load", title: "Read its variables with SciPy (v7.3 files are HDF5: use h5py)", code: (p) => lines(needs("scipy"), "from scipy.io import loadmat", "", `mat = loadmat(${p}, squeeze_me=True)`, "{k: getattr(v, \"shape\", type(v).__name__) for k, v in mat.items() if not k.startswith(\"__\")}") },
  ],
  image: [
    { id: "plot", label: "Show", title: "Show it with matplotlib", code: (p) => lines(needs("matplotlib"), "import matplotlib.pyplot as plt", "", `img = plt.imread(${p})`, "print(img.shape)", "plt.imshow(img)", "plt.axis(\"off\")", "plt.show()") },
  ],
  tiff: [
    { id: "load", label: "Load", title: "Read it with tifffile", code: (p) => lines(needs("tifffile"), "import tifffile", "", `img = tifffile.imread(${p})`, "print(img.shape, img.dtype)") },
    { id: "plot", label: "Show", title: "Show it (the first plane of a stack)", code: (p) => lines(needs("tifffile", "matplotlib"), "import tifffile", "import matplotlib.pyplot as plt", "", `img = tifffile.imread(${p})`, "plane = img if img.ndim == 2 or (img.ndim == 3 and img.shape[-1] in (3, 4)) else img.reshape(-1, *img.shape[-2:])[0]", "plt.imshow(plane, cmap=\"gray\" if plane.ndim == 2 else None)", "plt.axis(\"off\")", "plt.show()") },
  ],
};

// R has fewer: tables, with base R only.
const R = {
  table: [
    { id: "load", label: "Load", title: "Read it into a data frame", code: (p, sep) => lines(`df <- read.csv(${p}${sep})`, "head(df)") },
    { id: "summary", label: "Summarize", title: "Columns, types and statistics", code: (p, sep) => lines(`df <- read.csv(${p}${sep})`, "str(df)", "summary(df)") },
    { id: "plot", label: "Plot", title: "A histogram of each numeric column", code: (p, sep) => lines(`df <- read.csv(${p}${sep})`, "num <- df[sapply(df, is.numeric)]", "par(mfrow = c(ceiling(ncol(num) / 3), 3), mar = c(4, 4, 2, 1))", "for (col in names(num)) hist(num[[col]], main = col, xlab = \"\")") },
  ],
};

// Tab-separated tables need their separator said.
function separator(name, r) {
  if (!/\.(tsv|txt)(\.gz)?$/i.test(name)) return "";
  return r ? `, sep = "\\t"` : `, sep="\\t"`;
}

// The snippets for a session file: [{ id, label, title, code }], or [] when
// its type has none for the kernel's language.
export function fileSnippets(path, kernelName = "") {
  const kind = fileKind(path);
  const r = isR(kernelName);
  const list = (r ? R : PYTHON)[kind] || [];
  if (!list.length) return [];
  const p = sessionPathCode(path, kernelName);
  const sep = separator(path, r);
  return list.map(({ id, label, title, code }) => ({ id, label, title, code: code(p, sep) }));
}
