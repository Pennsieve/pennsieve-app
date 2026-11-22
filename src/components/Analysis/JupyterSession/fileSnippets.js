// Starter code for a session file, by its type, or for a stack, by its
// format: a few small cells (load it, summarize it, plot it) the file
// browser offers on a file's Code action.
// They're templates, not generated: the same file always gets the same code,
// and a cell is only added, never run. The session image is slim, so the
// libraries a snippet needs come from the user's environment; its first
// lines say it's a template and which libraries it needs.
import { httpsOf, sessionPathCode, stackCode } from "./pathCode";

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

// Every snippet says first what it is: a template for the file's type, not
// code checked against this file.
export const STARTER_NOTE = "# Starter code for this type of file: it may need changes to work on yours";
const noted = (code) => `${STARTER_NOTE}\n${code}`;

const needs = (...libs) => `# Needs ${libs.join(", ")} (from your environment)`;
const lines = (...l) => l.join("\n");

// DuckDB within half the session's memory: by default it takes most of the
// machine's, which a notebook shares with Jupyter (a CPU session's machine is
// its own Fargate task, a GPU session's its whole instance).
const duckdbConnect = lines(
  "import duckdb, os",
  "from pathlib import Path",
  "",
  "# DuckDB within half the session's memory (Jupyter and your other cells need the rest)",
  "con = duckdb.connect(config={\"memory_limit\": f\"{os.sysconf('SC_PAGE_SIZE') * os.sysconf('SC_PHYS_PAGES') // 2**21}MiB\"})",
);

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

/* ------------------------------------------------------------ stacks --- */
// A stack (a Zarr, a precomputed volume, a whole-slide image) is read in
// place from S3, so a plot reads its lowest resolution only: a few chunks,
// not the whole stack. Load is stackCode's, as the Code action always gave.

const zarrOpen = (e) => {
  const options = e.region ? `{"anon": True, "client_kwargs": {"region_name": ${JSON.stringify(e.region)}}}` : `{"anon": True}`;
  return `z = zarr.open(${JSON.stringify(e.location)}, mode="r", storage_options=${options})`;
};
const fsOpen = (e) => {
  const region = e.region ? `, client_kwargs={"region_name": ${JSON.stringify(e.region)}}` : "";
  return `fs = s3fs.S3FileSystem(anon=True, default_block_size=500_000${region})`;
};
// fill: missing chunks read as zeros, not EmptyVolumeException. Volumes
// often lack some (a level they list but hold no data for, sections at the
// edge), and a picture shouldn't fail on them.
const volumeOpen = (e, fill = false) =>
  `vol = CloudVolume(${JSON.stringify(`precomputed://${httpsOf(e.location, e.region)}`)}, mip=0, progress=False${fill ? ", fill_missing=True)  # missing chunks read as zeros" : ")"}`;

// The levels to try for a picture at most `across` voxels wide: the finest
// that fits first, then coarser ones, then finer ones.
const mipOrder = (across) => [
  `small = [m for m in vol.available_mips if max(vol.mip_volume_size(m)[:2]) <= ${across}]`,
  "mips = small + [m for m in reversed(vol.available_mips) if m not in small]",
];

