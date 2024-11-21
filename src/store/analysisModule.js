import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError} from "@/mixins/request/request_composable";

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
    fileCount: 0
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
    SET_SELECTED_FILES(state, { files, parentId }) {
      if (files.length) {
        const updatedObj = { ...state.selectedFilesForAnalysis };

        // Get the existing files for the parentId
        const existingFiles = updatedObj[parentId] || [];

        // Filter out duplicates
        const nonDuplicateFiles = files.filter(
          newFile => !existingFiles.some(existingFile => existingFile.content.id === newFile.content.id)
        );

        // Combine existing files with non-duplicate new files
        const updatedFiles = [...existingFiles, ...nonDuplicateFiles];

        // Remove any files in existingFiles that are not present in files
        updatedObj[parentId] = updatedFiles.filter(
          file => files.some(newFile => newFile.content.id === file.content.id)
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

  }

  export const actions = {
    fetchComputeNodes: async({ commit, rootState }) => {
      return useGetToken()
        .then(token => {
          const url = `${rootState.config.api2Url}/compute-nodes`;
          return fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            }
          })
            .then(resp => {
              if (resp.ok) {
                return resp.json()
                    .then(commit('UPDATE_COMPUTE_NODES'))
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

        const url = `${rootState.config.api2Url}/applications`;
  
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
        const url = `${rootState.config.api2Url}/accounts`;

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
    setSelectedFiles: async({ commit, rootState}, selectedFiles) => {
      commit('SET_SELECTED_FILES', selectedFiles)
    },
    setSelectedFile: async({ commit, rootState}, selectedFile) => {
      commit('SET_SELECTED_FILE', selectedFile)
    },
    clearSelectedFiles: async({ commit, rootState }) => {
      commit('CLEAR_SELECTED_FILES')
    },
    createApplication: async ({ commit, rootState }, newApplication) => {
      const url = `${rootState.config.api2Url}/applications`;

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${rootState.userToken}`
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
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${rootState.userToken}`
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
    
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${rootState.userToken}`
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
    }
  }
  
  export const getters = {}
  
  const analysisModule = {
    namespaced: true,
    state,
    mutations,
    actions,
    getters
  }
  
  export default analysisModule 
  
