import { useGetToken } from "@/composables/useGetToken";

const initialState = () => ({
    computeNodes: [],
    computeNodesLoaded: false,
    applications: [],
    applicationsLoaded: false,
    processors: [],
    preprocessors:[],
    postprocessors: [],
    selectedWorkflow: {},
    selectedProcessor: {},
    selectedFilesForAnalysis: [],
    computeResourceAccounts: [] ,
    /*
      In the selectedFilesForAnalysis obj files are grouped by parentId
      where key is parentId, and value is an array of files that share a parentID.
      For files in the root directory, their key is the string 'root'.
      Example: { root: [{...file1}, {...file2}, {...file3}], parentId: [{}, {}] }
      This is to support multi-level file selection.
    */
    fileCount: 0,
    workflowInstances: [],
    selectedWorkflowActivity: {},
    cancelWorkflowDialogVisible: false,
    activityDialogVisible: false,
    workflows: []
  })
  
  export const state = initialState()
  
  export const mutations = {
    UPDATE_COMPUTE_NODES(state, computeNodes) {
      state.computeNodes = computeNodes
      state.computeNodesLoaded = true
    },
    UPDATE_APPLICATIONS(state, applications) {
      state.applications = applications
      state.applicationsLoaded = true
    },
    UPDATE_PREPROCESSORS(state, preprocessors) {
      state.preprocessors = preprocessors
    },
    UPDATE_PROCESSORS(state, processors) {
      state.processors = processors
    },
    UPDATE_POSTPROCESSORS(state, postprocessors) {
      state.postprocessors = postprocessors 
    },
    UPDATE_SELECTED_FILE_COUNT(state) {
      let total = 0;
      for (const parentId in state.selectedFilesForAnalysis) {
          total = total + state.selectedFilesForAnalysis[parentId].length
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
          newFile => !existingFiles.some(existingFile => existingFile.content.id === newFile.content.id)
        );

        // Combine existing files with non-duplicate new files
        const updatedFiles = [...existingFiles, ...nonDuplicateFiles];

        // Remove any files in existingFiles that are not present in files
        updatedObj[parentId] = updatedFiles.filter(
          file => selectedFiles.some(newFile => newFile.content.id === file.content.id)
        );

        state.selectedFilesForAnalysis = updatedObj;
      } else {
        state.selectedFilesForAnalysis[parentId] = []
      }
    },
    CLEAR_SELECTED_FILES(state) {
      state.selectedFilesForAnalysis = {}
    },
    SET_COMPUTE_RESOURCE_ACCOUNTS(state, accounts) {
      state.computeResourceAccounts = accounts
    },
    SET_WORKFLOW_INSTANCES(state, instances) {
      state.workflowInstances = instances
    },
    SET_WORKFLOW_LOGS(state, logs) {
      state.workflowLogs= logs
    }, 
    SET_SELECTED_WORKFLOW_ACTIVITY(state, workflow) {
      state.selectedWorkflowActivity = workflow
    },
    SHOW_CANCEL_WORKFLOW_DIALOG(state) {
      state.cancelWorkflowDialogVisible = true
    },
    HIDE_CANCEL_WORKFLOW_DIALOG(state) {
      state.cancelWorkflowDialogVisible = false
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
    UPDATE_WORKFLOWS(state, workflows) {
  state.workflows = workflows
    },
  }

  export const actions = {
    fetchComputeNodes: async({ commit, rootState }) => {
      return useGetToken()
        .then(token => {
          const url = `${rootState.config.api2Url}/compute-nodes?organization_id=${rootState.activeOrganization.organization.id}`;
          return fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            }
          })
            .then(resp => {
              if (resp.ok) {
                return resp.json()
                    .then(json => commit('UPDATE_COMPUTE_NODES', json))
              } else {
                return Promise.reject(resp)
              }
            })
        })
        .catch(err => {
          commit('UPDATE_COMPUTE_NODES', [])
          return Promise.reject()
        })
    },
    fetchApplications: async({ commit, rootState }) => {
      try {
        const userToken = await useGetToken()

        const url = `${rootState.config.api2Url}/applications?organization_id=${rootState.activeOrganization.organization.id}`;
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        })
  
        if (resp.ok) {
          const result = await resp.json()
          commit('UPDATE_APPLICATIONS', result)
          const preprocessors = result.filter(application => application.applicationType === 'preprocessor')
          const processors = result.filter(application => application.applicationType === 'processor')
          const postprocessors = result.filter(application => application.applicationType === 'postprocessor')
          commit('UPDATE_PREPROCESSORS', preprocessors)
          commit('UPDATE_PROCESSORS', processors)
          commit('UPDATE_POSTPROCESSORS', postprocessors)
        } else {
          return Promise.reject(resp)
        }
      } catch (err) {
          commit('UPDATE_APPLICATIONS', [])
          return Promise.reject(err)
      }
    },
    fetchComputeResourceAccounts: async({ commit, rootState }) => {
      try {
        const url = `${rootState.config.api2Url}/accounts?organization_id=${rootState.activeOrganization.organization.id}`;

        const userToken = await useGetToken()
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        })

        if (resp.ok) {
          const result = await resp.json()
          commit('SET_COMPUTE_RESOURCE_ACCOUNTS', result)
        } else {
          return Promise.reject(resp)
        }
      } catch (err) {
          commit('SET_COMPUTE_RESOURCE_ACCOUNTS', [])
          return Promise.reject(err)
      }
    },
    setSelectedFiles: ({ commit, rootState}, { selectedFiles, parentId }) => {
      commit('SET_SELECTED_FILES', { selectedFiles, parentId } )
    },
    setSelectedFile: ({ commit, rootState}, selectedFile) => {
      commit('SET_SELECTED_FILE', selectedFile)
    },
    clearSelectedFiles: ({ commit, rootState }) => {
      commit('CLEAR_SELECTED_FILES')
    },
    createApplication: async ({ commit, rootState }, newApplication) => {
      const url = `${rootState.config.api2Url}/applications`;

      const userToken = await useGetToken()

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
          },
          body: JSON.stringify(newApplication)
        });

        if (!response.ok) {
          const errorDetails = await response.text(); 
          throw new Error(`Error ${response.status}: ${response.statusText} - ${errorDetails}`);
        }

        const result = await response.json();
        return result;

      } catch (err) {
        console.error('Failed to create application:', err.message); 
        throw err;
      }
    },
    createComputeNode: async ({ commit, rootState }, newComputeNode) => {
      const url = `${rootState.config.api2Url}/compute-nodes`;

      try {
        const userToken = await useGetToken()
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
          },
          body: JSON.stringify(newComputeNode)
        });

        if (!response.ok) {
          const errorDetails = await response.text(); // Extract error details from the response
          throw new Error(`Error ${response.status}: ${response.statusText} - ${errorDetails}`);
        }

        const result = await response.json();
        return result;

      } catch (err) {
        console.error('Failed to create compute node:', err.message); // Log detailed error message
        throw err; // Rethrow the error to be handled by the caller
      }
    },
    createWorkflow: async ({ commit, rootState }, newWorkflow) => {
      const url = `${rootState.config.api2Url}/workflows`;

      try {
        const userToken = await useGetToken()
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
          },
          body: JSON.stringify(newWorkflow)
        });

        if (!response.ok) {
          const errorDetails = await response.text(); 
          throw new Error(`Error ${response.status}: ${response.statusText} - ${errorDetails}`);
        }

        const result = await response.json();
        return result;

      } catch (err) {
        console.error('Failed to workflow:', err.message); 
        throw err; 
      }
    },
    // Note that this to to deploy application, there is another action for editing application
    updateApplication: async ({ commit, rootState }, newApplication) => {
      const url = `${rootState.config.api2Url}/applications/deploy`;
      const userToken = await useGetToken()

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
          },
          body: JSON.stringify(newApplication)
        });
    
        if (!response.ok) {
          const errorDetails = await response.text(); 
          throw new Error(`Error ${response.status}: ${response.statusText} - ${errorDetails}`);
        }
    
        const result = await response.json();
        return result; 
    
      } catch (err) {
        console.error('Failed to update application:', err.message); 
        throw err; 
      }
    },
    updateFileCount: async ({ commit, rootState }) => {
      commit('UPDATE_SELECTED_FILE_COUNT')
    },
    fetchWorkflowInstances: async ({ commit, rootState }) => {

      try {
        const url = `${rootState.config.api2Url}/workflows/instances?organization_id=${rootState.activeOrganization.organization.id}`;
        const userToken = await useGetToken();
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        });
    
        if (resp.ok) {
 
         const result = await resp.json();


          const sortedWorkflows = result.sort((a, b) => {
            const dateA = new Date(a.startedAt).getTime();
            const dateB = new Date(b.startedAt).getTime();
            if (isNaN(dateA)) return 1; 
            if (isNaN(dateB)) return -1; 
            return dateB - dateA; 
          });
          commit("SET_WORKFLOW_INSTANCES", sortedWorkflows);
        } else {
          return Promise.reject(resp);
        }
      } catch (err) {
        commit("SET_WORKFLOW_INSTANCES", []);
        return Promise.reject(err);
      }
    },
    fetchWorkflowLogs: async({commit, rootState }, [workflow, application]) => {
      const userToken = await useGetToken()
      const integrationId = workflow.uuid;
      const applicationId = application.uuid;
      // Fetch application logs
      try {
        const url = `${rootState.config.api2Url}/workflows/instances/${integrationId}/logs?applicationUuid=${applicationId}`;

        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        })

        if (resp.ok) {
          const result = await resp.json()
          commit('SET_WORKFLOW_LOGS', result.messages)
        } else {
          return Promise.reject(resp)
        }
      } catch (err) {
          commit('SET_WORKFLOW_LOGS', [])
          return Promise.reject(err)
      }
    },