const STACKS = {
  zarr: [
    { id: "summary", label: "Summarize", title: "Its arrays: shapes, types and chunks", code: (e) => lines(needs("zarr", "s3fs"), "import zarr", "", zarrOpen(e), "", "def show(node, prefix=\"\"):", "    if isinstance(node, zarr.Array):", "        print(f\"{prefix or '/'}  {node.shape} {node.dtype} chunks {node.chunks}\")", "        return", "    for name, arr in node.arrays():", "        show(arr, f\"{prefix}/{name}\")", "    for name, group in node.groups():", "        show(group, f\"{prefix}/{name}\")", "", "show(z)") },
    { id: "plot", label: "Plot", title: "An array at most 1024 across (a 2-D plane, or a line for 1-D)", code: (e) => lines(needs("zarr", "s3fs", "matplotlib"), "import numpy as np", "import zarr", "import matplotlib.pyplot as plt", "", zarrOpen(e), "", "def arrays(node):", "    if isinstance(node, zarr.Array):", "        yield node", "        return", "    for _, arr in node.arrays():", "        yield arr", "    for _, group in node.groups():", "        yield from arrays(group)", "", "found = list(arrays(z))", "fits = [x for x in found if max(x.shape[-2:]) <= 1024]", "# The largest that's at most 1024 across (a resolution level of a pyramid), else the smallest", "a = max(fits, key=lambda x: x.size) if fits else min(found, key=lambda x: x.size)", "plt.figure(figsize=(8, 6))", "if a.ndim == 1:", "    plt.plot(a[:100_000])", "else:", "    step = [max(1, s // 1024) for s in a.shape[-2:]]", "    plane = a[(0,) * (a.ndim - 2) + (slice(None, None, step[0]), slice(None, None, step[1]))]", "    plt.imshow(np.asarray(plane), cmap=\"gray\")", "    plt.colorbar()", "plt.title(f\"{a.name} {a.shape}\")", "plt.show()") },
  ],
  "ome-zarr": [
    { id: "summary", label: "Summarize", title: "Its axes, resolution levels and channels", code: (e) => lines(needs("zarr", "s3fs"), "import zarr", "", zarrOpen(e), "attrs = z.attrs.asdict()", "attrs = attrs.get(\"ome\", attrs)  # OME-Zarr 0.5 keeps them under \"ome\"", "ms = attrs[\"multiscales\"][0]", "axes = [a if isinstance(a, str) else a[\"name\"] for a in ms.get(\"axes\", \"tczyx\")]", "print(\"axes:\", axes)", "for d in ms[\"datasets\"]:", "    arr = z[d[\"path\"]]", "    print(f\"level {d['path']}: {arr.shape} {arr.dtype}\")", "for c in attrs.get(\"omero\", {}).get(\"channels\", []):", "    print(\"channel:\", c.get(\"label\"))") },
    { id: "plot", label: "Plot", title: "The middle plane of up to 3 channels, at a level at most 1024 across", code: (e) => lines(needs("zarr", "s3fs", "matplotlib"), "import numpy as np", "import zarr", "import matplotlib.pyplot as plt", "", zarrOpen(e), "attrs = z.attrs.asdict()", "attrs = attrs.get(\"ome\", attrs)", "ms = attrs[\"multiscales\"][0]", "axes = [a if isinstance(a, str) else a[\"name\"] for a in ms.get(\"axes\", \"tczyx\")]", "levels = [z[d[\"path\"]] for d in ms[\"datasets\"]]  # finest first", "# The finest level that's at most 1024 across, else the coarsest", "arr = next((a for a in levels if max(a.shape[-2:]) <= 1024), levels[-1])", "", "def plane(channel):", "    at = {\"t\": 0, \"c\": channel, \"z\": arr.shape[axes.index(\"z\")] // 2 if \"z\" in axes else 0}", "    return np.asarray(arr[tuple(at.get(a, slice(None)) for a in axes)])", "", "channels = min(3, arr.shape[axes.index(\"c\")]) if \"c\" in axes else 1", "fig, ax = plt.subplots(1, channels, figsize=(5 * channels, 5), squeeze=False)", "for c in range(channels):", "    ax[0, c].imshow(plane(c), cmap=\"gray\")", "    ax[0, c].set_title(f\"channel {c}, level {arr.shape}\")", "    ax[0, c].axis(\"off\")", "plt.show()") },
  ],
  "neuroglancer-precomputed": [
    { id: "summary", label: "Summarize", title: "Its type, channels and resolution levels", code: (e) => lines(needs("cloud-volume"), "from cloudvolume import CloudVolume", "", volumeOpen(e), "print(vol.layer_type, vol.dtype, vol.num_channels, \"channel(s)\")", "for mip, scale in enumerate(vol.info[\"scales\"]):", "    print(f\"mip {mip}: {scale['size']} voxels at {scale['resolution']} nm\")") },
    { id: "plot", label: "Plot", title: "Its middle z plane, at a level at most 1024 voxels across", code: (e) => lines(needs("cloud-volume", "matplotlib"), "import numpy as np", "import matplotlib.pyplot as plt", "from cloudvolume import CloudVolume", "", volumeOpen(e, true), ...mipOrder(1024), "for mip in mips:", "    vol.mip = mip", "    b = vol.bounds", "    z = int((b.minpt[2] + b.maxpt[2]) // 2)", "    img = np.asarray(vol[b.minpt[0]:b.maxpt[0], b.minpt[1]:b.maxpt[1], z])[:, :, 0, 0].T", "    if img.any():  # a level without data reads as zeros: try the next", "        break", "else:", "    raise ValueError(\"No level of this volume has data at its middle z plane, or its chunks can't be read from here\")", "plt.figure(figsize=(8, 8))", "plt.imshow(img, cmap=\"tab20\" if vol.layer_type == \"segmentation\" else \"gray\", interpolation=\"nearest\")", "plt.title(f\"z = {z}, mip {vol.mip}\")", "plt.axis(\"off\")", "plt.show()") },
    { id: "slices", label: "Slices", title: "Its middle plane along z, y and x, at a level at most 512 voxels across", code: (e) => lines(needs("cloud-volume", "matplotlib"), "import numpy as np", "import matplotlib.pyplot as plt", "from cloudvolume import CloudVolume", "", volumeOpen(e, true), ...mipOrder(512), "for mip in mips:", "    vol.mip = mip", "    b = vol.bounds", "    x, y, z = (int((lo + hi) // 2) for lo, hi in zip(b.minpt, b.maxpt))", "    zplane = np.asarray(vol[b.minpt[0]:b.maxpt[0], b.minpt[1]:b.maxpt[1], z])[:, :, 0, 0].T", "    if zplane.any():  # a level without data reads as zeros: try the next", "        break", "else:", "    raise ValueError(\"No level of this volume has data at its middle z plane, or its chunks can't be read from here\")", "rx, ry, rz = vol.resolution", "planes = [", "    (\"z\", zplane, ry / rx),", "    (\"y\", np.asarray(vol[b.minpt[0]:b.maxpt[0], y, b.minpt[2]:b.maxpt[2]])[:, 0, :, 0].T, rz / rx),", "    (\"x\", np.asarray(vol[x, b.minpt[1]:b.maxpt[1], b.minpt[2]:b.maxpt[2]])[0, :, :, 0].T, rz / ry),", "]", "cmap = \"tab20\" if vol.layer_type == \"segmentation\" else \"gray\"", "fig, axes = plt.subplots(1, 3, figsize=(15, 5))", "for ax, (axis, img, aspect) in zip(axes, planes):", "    ax.imshow(img, cmap=cmap, aspect=aspect, interpolation=\"nearest\")", "    ax.set_title(f\"middle {axis} plane, mip {vol.mip}\")", "    ax.axis(\"off\")", "plt.show()") },
    { id: "crop", label: "Crop", title: "A 512 x 512 patch from its centre, at full resolution", code: (e) => lines(needs("cloud-volume", "matplotlib"), "import numpy as np", "import matplotlib.pyplot as plt", "from cloudvolume import CloudVolume", "", volumeOpen(e), "b = vol.bounds", "x, y, z = (int((lo + hi) // 2) for lo, hi in zip(b.minpt, b.maxpt))", "x0, y0 = max(b.minpt[0], x - 256), max(b.minpt[1], y - 256)", "x1, y1 = min(b.maxpt[0], x0 + 512), min(b.maxpt[1], y0 + 512)", "crop = np.asarray(vol[x0:x1, y0:y1, z])[:, :, 0, 0].T  # rows are y", "print(f\"{crop.shape} {crop.dtype} at x {x0}:{x1}, y {y0}:{y1}, z {z}; voxels {vol.resolution.tolist()} nm\")", "plt.figure(figsize=(8, 8))", "plt.imshow(crop, cmap=\"tab20\" if vol.layer_type == \"segmentation\" else \"gray\", interpolation=\"nearest\")", "plt.axis(\"off\")", "plt.show()") },
    { id: "save", label: "Save", title: "Save a 512 x 512 x 16 block from its centre to output/ (NumPy)", code: (e) => lines(needs("cloud-volume"), "import json", "import numpy as np", "from cloudvolume import CloudVolume", "", volumeOpen(e), "b = vol.bounds", "size = np.array([512, 512, 16])", "lo = np.maximum(b.minpt, (b.minpt + b.maxpt) // 2 - size // 2)", "hi = np.minimum(b.maxpt, lo + size)", "block = np.asarray(vol[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]])[..., 0]  # x, y, z", `name = ${JSON.stringify(String(e.cratePath || "volume").replace(/\/$/, "").replace(/\//g, "-"))}`, "np.save(OUTPUT_DIR / f\"{name}-block.npy\", block)", "(OUTPUT_DIR / f\"{name}-block.json\").write_text(json.dumps({", "    \"source\": vol.cloudpath, \"mip\": vol.mip, \"offset_xyz\": lo.tolist(),", "    \"shape_xyz\": list(block.shape), \"resolution_nm\": list(map(float, vol.resolution)),", "}, indent=2))", "print(f\"Saved {block.shape} {block.dtype} to output/{name}-block.npy\")") },
  ],
  "dicom-wsi": [
    { id: "summary", label: "Summarize", title: "Its levels: size and kind (headers only)", code: (e) => lines(needs("s3fs", "pydicom"), "import s3fs, pydicom", "", fsOpen(e), `for path in sorted(fs.ls(${JSON.stringify(e.location)}), key=fs.size):`, "    ds = pydicom.dcmread(fs.open(path, \"rb\"), stop_before_pixels=True)", "    kind = ds.ImageType[2] if len(ds.ImageType) > 2 else \"\"", "    print(f\"{ds.TotalPixelMatrixColumns} x {ds.TotalPixelMatrixRows}  {kind:8} {fs.size(path) / 1e6:.0f} MB  {path.rsplit('/', 1)[-1]}\")") },
    { id: "plot", label: "Show", title: "A thumbnail: its smallest pyramid level", code: (e) => lines(needs("s3fs", "pydicom", "highdicom", "matplotlib"), "import s3fs, pydicom, highdicom as hd", "import matplotlib.pyplot as plt", "", fsOpen(e), "", "def is_level(path):  # a pyramid level, not the label or overview", "    ds = pydicom.dcmread(fs.open(path, \"rb\"), stop_before_pixels=True)", "    return len(ds.ImageType) < 3 or ds.ImageType[2] == \"VOLUME\"", "", `smallest = next(p for p in sorted(fs.ls(${JSON.stringify(e.location)}), key=fs.size) if is_level(p))`, "slide = hd.imread(fs.open(smallest, \"rb\"), lazy_frame_retrieval=True)", "plt.figure(figsize=(10, 8))", "pixels = slide.get_total_pixel_matrix()", "plt.imshow(pixels / pixels.max() if pixels.dtype.kind == \"f\" else pixels)  # matplotlib wants floats in 0..1", "plt.axis(\"off\")", "plt.show()") },
  ],
};

