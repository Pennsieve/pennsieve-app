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
