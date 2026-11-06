// The data platforms a notebook can take data from, in the order the data
// pickers list them: the new notebook dialog's data step and a running
// session's "Add data" (PlatformList, PlatformPane), and what's chosen
// guides the dialog's later steps. Whatever the platform, what's chosen
// becomes a view: the notebook starts with its file list, and the user
// picks which files to download.
//
// Each platform is one module, and nothing else names it. It gives:
//   key, name, desc, noun    its card ("1,213 datasets")
//   mark                     { logo } or { icon, iconProps(size) }, with a
//                            tone: brand, teal, light, dark or fill
//   title, intro             the pane's heading, and its words: text and
//                            { href, text } links
//   picker, pickerProps      the picker, bound to each field of its part of
//                            the selection (v-model:<field>), and its other
//                            props: an object, or ({ datasetNote }) => one
//                            (datasetNote(d): why no node can reach d)
//   selection()              its part of the selection, empty
//   ready(part)              whether what's chosen is enough to take
//   label(part)              what's chosen, in a sentence ("" for nothing)
//   viewName(part)           its view's name; sameLabel(part) for a duplicate
//   sameAs(part, source)     whether a session's input has the same files
//   createView(part)         makes its view (a Promise of it)
//   folderName(part, n)      its folder of input/ in a running session (n > 1
//                            for the next free one)
//   count()                  how much it holds (a Promise of a number)
//   regions(part), size(part), imaging(part), publicBucket
//                            where the data is, its size when known, whether
//                            a GPU may help, and whether it's in a public
//                            bucket (which a compliant node can't reach)
//   reads(entry, publisher)  whether an Open Data entry (with its publisher,
//                            as a view's source says) is the platform's own
//                            (an input's subtitle names it)
import discover from "./discover";
import openData from "./openData";
import { sparc, epilepsyScience } from "./portals";
import openNeuro from "./openNeuro";
import bossdb from "./bossdb";
import dandi from "./dandi";
import physionet from "./physionet";
import allen from "./allen";
import cellxgene from "./cellxgene";
import encode from "./encode";
import hca from "./hca";
import idc from "./idc";

const LIST = [discover, openData, sparc, epilepsyScience, openNeuro, bossdb, dandi, physionet, allen, cellxgene, encode, hca, idc];

export const PLATFORMS = Object.fromEntries(LIST.map((p) => [p.key, p]));
export const PLATFORM_KEYS = LIST.map((p) => p.key);

// What the chosen data says for the dialog's later steps: { regions, size,
// imaging, publicBucket }.
export function platformData(key, part) {
  const p = PLATFORMS[key];
  if (!p || !part) return { regions: [], size: null, imaging: false, publicBucket: false };
  return { regions: p.regions(part), size: p.size(part), imaging: p.imaging(part), publicBucket: p.publicBucket };
}

// The platform whose own Open Data entry this is, if any.
export const platformReading = (entry, publisher = "") => (entry ? LIST.find((p) => p.reads(entry, publisher)) || null : null);
