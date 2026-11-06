// A session file's path as code for the kernel. The file browser lists the
// notebook workspace, where input/ and output/ are links to the run's
// INPUT_DIR and OUTPUT_DIR; the kernel runs elsewhere (beside the notebook),
// so a workspace-relative "input/a.csv" doesn't resolve. Paths under them are
// written through the variables instead: in Python the session's startup
// defines INPUT_DIR and OUTPUT_DIR as Paths; in R they're environment
// variables.
const ROOTS = { input: "INPUT_DIR", output: "OUTPUT_DIR" };

const quote = (s) => JSON.stringify(s);

// A stack's public https URL, without its trailing /, from its s3://
// location and region: what a precomputed volume is read from.
const httpsOf = (url, region) => {
  const m = String(url).match(/^s3:\/\/([^/]+)\/(.*?)\/?$/);
  return m ? `https://s3.${region || "us-east-1"}.amazonaws.com/${m[1]}/${m[2]}` : url;
};

// Code that opens a stack in place, from its s3:// location: a Zarr with
// zarr and anonymous s3fs, a Neuroglancer precomputed volume with
// CloudVolume over https, in Python; its URL in R, which has no one reader.
export function stackCode(entry, kernelName = "") {
  const url = entry?.location || "";
  const r = kernelName.toLowerCase().startsWith("r ") || kernelName.toLowerCase() === "r";
  const name = String(entry?.cratePath || "").replace(/\/$/, "");
  if (r) return `# ${name}: read it in place (${entry?.region || "AWS"}, no credentials)\n${quote(url)}`;
  if (entry?.format === "neuroglancer-precomputed") {
    const https = httpsOf(url, entry.region);
    return `from cloudvolume import CloudVolume\n# ${name}: a precomputed volume, read in place (mip 0 is full resolution)\nvol = CloudVolume(${quote(`precomputed://${https}`)}, mip=0, progress=False)`;
  }
  const options = entry?.region
    ? `{"anon": True, "client_kwargs": {"region_name": ${quote(entry.region)}}}`
    : `{"anon": True}`;
  return `import zarr\n# ${name}: read in place, only the chunks you index\nz = zarr.open(${quote(url)}, mode="r", storage_options=${options})`;
}

export function sessionPathCode(path, kernelName = "") {
  const p = String(path).replace(/^\/+/, "");
  const [top, ...rest] = p.split("/");
  const variable = ROOTS[top];
  const r = kernelName.toLowerCase().startsWith("r ") || kernelName.toLowerCase() === "r";
  if (!variable) return quote(p);
  const sub = rest.join("/");
  if (r) return sub ? `file.path(Sys.getenv("${variable}"), ${quote(sub)})` : `Sys.getenv("${variable}")`;
  return sub ? `${variable} / ${quote(sub)}` : variable;
}
