// How a run's or a session's workspace inputs are sent: each one with the
// dataset's records goes through a view (with its files, where views take
// workspace files: filesAsViews), each one with files only goes through a
// view where filesAsViews, else it sends its packages. Inputs with public
// picks, or left out, aren't workspace inputs here.
//
// inputs: [{ id, datasetId, packageIds, models, filePaths }]
// returns { viaView: [{ id, datasetId, packageIds, models, filePaths }],
//           packages: [{ id, packageIds }] }
export function routeWorkspaceInputs(inputs, { filesAsViews = false, publicIds = new Set(), leftOut = new Set() } = {}) {
  const viaView = []
  const packages = []
  for (const input of inputs) {
    if (publicIds.has(input.id) || leftOut.has(input.id)) continue
    const packageIds = input.packageIds || []
    const models = input.models || []
    if (models.length) {
      // Files go with the records only where views take workspace files.
      viaView.push({ ...input, packageIds: filesAsViews ? packageIds : [], models })
      if (!filesAsViews && packageIds.length) packages.push({ id: input.id, packageIds })
    } else if (packageIds.length && filesAsViews) {
      viaView.push({ ...input, packageIds, models })
    } else if (packageIds.length) {
      packages.push({ id: input.id, packageIds })
    }
  }
  return {
    viaView: viaView.filter((v) => v.datasetId),
    packages,
  }
}