// The snippets for a stack (a view entry: { format, location, region,
// cratePath }): Load, then its format's own. R has Load only: the URL.
export function stackSnippets(entry, kernelName = "") {
  const load = { id: "load", label: "Load", title: "Open it in place: only what you index is read", code: noted(stackCode(entry, kernelName)) };
  if (isR(kernelName)) return [load];
  const more = STACKS[entry?.format] || STACKS.zarr;
  return [load, ...more.map(({ id, label, title, code }) => ({ id, label, title, code: noted(code(entry)) }))];
}

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
  return list.map(({ id, label, title, code }) => ({ id, label, title, code: noted(code(p, sep)) }));
}

/* ------------------------------------------------- metadata records --- */
// A view's metadata records are files: metadata/models/<model>/versions/<v>/
// records.jsonl (rows {"id", "data"}) and schema.json, and
// metadata/relationships.csv. The metadata folder and each model's folder
// offer cells that query them with DuckDB, as SQL views
// over the files: no copy, no Pennsieve library. The setup reads what's on
// the disk when it runs, so a model not downloaded yet is left out.
// Their first line says so: written for these files, and portable.
export const metadataNote = (lib) => `# Written for this view's metadata records (the Pennsieve export layout): plain ${lib}, no Pennsieve library needed`;

