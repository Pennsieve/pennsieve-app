// The new notebook dialog starts with the data, and what's chosen there
// guides the later steps: which kernels can take it, which compute nodes
// can reach it, how much disk it needs, and whether a GPU may help.
import { hasInterface } from "./workflowInterface";

// Whether a kernel's workflow can start with the input chosen (dataset, a
// data platform's key, public for Discover's, or none). A workflow that
// declares its input takes any of them, and none when it's optional; one
// that doesn't reads a workspace dataset's files, or in My Workspace a
// public dataset or nothing.
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

// Why a compute node can't take the chosen data ("" when it can): a
// compliant node has no internet access, so it can't read a public bucket.
// data is what the chosen data says (platforms platformData).
export function nodeDataReason(cn, data = {}) {
  const compliant = (cn?.deploymentMode || "").toLowerCase() === "compliant";
  if (compliant && data.publicBucket) return "Can't reach public data (no internet access)";
  return "";
}

// A note on a compute node for the chosen data ("" for none): reading data
// from another region costs cross-region transfer.
export function nodeDataNote(cn, regions = []) {
  if (!cn?.region || !regions.length || regions.includes(cn.region)) return "";
  return `Data in ${regions.join(", ")}, node in ${cn.region}: transfer costs apply`;
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
