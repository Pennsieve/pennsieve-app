/*
  The note under a workflow's sample output when it's older than the version
  shown (runExamples.js reportNote), with the report's version fetched through
  the store once per session.
*/
import { createVersionCache, loadReportNote } from "./runExamples";

let versions = null;
const versionLoader = (store) => {
  if (!versions) {
    versions = createVersionCache((uuid, version) =>
      store.dispatch("analysisModule/fetchWorkflowVersion", { uuid, version })
    );
  }
  return versions;
};

// store, the workflow's uuid, its example, and the workflow (version) shown
// -> the note ("" for none).
export const workflowReportNote = (store, uuid, example, currentWorkflow) =>
  loadReportNote(example, currentWorkflow, (version) => versionLoader(store)(uuid, version));