// A view per model (its newest version on the disk), "records" (record_id,
// model) of them all, and "relationships". A model's view expands its
// records' fields; one whose records have none (or that has no records)
// keeps them as a JSON column, data.
const duckdbSetup = (m) =>
  lines(
    needs("duckdb", "pandas"),
    duckdbConnect,
    "",
    `metadata = Path(${m})`,
    "ident = lambda s: '\"' + s.replace('\"', '\"\"') + '\"'",
    "text = lambda s: \"'\" + str(s).replace(\"'\", \"''\") + \"'\"",
    "",
    "# A view per model: record_id and its fields, from its newest version",
    "models = []",
    "for folder in sorted(p for p in (metadata / \"models\").iterdir() if p.is_dir()):",
    "    files = sorted((f for f in (folder / \"versions\").glob(\"*/records.jsonl\") if f.parent.name.isdigit()), key=lambda f: int(f.parent.name))",
    "    if not files:",
    "        continue  # not downloaded",
    "    source = f\"read_json({text(files[-1])}, format='newline_delimited', sample_size=-1\"",
    "    try:",
    "        con.sql(f\"CREATE OR REPLACE VIEW {ident(folder.name)} AS SELECT id AS record_id, data.* FROM {source})\")",
    "    except duckdb.Error:  # no records, or none with fields",
    "        con.sql(f\"CREATE OR REPLACE VIEW {ident(folder.name)} AS SELECT id AS record_id, data FROM {source}, columns={{'id': 'VARCHAR', 'data': 'JSON'}})\")",
    "    models.append(folder.name)",
    "",
    "# meta.records: every record's id and model; meta.relationships: source, target, type",
    "# (in their own schema, so a model named records or relationships keeps its name)",
    "con.sql(\"CREATE SCHEMA IF NOT EXISTS meta\")",
    "con.sql(\"CREATE OR REPLACE VIEW meta.records AS \" + (\" UNION ALL \".join(",
    "    f\"SELECT record_id, {text(m)} AS model FROM main.{ident(m)}\" for m in models",
    ") or \"SELECT NULL::VARCHAR AS record_id, NULL::VARCHAR AS model WHERE false\"))",
    "links = metadata / \"relationships.csv\"",
    "con.sql(\"CREATE OR REPLACE VIEW meta.relationships AS \" + (",
    "    f\"SELECT * FROM read_csv({text(links)}, all_varchar=true)\" if links.exists()",
    "    else \"SELECT NULL::VARCHAR AS source_record_id, NULL::VARCHAR AS target_record_id, NULL::VARCHAR AS relationship_type WHERE false\"",
    "))",
    "print(\"Views:\", \", \".join(models + [\"meta.records\", \"meta.relationships\"]))",
    "# In later cells: con.sql('SELECT * FROM \"<model>\"').df(); meta.relationships links records by record_id",
  );