setSelectedWorkflowActivity: async ({ commit, dispatch, rootState}, workflow) => {

  if (!workflow) {
    commit('SET_SELECTED_WORKFLOW_ACTIVITY', {})
    return;
  }
  try {
    const url = `${rootState.config.api2Url}/workflows/instances/${workflow.uuid}/status`;

    const userToken = await useGetToken()
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    })
  
    if (resp.ok) {
      const result = await resp.json();

      // This code combines two API responses (/status and /instances) we need properties from, matching on uuid
      // The /instances response is missing status, and the /status response does not tell us the applicationType
      
      const updatedResult = { ...result, workflow: [...result.workflow], name: workflow.name };
      console.log('updatedResult:', updatedResult)

      if (workflow.workflow) {
 // Map each processor from instances to its corresponding status data
      updatedResult.workflow = workflow.workflow.map(instanceProcessor => {
        const statusProcessor = result.workflow.find(statusProc => statusProc.uuid === instanceProcessor.uuid);
        return { ...instanceProcessor, ...statusProcessor };
      });
      }
      
     

      commit('SET_SELECTED_WORKFLOW_ACTIVITY', updatedResult);
      
      const updatedProcessor = updatedResult.workflow.find(
        processor => processor.uuid === rootState.analysisModule.selectedProcessor.uuid
      );
      if (updatedProcessor) {
        commit('SET_SELECTED_PROCESSOR', updatedProcessor);
        if (rootState.analysisModule.activityDialogVisible) {
          dispatch('fetchWorkflowLogs', [workflow, updatedProcessor]);
        }
      }
    } else {
      return Promise.reject(resp)
    }
  } catch (err) {
      commit('SET_SELECTED_WORKFLOW_ACTIVITY', {})
      return Promise.reject(err)
  }
},
    cancelWorkflow: async ({commit}, workflowId) => {
      commit('HIDE_CANCEL_WORKFLOW_DIALOG')
      // API not yet available 
      // const url = `${rootState.config.api2Url}/cancel/workflows/${workflowId}`;
    },
    hideCancelWorkflowDialog: ({commit}) => {
      commit('HIDE_CANCEL_WORKFLOW_DIALOG')
    },
    showActivityLogDialog: ({ commit, rootState }) => {
      commit('SHOW_ACTIVITY_LOG_DIALOG')
    },
    hideActivityLogDialog: ({ commit, rootState }) => {
      commit('HIDE_ACTIVITY_LOG_DIALOG')
    },
    editApplication: async ({commit, rootState}, application) => {
      const url = `${rootState.config.api2Url}/applications/${application?.uuid}`;
      const userToken = await useGetToken()

      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
          },
          body: JSON.stringify(application)
        });
    
        if (!response.ok) {
          const errorDetails = await response.text();
          throw new Error(`Error ${response.status}: ${response.statusText} - ${errorDetails}`);
        }
    
        const result = await response.json();
        return result;
    
      } catch (err) {
        console.error('Failed to update application:', err.message);
        throw err;
      }
    },
    deleteComputeNode: async ({ commit, rootState }, computeNode) => {
      const url = `${rootState.config.api2Url}/compute-nodes/${computeNode?.uuid}`;
      const userToken = await useGetToken()
      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
          }
        });
    
        if (!response.ok) {
          return;
        }
    
      } catch (err) {
        console.error('Failed to update application:', err.message);
        throw err;
      }
    },
    deleteApplication: async ({ commit, rootState }, application) => {
      const url = `${rootState.config.api2Url}/applications/${application?.uuid}`;
      const userToken = await useGetToken()
      try {
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
          }
        });
    
        if (!response.ok) {
          return;
        }
    
      } catch (err) {
        console.error('Failed to update application:', err.message);
        throw err;
      }
    },
    editComputeNode: async ({ commit, rootState }, computeNode) => {
      const url = `${rootState.config.api2Url}/compute-nodes/${computeNode?.uuid}`;
      const userToken = await useGetToken()
      try {
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
          },
          body: JSON.stringify(computeNode)
        });
    
        if (!response.ok) {
          return;
        }
    
      } catch (err) {
        console.error('Failed to update compute node:', err.message);
        throw err;
      }
    },
    setSelectedProcessor: ({ commit, rootState }, processor) => {
      commit('SET_SELECTED_PROCESSOR', processor)
    },
    fetchWorkflows: async({ commit, rootState }) => {
      try {
        const userToken = await useGetToken()
        const url = `${rootState.config.api2Url}/workflows?organization_id=${rootState.activeOrganization.organization.id}`;
        
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        })

        if (resp.ok) {
          const result = await resp.json()
          console.log('here', result)
          commit('UPDATE_WORKFLOWS', result)
        } else {
          return Promise.reject(resp)
        }
      } catch (err) {
        commit('UPDATE_WORKFLOWS', [])
        return Promise.reject(err)
      }
    }
  }
  
  export const getters = {
    workflowInstances: state => state.workflowInstances,
    workflowInstance: state => state.workflowInstance,
    workflowLogs: state => state.workflowLogs,
    selectedWorkflowActivity: state => state.selectedWorkflowActivity,
    activityDialogVisible: state => state.activityDialogVisible,
    selectedProcessor: state => state.selectedProcessor
  }
  
  const analysisModule = {
    namespaced: true,
    state,
    mutations,
    actions,
    getters
  }
  
  export default analysisModule 
  