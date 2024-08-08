
  const initialState = () => ({
    computeNodes: [],
    applications: [],
    preprocessors:[],
    processors: [],
    preprocessors:[],
    selectedWorkflow: {},
    selectedFilesForAnalysis: {},
    fileCount: 0
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
    UPDATE_SELECTED_FILE_COUNT(state) {
      let total = 0;
      for (const parentId in state.selectedFilesForAnalysis) {
          total = total + state.selectedFilesForAnalysis[parentId].length
      }
    
      state.fileCount = total;
    },
    SET_SELECTED_FILES(state, { files, parentId }) {
      if (files.length) {
        const parentId = files[0].content.parentId || 'root';
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
        state.selectedFilesForAnalysis[`${parentId}`] = []
      }
    },
   
    
    
    CLEAR_SELECTED_FILES(state) {
      state.selectedFilesForAnalysis = {}
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
    setSelectedFiles: async({ commit, rootState}, { selectedFiles, parentId }) => {
      console.log('selectedFiles', selectedFiles)
      console.log('parentId', parentId)
      commit('SET_SELECTED_FILES', { files: selectedFiles, parentId })
    },
    clearSelectedFiles: async({ commit, rootState }) => {
      commit('CLEAR_SELECTED_FILES')
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
  