const quoted = (model) => `"${model.replace(/"/g, '""')}"`;

// One model's view (its newest version on the disk): record_id and its
// records' fields, or a JSON column, data, when they have none.
const modelSetup = (m, model) =>
  lines(
    needs("duckdb", "pandas"),
    duckdbConnect,
    "",
    `metadata = Path(${m})`,
    "text = lambda s: \"'\" + str(s).replace(\"'\", \"''\") + \"'\"",
    "",
    `# ${model}: a view of its newest version's records`,
    `files = sorted((f for f in (metadata / "models" / ${JSON.stringify(model)} / "versions").glob("*/records.jsonl") if f.parent.name.isdigit()), key=lambda f: int(f.parent.name))`,
    "if not files:",
    `    raise FileNotFoundError(${JSON.stringify(`${model}'s records aren't downloaded yet`)})`,
    "source = f\"read_json({text(files[-1])}, format='newline_delimited', sample_size=-1\"",
    "try:",
    `    con.sql(f"CREATE OR REPLACE VIEW ${quoted(model).replace(/"/g, '\\"')} AS SELECT id AS record_id, data.* FROM {source})")`,
    "except duckdb.Error:  # no records, or none with fields",
    `    con.sql(f"CREATE OR REPLACE VIEW ${quoted(model).replace(/"/g, '\\"')} AS SELECT id AS record_id, data FROM {source}, columns={{'id': 'VARCHAR', 'data': 'JSON'}})")`,
    `# In later cells: con.sql('SELECT * FROM ${quoted(model)}').df()`,
  );

const sqlCell = (sql) => lines("con.sql(\"\"\"", ...sql, "\"\"\").df()");
const shown = (sql) => lines("display(con.sql(\"\"\"", ...sql, "\"\"\").df())");
const EXAMPLES = "# Examples: change them, or write your own SQL over the views";

// The whole view: its models' views, and what they hold.
const viewLoad = (m) => lines(duckdbSetup(m), "", sqlCell(["SELECT model, count(*) AS records FROM meta.records GROUP BY model ORDER BY model"]));

// The whole view, then example queries: its models and how they link.
const viewQuery = (m) =>
  lines(
    duckdbSetup(m),
    "",
    EXAMPLES,
    "# Records per model",
    shown(["SELECT model, count(*) AS records FROM meta.records GROUP BY model ORDER BY model"]),
    "# How the models link: each relationship type, between which models",
    sqlCell([
      "SELECT s.model AS source, r.relationship_type, t.model AS target, count(*) AS links",
      "FROM meta.relationships AS r",
      "JOIN meta.records AS s ON s.record_id = r.source_record_id",
      "JOIN meta.records AS t ON t.record_id = r.target_record_id",
      "GROUP BY ALL ORDER BY links DESC",
    ]),
  );

// One model: its view, then its first records.
const modelLoad = (m, model) => lines(modelSetup(m, model), "", sqlCell([`SELECT * FROM ${quoted(model)} LIMIT 10`]));

