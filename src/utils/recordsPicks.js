// A records pick: an input's choice of a published dataset version's
// metadata records, by model (names, or ["*"] for all), kept beside the
// version's file picks (one per version). A run view takes it as its
// source's models (viewsService runViewSources).
export const recordsPick = ({ datasetId, version, datasetName }, models) => ({
  datasetId,
  version,
  datasetName,
  path: '',
  name: 'Metadata records',
  isFolder: false,
  models: [...models],
})
export const isRecordsPick = (p) => Array.isArray(p?.models)
// The records pick of a dataset version, if any.
export const recordsPickOf = (picks, datasetId, version) =>
  picks.find((p) => isRecordsPick(p) && p.datasetId === datasetId && p.version === version) || null
