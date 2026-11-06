// The shape most data platforms share: a dataset is a folder of an Open
// Data entry (OpenNeuro's ds folder, a portal's dataset, a PhysioNet
// version, an Allen Institute dataset or any registry dataset), chosen with
// the folder of it to take ({ dataset, prefix }), and a view of it is an
// openData source of that folder. A platform gives what differs:
//   registry(part)   the Open Data entry
//   viewTitle(part)  what its view is named after (with the folder)
// and anything of the platform shape (platforms/index.js) to override.
import { createOpenDataView, openDataViewName } from "@/utils/viewsService";
import { addedSourceName } from "../JupyterSession/inputsHelpers";

// Whether keywords say imaging, where a GPU may help (deep learning,
// registration, segmentation).
const IMAGING = /^(mri|pet|ct|microscopy|imaging|medical imaging|computer vision|cryo-em|histopathology|whole slide imaging)$/i;
export const imagingTerms = (terms = []) => terms.some((t) => IMAGING.test(t));

// "Title (folder/)", or the title alone for the whole dataset.
export const titleWithFolder = (title, prefix = "") => {
  const p = prefix.trim();
  return p ? `${title} (${p})` : title;
};

export function openDataPlatform(spec) {
  const viewName = (p) => openDataViewName(spec.viewTitle(p), p.prefix);
  return {
    selection: () => ({ dataset: null, prefix: "" }),
    ready: (p) => !!p.dataset,
    label: (p) => (p.dataset ? titleWithFolder(spec.viewTitle(p), p.prefix) : ""),
    viewName,
    sameAs: (p, source) => source.openDataset === spec.registry(p) && source.viewName === viewName(p),
    createView: (p) => createOpenDataView({ dataset: spec.registry(p), title: spec.viewTitle(p), prefix: p.prefix }),
    folderName: (p, n) => addedSourceName(spec.registry(p), p.prefix, n),
    regions: (p) => p.dataset?.regions || [],
    size: () => null,
    imaging: (p) => imagingTerms(p.dataset?.keywords),
    publicBucket: true,
    reads: () => false,
    ...spec,
  };
}