// One model's first records, then example queries: what links to them, and
// a join to a linked model.
const modelQuery = (m, model) => {
  const id = quoted(model);
  return lines(
    duckdbSetup(m),
    `if ${JSON.stringify(model)} not in models:`,
    `    raise FileNotFoundError(${JSON.stringify(`${model}'s records aren't downloaded yet`)})`,
    "",
    shown([`SELECT * FROM ${id} LIMIT 10`]),
    "",
    EXAMPLES,
    "# What its records link to, and what links to them",
    shown([
      `SELECT 'to' AS direction, r.relationship_type, o.model, count(*) AS links`,
      `FROM ${id} AS m`,
      "JOIN meta.relationships AS r ON r.source_record_id = m.record_id",
      "JOIN meta.records AS o ON o.record_id = r.target_record_id",
      "GROUP BY ALL",
      "UNION ALL",
      `SELECT 'from', r.relationship_type, o.model, count(*)`,
      `FROM ${id} AS m`,
      "JOIN meta.relationships AS r ON r.target_record_id = m.record_id",
      "JOIN meta.records AS o ON o.record_id = r.source_record_id",
      "GROUP BY ALL",
      "ORDER BY links DESC",
    ]),
    "# Its records with a linked model's fields: name the model (one above) and the relationship type",
    "other, kind = \"OTHER_MODEL\", \"RELATIONSHIP_TYPE\"",
    "if other in models:",
    "    display(con.sql(f\"\"\"",
    `    SELECT m.*, o.record_id AS linked_record_id, o.* EXCLUDE (record_id)`,
    `    FROM ${id} AS m`,
    "    JOIN meta.relationships AS r ON r.source_record_id = m.record_id AND r.relationship_type = {text(kind)}",
    "    JOIN {ident(other)} AS o ON o.record_id = r.target_record_id",
    "    \"\"\").df())",
  );
};

// One model: its fields from its schema (type, required, key, unit,
// sensitive, description), then statistics of each column of its records.
const modelSummary = (m, model) =>
  lines(
    modelSetup(m, model),
    "import json",
    "import pandas as pd",
    "",
    `# ${model}: its fields, from the schema of its newest version`,
    `schemas = sorted((f for f in (metadata / "models" / ${JSON.stringify(model)} / "versions").glob("*/schema.json") if f.parent.name.isdigit()), key=lambda f: int(f.parent.name))`,
    "schema = json.loads(schemas[-1].read_text()) if schemas else {}",
    "required = set(schema.get(\"required\", []))",
    "display(pd.DataFrame([{",
    "    \"field\": field,",
    "    \"type\": \", \".join(spec[\"type\"]) if isinstance(spec.get(\"type\"), list) else spec.get(\"type\"),",
    "    \"required\": field in required,",
    "    \"key\": bool(spec.get(\"x-pennsieve-key\")),",
    "    \"unit\": spec.get(\"x-pennsieve-unit\"),",
    "    \"sensitive\": bool(spec.get(\"x-pennsieve-sensitive\")),",
    "    \"description\": spec.get(\"description\"),",
    "} for field, spec in schema.get(\"properties\", {}).items()]))",
    "# Each column of its records: type, count, distinct values, range, nulls",
    sqlCell([`SUMMARIZE ${quoted(model)}`]),
  );

// A table of every model's fields, from the schemas: type, required, key,
// unit, sensitive, description, with its version and record count.
const schemaSummary = (m) =>
  lines(
    needs("pandas"),
    "import json",
    "import pandas as pd",
    "from pathlib import Path",
    "",
    `metadata = Path(${m})`,
    "rows = []",
    "for schema_file in sorted(f for f in (metadata / \"models\").glob(\"*/versions/*/schema.json\") if f.parent.name.isdigit()):",
    "    model, version = schema_file.parts[-4], int(schema_file.parent.name)",
    "    schema = json.loads(schema_file.read_text())",
    "    records = schema_file.with_name(\"records.jsonl\")",
    "    count = None",
    "    if records.exists():",
    "        with records.open() as lines_:",
    "            count = sum(1 for line in lines_ if line.strip())",
    "    required = set(schema.get(\"required\", []))",
    "    for field, spec in schema.get(\"properties\", {}).items():",
    "        kind = spec.get(\"type\")",
    "        rows.append({",
    "            \"model\": model, \"version\": version, \"records\": count, \"field\": field,",
    "            \"type\": \", \".join(kind) if isinstance(kind, list) else kind,",
    "            \"required\": field in required,",
    "            \"key\": bool(spec.get(\"x-pennsieve-key\")),",
    "            \"unit\": spec.get(\"x-pennsieve-unit\"),",
    "            \"sensitive\": bool(spec.get(\"x-pennsieve-sensitive\")),",
    "            \"description\": spec.get(\"description\"),",
    "        })",
    "fields = pd.DataFrame(rows)",
    "links = metadata / \"relationships.csv\"",
    "if links.exists():",
    "    print(pd.read_csv(links, dtype=str)[\"relationship_type\"].value_counts().rename(\"relationships\").to_string(), end=\"\\n\\n\")",
    "fields",
  );

