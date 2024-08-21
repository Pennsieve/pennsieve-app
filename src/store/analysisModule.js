
  const initialState = () => ({
    computeNodes: [],
    applications: [],
    preprocessors:[],
    processors: [],
    preprocessors:[],
    selectedWorkflow: {},
    selectedFilesForAnalysis: [],
    computeResourceAccounts: [] 
  })
  
  export const state = initialState()
  
  export const mutations = {
 
    UPDATE_COMPUTE_NODES(state, computeNodes) {
      state.computeNodes = computeNodes
    },
    UPDATE_APPLICATIONS(state, applications) {
      state.applications = applications
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
    SET_SELECTED_FILES(state, files) {
      state.selectedFilesForAnalysis = files;
    },
    SET_SELECTED_FILE(state, file) {
      state.selectedFilesForAnalysis = [...state.selectedFilesForAnalysis, file]
    },
    CLEAR_SELECTED_FILES(state) {
      state.selectedFilesForAnalysis = []
    },
    SET_COMPUTE_RESOURCE_ACCOUNTS(state, accounts) {
      state.computeResourceAccounts = accounts
    }
 
  }
  
  export const actions = {
    fetchComputeNodes: async({ commit, rootState }) => {
      try {
        const url = `${rootState.config.api2Url}/compute-nodes`;
  
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${rootState.userToken}`,
          },
        })
  
        if (resp.ok) {
          const result = await resp.json()
          commit('UPDATE_COMPUTE_NODES', result)
        } else {
          return Promise.reject(resp)
        }
      } catch (err) {
          commit('UPDATE_COMPUTE_NODES', [])
          return Promise.reject(err)
      }
    },
    fetchApplications: async({ commit, rootState }) => {
      try {
        const url = `${rootState.config.api2Url}/applications`;
  
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${rootState.userToken}`,
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
  
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${rootState.userToken}`,
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

        console.log('response')
    
        if (!response.ok) {
          const errorDetails = await response.text(); // Extract error details from the response
          throw new Error(`Error ${response.status}: ${response.statusText} - ${errorDetails}`);
        }
    
        const result = await response.json();
        return result; // Return the result for further processing if needed
    
      } catch (err) {
        console.log('we got here')
        console.error('Failed to create compute node:', err.message); // Log detailed error message
        throw err; // Rethrow the error to be handled by the caller
      }
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
  