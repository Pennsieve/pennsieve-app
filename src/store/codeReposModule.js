import Cookies from "js-cookie";

const initialState = () => ({
  myRepos: [],
  myReposCount: 0,
  myReposLoaded: false,
  workspaceRepos: [],
  workspaceReposCount: 0,
  workspaceReposLoaded: false
})

export const state = initialState()

export const mutations = {
  CLEAR_STATE(state) {
    //reset all state to initial state
    const _initialState = initialState()
    // need to iteratively set keys to preserve reactivity
    Object.keys(_initialState).forEach(key => state[key] = _initialState[key])
  },
  SET_MY_REPOS(state, myRepos) {
    state.myRepos = myRepos
    state.myReposLoaded = true;
  },
  SET_MY_REPOS_COUNT(state, count) {
    state.myReposCount = count
  },
  SET_WORKSPACE_REPOS(state, workspaceRepos) {
    state.workspaecRepos = workspaceRepos
    state.workspaceReposLoaded = true;
  },
  SET_WORKSPACE_REPOS_COUNT(state, count) {
    state.workspaceReposCount = count
  },
  UPDATE_REPO_IN_WORKSPACE_REPOS(state, modifiedRepo) {
    const index = state.workspaceRepos.findIndex(repo => repo.id === modifiedRepo.id);
  
    if (index !== -1) {
      state.workspaceRepos.splice(index, 1, modifiedRepo)
    }
  }
}

export const actions = {
  updatePublishingInfo: ({commit}, data) => commit('UPDATE_PUBLISHING_INFO', data),

  fetchMyRepos: async({ commit, rootState }) => {
    try {
      const url = `${rootState.config.api2Url}/repositories/github`
      const apiKey = rootState.userToken || Cookies.get('user_token')
      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + apiKey)
      myHeaders.append('Accept', 'application/json')
      const response = await fetch(url, { headers: myHeaders })
      if (response.ok) {
        const responseJson = await response.json()
        const myRepos = responseJson.repos
        const myReposCount = responseJson.count
        commit('SET_MY_REPOS', myRepos)
        commit('SET_MY_REPOS_COUNT', myReposCount)
      } else {
        commit('SET_MY_REPOS', [])
        commit('SET_MY_REPOS_COUNT', 0)
        throw new Error(response.statusText)
      }
    }
    catch (err) {
      // add error handling - display message or alert indicating the error
      commit('SET_MY_REPOS', null)
      commit('SET_MY_REPOS_COUNT', 0)
    }
  },

  fetchExternalRepos: async({ commit, rootState }) => {
    try {
      const url = `${rootState.config.api2Url}/repositories/external`
      const apiKey = rootState.userToken || Cookies.get('user_token')
      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + apiKey)
      myHeaders.append('Accept', 'application/json')
      const response = await fetch(url, { headers: myHeaders })
      if (response.ok) {
        const responseJson = await response.json()
        const externalRepos = responseJson.repos
        const externalReposCount = responseJson.count
        commit('SET_EXTERNAL_REPOS', externalRepos)
        commit('SET_EXTERNAL_REPOS_COUNT', externalReposCount)
      } else {
        commit('SET_EXTERNAL_REPOS', [])
        commit('SET_EXTERNAL_REPOS_COUNT', 0)
        throw new Error(response.statusText)
      }
    }
    catch (err) {
      // add error handling - display message or alert indicating the error
      commit('SET_EXTERNAL_REPOS', null)
      commit('SET_EXTERNAL_REPOS_COUNT', 0)
    }
  },

  enableRepoTracking: async({ commit, rootState, repo }) => {
    try {
      const url = `${rootState.config.api2Url}/repository/enable`
      const apiKey = rootState.userToken || Cookies.get('user_token')
      const myHeaders = new Headers();
      myHeaders.append('Authorization', 'Bearer ' + apiKey)
      myHeaders.append('Accept', 'application/json')
      const response = await fetch(url, {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({origin: repo.origin, url: repo.url, type: repo.type})
      })
      if (response.ok) {
        const updatedRepo = await response.json()
        commit('UPDATE_REPO_IN_EXTERNAL_REPOS', updatedRepo)
      } else {
        throw new Error(response.statusText)
      }
    }
    catch (err) {
      // add error handling - display message or alert indicating the error
    }
  },

  disableRepoTracking: async({ commit, rootState, repo }) => {
    try {
      const url = `${rootState.config.api2Url}/repository/disable`
      const apiKey = rootState.userToken || Cookies.get('user_token')
      const myHeaders = new Headers();
      myHeaders.append('Authorization', 'Bearer ' + apiKey)
      myHeaders.append('Accept', 'application/json')
      const response = await fetch(url, {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({origin: repo.origin, url: repo.url, type: repo.type})
      })
      if (response.ok) {
        const updatedRepo = await response.json()
        commit('UPDATE_REPO_IN_EXTERNAL_REPOS', updatedRepo)
      } else {
        throw new Error(response.statusText)
      }
    }
    catch (err) {
      // add error handling - display message or alert indicating the error
    }
  }
}

const codeReposModule = {
  namespaced: true,
  state,
  mutations,
  actions,
}

export default codeReposModule
