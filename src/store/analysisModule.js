import { useGetToken, useGetAllTokens } from "@/composables/useGetToken";

const initialState = () => ({
  computeNodes: [],
  computeNodesLoaded: false,
  applications: [],
  applicationsLoaded: false,
  processors: [],
  preprocessors: [],
  postprocessors: [],
  selectedWorkflow: {},
  selectedProcessor: {},
  selectedFilesForAnalysis: [],
  computeResourceAccounts: [],
  /*
      In the selectedFilesForAnalysis obj files are grouped by parentId
      where key is parentId, and value is an array of files that share a parentID.
      For files in the root directory, their key is the string 'root'.
      Example: { root: [{...file1}, {...file2}, {...file3}], parentId: [{}, {}] }
      This is to support multi-level file selection.
    */
  fileCount: 0,
  workflowInstances: [],
  workflowInstancesCursor: null,
  selectedWorkflowActivity: {},
  cancelWorkflowDialogVisible: false,
  activityDialogVisible: false,
  workflows: [],
  workflowsNextCursor: "",
  targetTypes: [],
  targetTypesLoaded: false,
  analyticsChannel: null,
  pendingRunConfig: null,
});

export const state = initialState();

export const mutations = {
  UPDATE_COMPUTE_NODES(state, computeNodes) {
    state.computeNodes = computeNodes;
    state.computeNodesLoaded = true;
  },
  UPDATE_APPLICATIONS(state, applications) {
    state.applications = applications;
    state.applicationsLoaded = true;
  },
  UPDATE_PREPROCESSORS(state, preprocessors) {
    state.preprocessors = preprocessors;
  },
  UPDATE_PROCESSORS(state, processors) {
    state.processors = processors;
  },
  UPDATE_POSTPROCESSORS(state, postprocessors) {
    state.postprocessors = postprocessors;
  },
  UPDATE_SELECTED_FILE_COUNT(state) {
    let total = 0;
    for (const parentId in state.selectedFilesForAnalysis) {
      total = total + state.selectedFilesForAnalysis[parentId].length;
    }
    state.fileCount = total;
  },
  SET_SELECTED_FILES(state, { selectedFiles, parentId }) {
    if (selectedFiles.length) {
      const updatedObj = { ...state.selectedFilesForAnalysis };

      // Get the existing files for the parentId
      const existingFiles = updatedObj[parentId] || [];

      // Filter out duplicates
      const nonDuplicateFiles = selectedFiles.filter(
        (newFile) =>
          !existingFiles.some(
            (existingFile) => existingFile.content.id === newFile.content.id
          )
      );

      // Combine existing files with non-duplicate new files
      const updatedFiles = [...existingFiles, ...nonDuplicateFiles];

      // Remove any files in existingFiles that are not present in files
      updatedObj[parentId] = updatedFiles.filter((file) =>
        selectedFiles.some((newFile) => newFile.content.id === file.content.id)
      );

      state.selectedFilesForAnalysis = updatedObj;
    } else {
      state.selectedFilesForAnalysis[parentId] = [];
    }
  },
  CLEAR_SELECTED_FILES(state) {
    state.selectedFilesForAnalysis = {};
  },
  SET_COMPUTE_RESOURCE_ACCOUNTS(state, accounts) {
    state.computeResourceAccounts = accounts;
  },
  SET_WORKFLOW_INSTANCES(state, { runs, cursor }) {
    // Preserve optimistically-added PENDING runs not yet returned by the API
    const incomingIds = new Set(runs.map((r) => r.uuid));
    const pendingLocal = state.workflowInstances.filter(
      (r) => r.status === "NOT_STARTED" && !incomingIds.has(r.uuid)
    );
    state.workflowInstances = [...pendingLocal, ...runs];
    state.workflowInstancesCursor = cursor || null;
  },
  APPEND_WORKFLOW_INSTANCES(state, { runs, cursor }) {
    state.workflowInstances = [...state.workflowInstances, ...runs];
    state.workflowInstancesCursor = cursor || null;
  },
  SET_WORKFLOW_LOGS(state, logs) {
    state.workflowLogs = logs;
  },
  SET_SELECTED_WORKFLOW(state, workflow) {
    state.selectedWorkflow = workflow;
  },
  SET_SELECTED_WORKFLOW_ACTIVITY(state, workflow) {
    state.selectedWorkflowActivity = workflow;
  },
  SHOW_CANCEL_WORKFLOW_DIALOG(state) {
    state.cancelWorkflowDialogVisible = true;
  },
  HIDE_CANCEL_WORKFLOW_DIALOG(state) {
    state.cancelWorkflowDialogVisible = false;
  },
  SHOW_ACTIVITY_LOG_DIALOG(state) {
    state.activityDialogVisible = true;
  },
  HIDE_ACTIVITY_LOG_DIALOG(state) {
    state.activityDialogVisible = false;
  },
  SET_SELECTED_PROCESSOR(state, processor) {
    state.selectedProcessor = processor;
  },
  UPDATE_WORKFLOWS(state, { workflows, nextCursor, append }) {
    if (append) {
      state.workflows = [...state.workflows, ...workflows];
    } else {
      state.workflows = workflows;
    }
    state.workflowsNextCursor = nextCursor || "";
  },
  UPDATE_TARGET_TYPES(state, targetTypes) {
    state.targetTypes = targetTypes;
    state.targetTypesLoaded = true;
  },
  UPDATE_WORKFLOW_ACTIVE_STATUS(state, { uuid, isActive }) {
    const workflow = state.workflows.find((w) => w.uuid === uuid);
    if (workflow) {
      workflow.isActive = isActive;
    }
  },
  UPDATE_WORKFLOW_DETAILS(state, { uuid, name, description }) {
    const workflow = state.workflows.find((w) => w.uuid === uuid);
    if (workflow) {
      if (name !== undefined) workflow.name = name;
      if (description !== undefined) workflow.description = description;
    }
  },
  SET_ANALYTICS_CHANNEL(state, channel) {
    state.analyticsChannel = channel;
  },
  CLEAR_ANALYTICS_CHANNEL(state) {
    state.analyticsChannel = null;
  },
  SET_PENDING_RUN_CONFIG(state, config) {
    state.pendingRunConfig = config;
  },
  CLEAR_PENDING_RUN_CONFIG(state) {
    state.pendingRunConfig = null;
  },
  PREPEND_WORKFLOW_INSTANCE(state, run) {
    state.workflowInstances = [run, ...state.workflowInstances];
  },
  UPDATE_RUN_STATUS(state, { runId, status }) {
    const run = state.workflowInstances.find((r) => r.uuid === runId);
    if (run) {
      run.status = status;
    }
  },
  UPDATE_NODE_STATUS(state, { nodeId, status }) {
    if (!state.selectedWorkflowActivity?.dag) return;
    const node = state.selectedWorkflowActivity.dag.find((n) => n.id === nodeId);
    if (node) {
      node.status = status;
    }
  },
};

