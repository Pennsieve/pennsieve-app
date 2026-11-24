// This workspace's datasets as a data platform for the quick launcher
// (@pennsieve/notebooks platforms): a dataset's files, its metadata records,
// or both. Only the Pennsieve app has it, and only in a workspace.
//
// What's chosen goes to the run as the New notebook dialog sends it: the
// files' packages, or a view of the dataset (its records, and its files
// where views take workspace files). A view the session can add once it
// runs is started now and joins the session when it's built
// (pendingSessionInputs); otherwise it's built before the run is sent.
import { defineAsyncComponent } from "vue";
import IconPennsieveMark from "@/components/icons/IconPennsieveMark.vue";
import {
  createWorkspaceRunView,
  prepareWorkspaceRunView,
  viewDataSource,
  workspaceFilesAsViews,
} from "@pennsieve/notebooks/utils/viewsService";
import { nodeAddsViews } from "@pennsieve/notebooks/components/Analysis/JupyterSession/pendingSessionInputs";
import { notebookEndpoints, notebookToken } from "@pennsieve/notebooks/notebooks/host";

const packageIdsOf = (p) => (p.files || []).map((f) => f.content?.id).filter(Boolean);
const fileCount = (n) => `${n} file${n === 1 ? "" : "s"}`;

// How many datasets the workspace has, as the datasets list counts them.
async function countDatasets() {
  const token = await notebookToken();
  const params = new URLSearchParams({ limit: "1", offset: "0", type: "research", api_key: token });
  const resp = await fetch(`${notebookEndpoints().apiUrl}/datasets/paginated?${params}`);
  if (!resp.ok) throw new Error(`datasets responded ${resp.status}`);
  const body = await resp.json();
  return Number(body?.totalCount) || 0;
}

export default {
  key: "workspace",
  name: "This workspace",
  desc: "Files and records from a dataset here",
  noun: "datasets",
  mark: { icon: IconPennsieveMark, iconProps: (s) => ({ width: Math.round(s * 0.42), height: Math.round(s * 0.48), color: "currentColor" }), tone: "dark" },
  title: "Choose a dataset in this workspace",
  intro: ["A dataset's files, its metadata records, or both. The notebook starts with them in its input/ folder."],
  picker: defineAsyncComponent(() => import("./WorkspaceDataPicker.vue")),
  // dataset: the dataset (as the datasets list returns it), files: the
  // packages picked, models: the metadata models whose records to take.
  selection: () => ({ dataset: null, files: [], models: [] }),
  ready: (p) => !!p.dataset && (packageIdsOf(p).length > 0 || (p.models || []).length > 0),
  label: (p) => {
    if (!p.dataset) return "";
    const what = [packageIdsOf(p).length && fileCount(packageIdsOf(p).length), p.models?.length && "metadata records"].filter(Boolean);
    return `${p.dataset.content?.name}${what.length ? ` (${what.join(" and ")})` : ""}`;
  },
  viewName: (p) => p.dataset?.content?.name || "Dataset",
  sameAs: () => false,
  folderName: (p, n) => `dataset${n > 1 ? `-${n}` : ""}`,
  count: () => countDatasets(),
  regions: () => [],
  size: () => null,
  imaging: () => false,
  publicBucket: false,
  reads: () => false,

  async dataSource(p, { input, node } = {}) {
    const datasetNodeId = p.dataset.content.id;
    const filesAsViews = workspaceFilesAsViews();
    const packageIds = packageIdsOf(p);
    const models = p.models || [];
    // Files alone, where views don't take workspace files: their packages.
    if (!models.length && !filesAsViews) return { source: { packageIds } };
    const name = `${p.dataset.content?.name || "Dataset"}: ${input?.name || "input"}`.slice(0, 255);
    // With records where views don't take files, the records replace them.
    const request = { datasetNodeId, name, models, packageIds: filesAsViews ? packageIds : [] };
    // A session that can add views takes it once it's built, unless the
    // workflow requires the input when the run is sent.
    if (nodeAddsViews(node) && (!input || input.optional)) {
      const started = await createWorkspaceRunView(request);
      return { pending: { viewId: started.id, version: started.version || 1, viewName: started.name || name, datasetId: datasetNodeId, label: name } };
    }
    return { source: viewDataSource(await prepareWorkspaceRunView(request)) };
  },
};