/* ------------------------------------------------- knowledge graph --- */
// A view's records as a knowledge graph: metadata/kgx/, KGX tables (the kgx
// structure, schemas.pennsieve.io/structures/kgx). Nodes: id, category
// (a list), name, provided_by, properties (JSON); edges: id, subject,
// predicate, object and provenance columns. Records are pennsieve:<uuid>
// nodes; coded values are biolink:has_attribute edges to term nodes. The
// DuckDB cells read the Parquet files, which have the same rows as the TSV.
const kgxNote = (lib) => `# Written for this view's knowledge graph (KGX tables): plain ${lib}, no Pennsieve library needed`;

// nodes and edges as DuckDB views over the Parquet files (DuckDB reads
// Parquet itself; NetworkX reads the TSV with pandas).
const kgxSetup = (k) =>
  lines(
    needs("duckdb", "pandas"),
    duckdbConnect,
    "",
    `kgx = Path(${k})`,
    "text = lambda s: \"'\" + str(s).replace(\"'\", \"''\") + \"'\"",
    "con.sql(f\"CREATE OR REPLACE VIEW nodes AS SELECT * FROM read_parquet({text(kgx / 'nodes.parquet')})\")",
    "con.sql(f\"CREATE OR REPLACE VIEW edges AS SELECT * FROM read_parquet({text(kgx / 'edges.parquet')})\")",
    "# In later cells: con.sql('SELECT * FROM nodes').df(); category is a list, properties a JSON object",
  );

// The graph's nodes by category and edges by predicate.
const kgxLoad = (k) =>
  lines(
    kgxSetup(k),
    "",
    shown(["SELECT category, count(*) AS nodes FROM (SELECT unnest(category) AS category FROM nodes) GROUP BY ALL ORDER BY nodes DESC"]),
    sqlCell(["SELECT predicate, count(*) AS edges FROM edges GROUP BY ALL ORDER BY edges DESC"]),
  );

// One hop through a term: records that share a term (a coded value), and
// what a record links to.
const kgxQuery = (k) =>
  lines(
    kgxSetup(k),
    "",
    "# Examples: change them, or write your own SQL over nodes and edges",
    "# The terms most records share (coded values: record -> term edges)",
    shown([
      "SELECT t.id AS term, t.name AS label, e.pennsieve_property AS property, count(*) AS records",
      "FROM edges AS e JOIN nodes AS t ON t.id = e.object",
      "WHERE e.predicate = 'biolink:has_attribute'",
      "GROUP BY ALL ORDER BY records DESC LIMIT 20",
    ]),
    "# One hop through a term: pairs of records with the same term",
    sqlCell([
      "SELECT a.subject AS record, ra.name AS record_name, t.id AS term, t.name AS label,",
      "       b.subject AS other, rb.name AS other_name",
      "FROM edges AS a",
      "JOIN edges AS b ON b.object = a.object AND b.subject <> a.subject AND b.predicate = a.predicate",
      "JOIN nodes AS t ON t.id = a.object",
      "JOIN nodes AS ra ON ra.id = a.subject",
      "JOIN nodes AS rb ON rb.id = b.subject",
      "WHERE a.predicate = 'biolink:has_attribute'",
      "LIMIT 100",
    ]),
  );