export const actions = {
  fetchComputeNodes: async ({ state, commit, rootState }, { force } = {}) => {
    if (!force && state.computeNodesLoaded) return;
    return useGetToken()
      .then((token) => {
        const url = `${rootState.config.api2Url}/compute/resources/compute-nodes?organization_id=${rootState.activeOrganization.organization.id}`;
        return fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).then((resp) => {
          if (resp.ok) {
            return resp
              .json()
              .then((json) => commit("UPDATE_COMPUTE_NODES", json));
          } else {
            return Promise.reject(resp);
          }
        });
      })
      .catch((err) => {
        commit("UPDATE_COMPUTE_NODES", []);
        return Promise.reject();
      });
  },
  fetchApplications: async ({ state, commit, rootState }, { force } = {}) => {
    if (!force && state.applicationsLoaded) return;
    try {
      const userToken = await useGetToken();

      const url = `${rootState.config.api2Url}/applications/store`;
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (resp.ok) {
        const raw = await resp.json();
        const result = raw.map((app) => {
          const rc = app.runtimeConfig || {};
          return {
            ...app,
            runtimeConfig: {
              cpu: rc.cpu || null,
              memory: rc.memory || null,
              computeTypes: (rc.computeTypes && rc.computeTypes.length ? rc.computeTypes : ["standard"])
                .map((t) => (t === "ecs" ? "standard" : t)),
            },
          };
        });
        commit("UPDATE_APPLICATIONS", result);
        const preprocessors = result.filter(
          (application) => application.applicationType === "preprocessor"
        );
        const processors = result.filter(
          (application) => application.applicationType === "processor"
        );
        const postprocessors = result.filter(
          (application) => application.applicationType === "postprocessor"
        );
        commit("UPDATE_PREPROCESSORS", preprocessors);
        commit("UPDATE_PROCESSORS", processors);
        commit("UPDATE_POSTPROCESSORS", postprocessors);
      } else {
        return Promise.reject(resp);
      }
    } catch (err) {
      commit("UPDATE_APPLICATIONS", []);
      return Promise.reject(err);
    }
  },
  fetchApplication: async ({ rootState }, uuid) => {
    if (!uuid) throw new Error("Missing application uuid");
    const url = `${rootState.config.api2Url}/applications/store/${uuid}`;
    const userToken = await useGetToken();
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });
    if (!resp.ok) {
      throw new Error(`Failed to fetch application: ${resp.status}`);
    }
    return await resp.json();
  },
  fetchApplicationPermissions: async ({ rootState }, uuid) => {
    if (!uuid) throw new Error("Missing application uuid");
    const url = `${rootState.config.api2Url}/applications/store/${uuid}/permissions`;
    const userToken = await useGetToken();
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });
    if (!resp.ok) {
      throw new Error(`Failed to fetch application permissions: ${resp.status}`);
    }
    return await resp.json();
  },
  updateApplicationPermissions: async ({ rootState }, { uuid, payload }) => {
    if (!uuid) throw new Error("Missing application uuid");
    const url = `${rootState.config.api2Url}/applications/store/${uuid}/permissions`;
    const userToken = await useGetToken();
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const errorDetails = await resp.text();
      throw new Error(
        `Failed to update application permissions: ${resp.status} ${errorDetails}`
      );
    }
    return await resp.json();
  },
  fetchComputeResourceAccounts: async ({ commit, rootState }) => {
    try {
      const url = `${rootState.config.api2Url}/accounts?organization_id=${rootState.activeOrganization.organization.id}`;

      const userToken = await useGetToken();
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (resp.ok) {
        const result = await resp.json();
        commit("SET_COMPUTE_RESOURCE_ACCOUNTS", result);
      } else {
        return Promise.reject(resp);
      }
    } catch (err) {
      commit("SET_COMPUTE_RESOURCE_ACCOUNTS", []);
      return Promise.reject(err);
    }
  },
  setSelectedFiles: ({ commit, rootState }, { selectedFiles, parentId }) => {
    commit("SET_SELECTED_FILES", { selectedFiles, parentId });
  },
  setSelectedFile: ({ commit, rootState }, selectedFile) => {
    commit("SET_SELECTED_FILE", selectedFile);
  },
  clearSelectedFiles: ({ commit, rootState }) => {
    commit("CLEAR_SELECTED_FILES");
  },
  createApplication: async ({ commit, rootState }, newApplication) => {
    const url = `${rootState.config.api2Url}/applications/store`;

    const userToken = await useGetToken();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(newApplication),
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(
          `Error ${response.status}: ${response.statusText} - ${errorDetails}`
        );
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.error("Failed to create application:", err.message);
      throw err;
    }
  },
  createComputeNode: async ({ commit, rootState }, newComputeNode) => {
    const url = `${rootState.config.api2Url}/compute-nodes`;

    try {
      const userToken = await useGetToken();
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(newComputeNode),
      });

      if (!response.ok) {
        const errorDetails = await response.text(); // Extract error details from the response
        throw new Error(
          `Error ${response.status}: ${response.statusText} - ${errorDetails}`
        );
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.error("Failed to create compute node:", err.message); // Log detailed error message
      throw err; // Rethrow the error to be handled by the caller
    }
  },
  createWorkflow: async ({ commit, rootState }, newWorkflow) => {
    const url = `${rootState.config.api2Url}/compute/workflows/definitions`;

    // Include organizationId when operating within an organization
    const orgId = rootState.activeOrganization?.organization?.id;
    const payload = orgId
      ? { ...newWorkflow, organizationId: orgId }
      : newWorkflow;

    try {
      const userToken = await useGetToken();
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(
          `Error ${response.status}: ${response.statusText} - ${errorDetails}`
        );
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.error("Failed to workflow:", err.message);
      throw err;
    }
  },
  updateWorkflowActiveStatus: async ({ commit, rootState }, { uuid, isActive }) => {
    const url = `${rootState.config.api2Url}/compute/workflows/definitions/${uuid}`;
    const userToken = await useGetToken();

    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(
          `Error ${response.status}: ${response.statusText} - ${errorDetails}`
        );
      }

      commit("UPDATE_WORKFLOW_ACTIVE_STATUS", { uuid, isActive });
      return await response.json();
    } catch (err) {
      console.error("Failed to update workflow active status:", err.message);
      throw err;
    }
  },
  updateWorkflow: async ({ commit, rootState }, { uuid, payload }) => {
    const url = `${rootState.config.api2Url}/compute/workflows/definitions/${uuid}`;
    const userToken = await useGetToken();

    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(
          `Error ${response.status}: ${response.statusText} - ${errorDetails}`
        );
      }

      const result = await response.json();

      if (payload.name !== undefined || payload.description !== undefined) {
        commit("UPDATE_WORKFLOW_DETAILS", { uuid, ...payload });
      }
      if (payload.isActive !== undefined) {
        commit("UPDATE_WORKFLOW_ACTIVE_STATUS", { uuid, isActive: payload.isActive });
      }

      return result;
    } catch (err) {
      console.error("Failed to update workflow:", err.message);
      throw err;
    }
  },
  // Note that this to to deploy application, there is another action for editing application
  updateApplication: async ({ commit, rootState }, newApplication) => {
    const url = `${rootState.config.api2Url}/applications/deploy`;
    const userToken = await useGetToken();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(newApplication),
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(
          `Error ${response.status}: ${response.statusText} - ${errorDetails}`
        );
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.error("Failed to update application:", err.message);
      throw err;
    }
  },
  updateFileCount: async ({ commit, rootState }) => {
    commit("UPDATE_SELECTED_FILE_COUNT");
  },
  fetchWorkflowInstances: async ({ commit, rootState }, { status, workflowId, limit, startDate, endDate } = {}) => {
    try {
      const params = new URLSearchParams({
        organization_id: rootState.activeOrganization.organization.id,
      });
      if (status) params.set("status", status);
      if (workflowId) params.set("workflow_id", workflowId);
      if (limit) params.set("limit", limit);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      const url = `${rootState.config.api2Url}/compute/workflows/runs?${params}`;
      const userToken = await useGetToken();
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (resp.ok) {
        const result = await resp.json();
        const runs = result.runs || result;

        const sortedWorkflows = runs.sort((a, b) => {
          const dateA = new Date(a.startedAt).getTime();
          const dateB = new Date(b.startedAt).getTime();
          if (isNaN(dateA)) return 1;
          if (isNaN(dateB)) return -1;
          return dateB - dateA;
        });
        commit("SET_WORKFLOW_INSTANCES", { runs: sortedWorkflows, cursor: result.nextCursor });
      } else {
        return Promise.reject(resp);
      }
    } catch (err) {
      commit("SET_WORKFLOW_INSTANCES", { runs: [], cursor: null });
      return Promise.reject(err);
    }
  },
  fetchMoreWorkflowInstances: async ({ commit, state, rootState }, { status, workflowId, limit, startDate, endDate } = {}) => {
    const cursor = state.workflowInstancesCursor;
    if (!cursor) return;
    try {
      const params = new URLSearchParams({
        organization_id: rootState.activeOrganization.organization.id,
        cursor,
      });
      if (status) params.set("status", status);
      if (workflowId) params.set("workflow_id", workflowId);
      if (limit) params.set("limit", limit);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      const url = `${rootState.config.api2Url}/compute/workflows/runs?${params}`;
      const userToken = await useGetToken();
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (resp.ok) {
        const result = await resp.json();
        const runs = result.runs || result;
        commit("APPEND_WORKFLOW_INSTANCES", { runs, cursor: result.nextCursor });
      } else {
        return Promise.reject(resp);
      }
    } catch (err) {
      return Promise.reject(err);
    }
  },
  fetchWorkflowLogs: async ({ commit, rootState }, [workflow, application]) => {
    const userToken = await useGetToken();
    const runId = workflow.uuid;
    const applicationId = application.uuid;
    // Fetch application logs
    try {
      const url = `${rootState.config.api2Url}/compute/workflows/runs/${runId}/logs?applicationUuid=${applicationId}`;

      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (resp.ok) {
        const result = await resp.json();
        commit("SET_WORKFLOW_LOGS", result.messages);
      } else {
        return Promise.reject(resp);
      }
    } catch (err) {
      commit("SET_WORKFLOW_LOGS", []);
      return Promise.reject(err);
    }
  },
  setSelectedWorkflowActivity: async (
    { commit, dispatch, rootState },
    workflow
  ) => {
    if (!workflow) {
      commit("SET_SELECTED_WORKFLOW_ACTIVITY", {});
      return;
    }
    try {
      const userToken = await useGetToken();
      const baseUrl = `${rootState.config.api2Url}/compute/workflows/runs/${workflow.uuid}`;

      // Fetch run data and per-node status in parallel
      const [runResp, statusResp] = await Promise.all([
        fetch(baseUrl, {
          method: "GET",
          headers: { Authorization: `Bearer ${userToken}` },
        }),
        fetch(`${baseUrl}/status`, {
          method: "GET",
          headers: { Authorization: `Bearer ${userToken}` },
        }),
      ]);

      if (!runResp.ok || !statusResp.ok) {
        return Promise.reject(runResp.ok ? statusResp : runResp);
      }

      const runData = await runResp.json();
      const statusData = await statusResp.json();

      // The status response contains a dag array with status embedded per node.
      // Merge status fields from statusData.dag onto runData.dag by node id.
      const statusDag = Array.isArray(statusData.dag) ? statusData.dag : [];
      const statusMap = new Map();
      statusDag.forEach((entry) => {
        if (entry.id) statusMap.set(entry.id, entry);
      });

      // Merge status into the run's dag
      const mergedDag = (runData.dag || []).map((node) => {
        const statusEntry = statusMap.get(node.id) || {};
        return {
          ...node,
          status: statusEntry.status || node.status,
          startedAt: statusEntry.startedAt || node.startedAt,
          completedAt: statusEntry.completedAt || node.completedAt,
        };
      });

      commit("SET_SELECTED_WORKFLOW_ACTIVITY", {
        ...runData,
        status: statusData.status || runData.status,
        startedAt: statusData.startedAt || runData.startedAt,
        completedAt: statusData.completedAt || runData.completedAt,
        dag: mergedDag,
      });

      // Update selected processor if still present
      const currentActivity = rootState.analysisModule.selectedWorkflowActivity;
      const selectedId = rootState.analysisModule.selectedProcessor?.uuid ||
        rootState.analysisModule.selectedProcessor?.id;
      if (selectedId && currentActivity.dag) {
        const updatedProcessor = currentActivity.dag.find(
          (p) => p.uuid === selectedId || p.id === selectedId
        );
        if (updatedProcessor) {
          commit("SET_SELECTED_PROCESSOR", updatedProcessor);
          if (rootState.analysisModule.activityDialogVisible) {
            dispatch("fetchWorkflowLogs", [workflow, updatedProcessor]);
          }
        }
      }
    } catch (err) {
      commit("SET_SELECTED_WORKFLOW_ACTIVITY", {});
      return Promise.reject(err);
    }
  },
  cancelWorkflow: async ({ commit }, workflowId) => {
    commit("HIDE_CANCEL_WORKFLOW_DIALOG");
    // API not yet available
    // const url = `${rootState.config.api2Url}/cancel/workflows/${workflowId}`;
  },
  hideCancelWorkflowDialog: ({ commit }) => {
    commit("HIDE_CANCEL_WORKFLOW_DIALOG");
  },
  showActivityLogDialog: ({ commit, rootState }) => {
    commit("SHOW_ACTIVITY_LOG_DIALOG");
  },
  hideActivityLogDialog: ({ commit, rootState }) => {
    commit("HIDE_ACTIVITY_LOG_DIALOG");
  },
  editApplication: async ({ commit, rootState }, application) => {
    const url = `${rootState.config.api2Url}/applications/${application?.uuid}`;
    const userToken = await useGetToken();

    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(application),
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(
          `Error ${response.status}: ${response.statusText} - ${errorDetails}`
        );
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.error("Failed to update application:", err.message);
      throw err;
    }
  },
  deleteComputeNode: async ({ commit, rootState }, computeNode) => {
    const url = `${rootState.config.api2Url}/compute-nodes/${computeNode?.uuid}`;
    const userToken = await useGetToken();
    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (!response.ok) {
        return;
      }
    } catch (err) {
      console.error("Failed to update application:", err.message);
      throw err;
    }
  },
  deleteApplication: async ({ commit, rootState }, application) => {
    const url = `${rootState.config.api2Url}/applications/${application?.uuid}`;
    const userToken = await useGetToken();
    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (!response.ok) {
        return;
      }
    } catch (err) {
      console.error("Failed to update application:", err.message);
      throw err;
    }
  },
  editComputeNode: async ({ commit, rootState }, computeNode) => {
    const url = `${rootState.config.api2Url}/compute-nodes/${computeNode?.uuid}`;
    const userToken = await useGetToken();
    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(computeNode),
      });

      if (!response.ok) {
        return;
      }
    } catch (err) {
      console.error("Failed to update compute node:", err.message);
      throw err;
    }
  },
  createRun: async ({ commit, rootState }, payload) => {
    const tokens = await useGetAllTokens();
    const url = `${rootState.config.api2Url}/compute/workflows/runs`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/json",
        "X-Refresh-Token": tokens.refreshToken,
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      let message = "Failed to create run";
      try {
        const body = await resp.json();
        if (body.message) message = body.message;
        else if (body.error) message = body.error;
      } catch {}
      throw new Error(message);
    }
    const newRun = await resp.json();
    commit("PREPEND_WORKFLOW_INSTANCE", newRun);
    return newRun;
  },
  setSelectedProcessor: ({ commit, rootState }, processor) => {
    commit("SET_SELECTED_PROCESSOR", processor);
  },
  fetchTargetTypes: async ({ state, commit, rootState }, { force } = {}) => {
    if (!force && state.targetTypesLoaded) return;
    try {
      const userToken = await useGetToken();
      const url = `${rootState.config.api2Url}/compute/workflows/target-types`;

      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (resp.ok) {
        const raw = await resp.json();
        const result = raw.map((tt) => {
          const rc = tt.runtimeConfig || {};
          return {
            ...tt,
            runtimeConfig: {
              cpu: rc.cpu || null,
              memory: rc.memory || null,
              computeTypes: (rc.computeTypes && rc.computeTypes.length ? rc.computeTypes : ["standard"])
                .map((t) => (t === "ecs" ? "standard" : t)),
            },
          };
        });
        commit("UPDATE_TARGET_TYPES", result);
      } else {
        return Promise.reject(resp);
      }
    } catch (err) {
      commit("UPDATE_TARGET_TYPES", []);
      return Promise.reject(err);
    }
  },
  fetchWorkflowDefinition: async ({ rootState }, uuid) => {
    const userToken = await useGetToken();
    const url = `${rootState.config.api2Url}/compute/workflows/definitions/${uuid}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    if (resp.ok) {
      return await resp.json();
    } else {
      throw new Error(`Failed to fetch workflow definition: ${resp.status}`);
    }
  },
  fetchWorkflows: async ({ commit, rootState }, { search, cursor, limit, status, append } = {}) => {
    try {
      const userToken = await useGetToken();
      const params = new URLSearchParams({
        organization_id: rootState.activeOrganization.organization.id,
      });
      if (limit) params.set("limit", limit);
      if (search) params.set("search", search);
      if (cursor) params.set("cursor", cursor);
      if (status) params.set("status", status);

      const url = `${rootState.config.api2Url}/compute/workflows/definitions?${params}`;

      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      if (resp.ok) {
        const result = await resp.json();
        // Handle both new paginated { workflows, nextCursor } and legacy array response
        const workflows = Array.isArray(result) ? result : (result.workflows || []);
        const nextCursor = Array.isArray(result) ? "" : (result.nextCursor || "");
        commit("UPDATE_WORKFLOWS", { workflows, nextCursor, append: !!append });
      } else {
        return Promise.reject(resp);
      }
    } catch (err) {
      commit("UPDATE_WORKFLOWS", { workflows: [], nextCursor: "", append: false });
      return Promise.reject(err);
    }
  },
};

export const getters = {
  workflowInstances: (state) => state.workflowInstances,
  workflowInstancesCursor: (state) => state.workflowInstancesCursor,
  workflowInstance: (state) => state.workflowInstance,
  workflowLogs: (state) => state.workflowLogs,
  selectedWorkflow: (state) => state.selectedWorkflow,
  selectedWorkflowActivity: (state) => state.selectedWorkflowActivity,
  activityDialogVisible: (state) => state.activityDialogVisible,
  selectedProcessor: (state) => state.selectedProcessor,
  applications: (state) => state.applications,
  computeNodes: (state) => state.computeNodes,
  targetTypes: (state) => state.targetTypes,
  analyticsChannel: (state) => state.analyticsChannel,
};

const analysisModule = {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
};

export default analysisModule;
