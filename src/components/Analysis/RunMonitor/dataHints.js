// The new notebook dialog starts with the data, and what's chosen there
// guides the later steps: which kernels can take it, which compute nodes
// can reach it, how much disk it needs, and whether a GPU may help.
import { hasInterface } from "./workflowInterface";

// The data platforms whose files come from public S3 buckets.
const PUBLIC_BUCKET_INPUTS = new Set(["openNeuro", "openData"]);

// Whether a kernel's workflow can start with the input chosen (dataset,
// public, openNeuro, openData or none). A workflow that declares its input
// takes any of them, and none when it's optional; one that doesn't reads a
// workspace dataset's files, or in My Workspace a public dataset or nothing.
export function acceptsInput(wf, choice, { personal = false } = {}) {
  if (hasInterface(wf)) {
    const input = wf.inputs?.[0];
    if (choice === "none") return !input || !!input.optional;
    return !!input;
  }
  if (choice === "dataset") return !personal;
  if (choice === "none" || choice === "public") return personal;
  return false;
}

// Where the chosen data lives, when it's known: OpenNeuro's copy is in
// us-east-1, an Open Data dataset says (its regions).
export function dataRegions(choice, { openDataDataset } = {}) {
  if (choice === "openNeuro") return ["us-east-1"];
  if (choice === "openData") return openDataDataset?.regions || [];
  return [];
}

// Why a compute node can't take the chosen data ("" when it can): a
// compliant node has no internet access, so it can't read a public bucket.
export function nodeDataReason(cn, choice) {
  const compliant = (cn?.deploymentMode || "").toLowerCase() === "compliant";
  if (compliant && PUBLIC_BUCKET_INPUTS.has(choice)) return "Can't reach public data (no internet access)";
  return "";
}

// A note on a compute node for the chosen data ("" for none): reading data
// from another region costs cross-region transfer.
export function nodeDataNote(cn, regions = []) {
  if (!cn?.region || !regions.length || regions.includes(cn.region)) return "";
  return `Data in ${regions.join(", ")}, node in ${cn.region}: transfer costs apply`;
}

// The chosen data's size in bytes, when it's known: the whole dataset (the
// user may download less).
export function dataSize(choice, { publicDataset, openNeuroDataset, selectedDataset } = {}) {
  if (choice === "public") return publicDataset?.size || null;
  if (choice === "openNeuro") return openNeuroDataset?.size || null;
  if (choice === "dataset") return selectedDataset?.storage || null;
  return null;
}

// Room a session needs besides its data: its environment and the user's
// own files.
const DISK_HEADROOM_BYTES = 12 * 2 ** 30;

// The smallest disk (GiB, from options) that fits the data with headroom,
// else the largest; null when the size isn't known.
export function suggestedDisk(bytes, options = []) {
  if (!bytes || !options.length) return null;
  const sizes = options.map((o) => o.value).sort((a, b) => a - b);
  const need = bytes * 1.1 + DISK_HEADROOM_BYTES;
  return sizes.find((gib) => gib * 2 ** 30 >= need) ?? sizes.at(-1);
}

// Whether the data is imaging, where a GPU may help (deep learning,
// registration, segmentation): from OpenNeuro's modalities or an Open Data
// dataset's tags.
const IMAGING = /^(mri|pet|ct|microscopy|imaging|medical imaging|computer vision|cryo-em|histopathology|whole slide imaging)$/i;
export function isImagingData(choice, { openNeuroDataset, openDataDataset } = {}) {
  if (choice === "openNeuro") return (openNeuroDataset?.modalities || []).some((m) => IMAGING.test(m));
  if (choice === "openData") return (openDataDataset?.keywords || []).some((k) => IMAGING.test(k));
  return false;
}