// The graph in NetworkX: a directed multigraph, nodes with their category
// and name, edges with their predicate. It reads the TSV files (KGX's
// canonical form: no quoting, | between a list's values), which pandas
// reads without a Parquet library, only the columns it uses. NetworkX holds
// each edge as Python objects (roughly a GB per million edges), so a large
// graph (Hetionet: 2.3 million) is summarised in pandas and only the edges
// around a few nodes become the NetworkX graph.
const KGX_NETWORKX_EDGES = 500000;
const kgxNetworkx = (k) =>
  lines(
    needs("pandas", "networkx"),
    "import networkx as nx",
    "import pandas as pd",
    "from pathlib import Path",
    "",
    `kgx = Path(${k})`,
    "tsv = dict(sep=\"\\t\", quoting=3, dtype=str, keep_default_na=False)",
    "nodes = pd.read_csv(kgx / \"nodes.tsv.gz\", usecols=[\"id\", \"category\", \"name\"], **tsv)",
    "edges = pd.read_csv(kgx / \"edges.tsv.gz\", usecols=[\"subject\", \"predicate\", \"object\"], **tsv)",
    "print(len(nodes), \"nodes,\", len(edges), \"edges\")",
    "",
    "# The best-connected nodes (edges in and out)",
    "degree = pd.concat([edges.subject, edges.object]).value_counts().rename_axis(\"id\").reset_index(name=\"degree\")",
    "display(degree.head(10).merge(nodes, on=\"id\"))",
    "",
    "# NetworkX holds every edge as Python objects (roughly a GB per million):",
    "# a large graph becomes the edges around the nodes you pick, here the top hub.",
    `whole = len(edges) <= ${KGX_NETWORKX_EDGES}`,
    "if not whole:",
    "    seed = set(degree.id.head(1))  # e.g. set(nodes[nodes.name.str.contains(\"epilepsy\", case=False)].id)",
    `    edges = edges[edges.subject.isin(seed) | edges.object.isin(seed)].head(${KGX_NETWORKX_EDGES})  # a hub may touch most of the graph`,
    "g = nx.from_pandas_edgelist(edges, \"subject\", \"object\", edge_attr=[\"predicate\"], create_using=nx.MultiDiGraph)",
    "g.add_nodes_from((r.id, {\"category\": r.category.split(\"|\"), \"name\": r.name}) for r in (nodes if whole else nodes[nodes.id.isin(g.nodes)]).itertuples())",
    "print(g)",
  );

// Which of a view's metadata folders a folder is, from its path in the
// view (its crate path: "metadata/", "metadata/models/<model>/" or
// "metadata/kgx/"), or null for any other.
export function metadataFolder(rel) {
  if (/^metadata\/kgx\/?$/.test(String(rel || ""))) return { level: "kgx", model: null };
  // Model names are metadata-service's (lower-case letters, digits, _), so
  // a name can go into the generated code as is; any other folder gets none.
  const m = String(rel || "").match(/^metadata(?:\/models\/([a-z0-9_]+))?\/?$/);
  if (!m) return null;
  return { level: m[1] ? "model" : "metadata", model: m[1] || null };
}

// The snippets for a view's metadata folder or a model's folder, at path in the session and rel in the view: [{ id, label, title,
// code }], or [] for other folders and in R.
export function folderSnippets(path, rel, kernelName = "") {
  const f = metadataFolder(rel);
  if (!f || isR(kernelName)) return [];
  if (f.level === "kgx") {
    const k = sessionPathCode(String(path).replace(/\/+$/, ""), kernelName);
    return [
      { id: "load", label: "Load", title: "The graph's nodes and edges as DuckDB views, with counts by category and predicate", code: `${kgxNote("DuckDB")}\n${kgxLoad(k)}` },
      { id: "query", label: "Query", title: "Load, then example queries: shared terms, and records one hop apart through a term", code: `${kgxNote("DuckDB")}\n${kgxQuery(k)}` },
      { id: "networkx", label: "NetworkX", title: "The graph in NetworkX, and its best-connected nodes", code: `${kgxNote("NetworkX")}\n${kgxNetworkx(k)}` },
    ];
  }
  // The metadata folder in the session: path, less what rel has after metadata.
  const below = String(rel).replace(/\/+$/, "").length - "metadata".length;
  const folder = String(path).replace(/\/+$/, "");
  const m = sessionPathCode(below ? folder.slice(0, -below) : folder, kernelName);
  const note = (code, lib = "DuckDB") => `${metadataNote(lib)}\n${code}`;
  if (f.level === "model") {
    return [
      { id: "load", label: "Load", title: `${f.model}'s records as a DuckDB view, for SQL`, code: note(modelLoad(m, f.model)) },
      { id: "query", label: "Query", title: `Load, then example queries: what ${f.model}'s records link to, and a join`, code: note(modelQuery(m, f.model)) },
      { id: "summary", label: "Summarize", title: `${f.model}'s fields from its schema, and statistics of each column`, code: note(modelSummary(m, f.model)) },
    ];
  }
  const load = { id: "load", label: "Load", title: "Every model's records as DuckDB views, for SQL", code: note(viewLoad(m)) };
  const query = { id: "query", label: "Query", title: "Load, then example queries: records per model, and how the models link", code: note(viewQuery(m)) };
  return [load, query, { id: "summary", label: "Summarize", title: "Every model's fields from its schema, with record counts", code: note(schemaSummary(m), "pandas") }];
}
