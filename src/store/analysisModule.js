import { useGetToken } from "@/composables/useGetToken";

const initialState = () => ({
    computeNodes: [],
    computeNodesLoaded: false,
    applications: [],
    applicationsLoaded: false,
    processors: [],
    preprocessors:[],
    selectedWorkflow: {},
    selectedFilesForAnalysis: [],
    computeResourceAccounts: [] ,
    /*
      In the selectedFilesForAnalysis obj files are grouped by parentId
      where key is parentId, and value is an array of files that share a parentID.
      For files in the root directory, they key is the string 'root'.
      Example: { root: [{...file1}, {...file2}, {...file3}], parentId: [{}, {}] }
      This is to support multi-level file selection.
    */
    fileCount: 0,
    workflowInstances: [],
    selectedWorkflowActivity: {},
    cancelWorkflowDialogVisible: false,
    activityDialogVisible: false
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
    }
  
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
          const errorDetails = await response.text(); // Extract error details
          throw new Error(`Error ${response.status}: ${response.statusText} - ${errorDetails}`);
        }

        const result = await response.json();
        return result; // Return the result for further processing if needed

      } catch (err) {
        console.error('Failed to create application:', err.message); // Log error details
        throw err; // Rethrow the error to be handled by the caller
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
        return result; // Return the result for further processing if needed

      } catch (err) {
        console.error('Failed to create compute node:', err.message); // Log detailed error message
        throw err; // Rethrow the error to be handled by the caller
      }
    },
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
          const errorDetails = await response.text(); // Extract error details
          throw new Error(`Error ${response.status}: ${response.statusText} - ${errorDetails}`);
        }
    
        const result = await response.json();
        return result; // Return the result for further processing if needed
    
      } catch (err) {
        console.error('Failed to update application:', err.message); // Log error details
        throw err; // Rethrow the error to be handled by the caller
      }
    },
    updateFileCount: async ({ commit, rootState }) => {
      commit('UPDATE_SELECTED_FILE_COUNT')
    },
    fetchWorkflowInstances: async ({ commit, rootState }) => {
      let workflowInstances = [];
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
          workflowInstances = await resp.json();
          commit("SET_WORKFLOW_INSTANCES", workflowInstances);
        } else {
          return Promise.reject(resp);
        }
      } catch (err) {
        commit("SET_WORKFLOW_INSTANCES", []);
        return Promise.reject(err);
      }
    
      // try {
      //   const userToken = await useGetToken();
      //   const statusRequests = workflowInstances.map(async (instance) => {
      //     const statusUrl = `${rootState.config.api2Url}/workflows/instances/${instance.uuid}/status`;
      //     const resp = await fetch(statusUrl, {
      //       method: "GET",
      //       headers: {
      //         Authorization: `Bearer ${userToken}`,
      //       },
      //     });
    
      //     if (resp.ok) {
      //       return resp.json();
      //     } else {
      //       return { uuid: instance.uuid, status: "UNKNOWN" }; 
      //     }
      //   });
    
      //   // Wait for all status requests to complete
      //   const statusResults = await Promise.all(statusRequests);
    
      //   // Merge status into workflow instances
      //   const mergedObjects = workflowInstances.map(workflow => {
      //     const matchedStatus = statusResults.find(status => status.uuid === workflow.uuid);
      //     return {
      //       ...workflow,
      //       status: matchedStatus ? matchedStatus.status : "UNKNOWN",
      //     };
      //   });
    
      //   commit("SET_WORKFLOW_INSTANCES",  mergedObjects);
    
      // } catch (err) {
      //   console.error("Error fetching statuses:", err);
      // } 
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
    fetchWorkflowInstance: async({commit, dispatch, rootState }, uuid) => {
      try {
        const url = `${rootState.config.api2Url}/workflows/instances/${uuid}/status`;

        const userToken = await useGetToken()
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        })

        if (resp.ok) {
          const result = await resp.json()
          result.workflow = result.processors
          delete result.processors
          commit('SET_SELECTED_WORKFLOW_ACTIVITY', result)
        } else {
          return Promise.reject(resp)
        }
      } catch (err) {
          commit('SET_SELECTED_WORKFLOW_ACTIVITY', {})
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

        function mergeByUUID(applications, statuses) {
          // Create a map of statuses for quick lookup by uuid
          const statusMap = statuses.reduce((map, status) => {
              map[status.uuid] = status;
              return map;
          }, {});
      
          // Merge applications with their corresponding statuses
          return applications.map(app => {
              const matchingStatus = statusMap[app.uuid] || {};
              return {
                  ...app,
                  ...matchingStatus
              };
          });
      }
      

        if (resp.ok) {
          const result = await resp.json()
          result.workflow = mergeByUUID(workflow.workflow, result.processors)
          result.name = workflow.name
          commit('SET_SELECTED_WORKFLOW_ACTIVITY', result)
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
      // API work inprogress for this feature
      // try {
      //   const url = `${rootState.config.api2Url}/cancel/workflows/${workflowId}`;

      //   const userToken = await useGetToken()
      //   const resp = await fetch(url, {
      //     method: 'POST',
      //     headers: {
      //       Authorization: `Bearer ${userToken}`,
      //     },
      //   })

      //   if (resp.ok) {
      //     const result = await resp.json()
      //     return result
      //   } else {
      //     return Promise.reject(resp)
      //   }
      // } catch (err) {
      //     return Promise.reject(err)
      // }
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
    }
  }
  
  export const getters = {
    workflowInstances: state => state.workflowInstances,
    workflowInstance: state => state.workflowInstance,
    workflowLogs: state => state.workflowLogs,
    selectedWorkflowActivity: state => state.selectedWorkflowActivity,
    activityDialogVisible: state => state.activityDialogVisible
  }
  
  const analysisModule = {
    namespaced: true,
    state,
    mutations,
    actions,
    getters
  }
  
  export default analysisModule 
  