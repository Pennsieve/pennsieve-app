// A "Pennsieve Dataset" target's import into its dataset, as a run's page
// shows it. Since compute nodes on provisioner v1.18.0, the node stages the
// target's files and upload-service copies them into the dataset; the run's
// target is done once upload-service has accepted them, and the copies run
// on. upload-service's GET /upload/manifest/run-results/import says how far
// they are. Runs from before (the target uploaded from the node) have no
// import there (404), and show nothing.
//
// Pure: on that endpoint's response
// ({ total, imported, failed, inProgress, failures: [{ path, message }] }).

export const DATASET_TARGET_TYPE = "Pennsieve Dataset";

// Whether a graph node's target imports into a dataset.
export const isDatasetImport = (data) => data?.targetType === DATASET_TARGET_TYPE && !!data?.datasetId;

// The status endpoint for one run target's import into datasetId.
export function importStatusUrl(api2Url, datasetId, runId, targetId) {
  const q = new URLSearchParams({ dataset_id: datasetId, run_id: runId, target_id: targetId });
  return `${api2Url}/upload/manifest/run-results/import?${q}`;
}

const files = (n) => `${n} file${n === 1 ? "" : "s"}`;

// What a target's card says about its import, and how it's going: importing
// (files still being copied), done, or failed (some couldn't be imported;
// the rest may still be in progress). null before there's anything to say.
export function importSummary(status) {
  if (!status || !(status.total > 0)) return null;
  const { total, imported = 0, failed = 0, inProgress = 0 } = status;
  if (failed > 0) {
    return { state: "failed", text: `${failed} of ${files(total)} couldn't be imported` };
  }
  if (inProgress > 0) {
    return { state: "importing", text: `Importing: ${imported} of ${files(total)}` };
  }
  return { state: "done", text: `${files(imported)} imported` };
}

// Whether to ask again: files still being copied, or the target still
// handing its pages over (more files may be registered).
export const importStillMoving = (status, targetStatus) =>
  targetStatus === "STARTED" || (status?.inProgress ?? 0) > 0;
