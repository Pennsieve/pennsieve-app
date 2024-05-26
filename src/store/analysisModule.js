
  const initialState = () => ({
    computeNodes: [],
  })
  
  export const state = initialState()
  
  export const mutations = {
 
    UPDATE_COMPUTE_NODES(state, computeNodes) {
      state.computeNodes = computeNodes
    },
 
  }
  
  export const actions = {
    fetchComputeNodes: async({ commit, rootState }) => {
      const url = `${rootState.config.api2Url}/compute-nodes`;

      this.sendXhr(url, {
        method: "GET",
        header: {
          Authorization: `Bearer ${rootState.userToken}`,
        },
      })
        .then((response) => {
          commit('UPDATE_COMPUTE_NODES', response)
        })
        .catch((response) => {
          this.handleXhrError(response);
          EventBus.$emit("toast", {
            detail: {
              msg: "Sorry! There was an issue fetching your data",
              type: "error",
            },
          });
        });
    },
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
  