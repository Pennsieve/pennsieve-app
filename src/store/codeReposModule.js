import Cookies from "js-cookie";

const initialState = () => ({
  myRepos: [],
  myReposPaginationParams: {
    page: 1,
    size: 10,
    currentPage: 1
  },
  myReposCount: 25,
  myReposLoaded: false,
  workspaceRepos: [],
  workspaceReposPaginationParams: {
    limit: 5,
    offset: 0,
    currentPage: 1
  },
  workspaceReposCount: 5,
  workspaceReposLoaded: false
})

export const state = initialState()

export const mutations = {
  CLEAR_STATE(state) {
    const _initialState = initialState()
    // need to iteratively set keys to preserve reactivity
    Object.keys(_initialState).forEach(key => state[key] = _initialState[key])
  },
  SET_MY_REPOS(state, myRepos) {
    state.myRepos = myRepos;
    state.myReposLoaded = true;
  },
  SET_MY_REPOS_CURRENT_PAGE(state, currentPage) {
    state.myReposPaginationParams.currentPage = currentPage;
  },
  SET_MY_REPOS_COUNT(state, count) {
    state.myReposCount = count
  },
  SET_WORKSPACE_REPOS(state, workspaceRepos) {
    state.workspaceRepos = workspaceRepos.datasets
    state.workspaceReposLoaded = true;
  },
  SET_WORKSPACE_REPOS_COUNT(state, count) {
    state.workspaceReposCount = count
  }, 
  SET_WORKSPACE_REPOS_CURRENT_PAGE(state, currentPage) {
    state.currentPage = currentPage;
  },
  SET_WORKSPACE_REPOS_OFFSET(state, offset) {
    state.workspaceReposPaginationParams.offset = offset;
  }
}

export const actions = {

  /*
    This method fetches github repos that belong to the authenticated user. 
    Use this data to populate the MyRepos view. 
  */
  fetchMyRepos: async({ commit, rootState }, { page, size, count, currentPage }) => {
    // Fetch all repos to get the total count, TODO: include total count in paginated response to avoid extra call.
      if (count === 0) {
        try {
          const url =`${rootState.config.api2Url}/repositories/github`
          const apiKey = rootState.userToken || Cookies.get('user_token')
          const myHeaders = new Headers()
          myHeaders.append('Authorization', 'Bearer ' + apiKey)
          myHeaders.append('Accept', 'application/json')
          const response = await fetch(url, { headers: myHeaders })
          if (response.ok) {
            const responseJson = await response.json()
            const myReposCount = responseJson.count
            console.log('myReposCount', myReposCount)
            commit('SET_MY_REPOS_COUNT', myReposCount)
          } else {
            commit('SET_MY_REPOS_COUNT', 0)
            throw new Error(response.statusText)
          }
        }
        catch (err) {
          commit('SET_MY_REPOS_COUNT', 0)
        }
      }
      // Fetch paginated repos for the MyRepos view.
      try {
        const url =`${rootState.config.api2Url}/repositories/github?page=${page}&size=${size}`
        const apiKey = rootState.userToken || Cookies.get('user_token')
        const myHeaders = new Headers()
        myHeaders.append('Authorization', 'Bearer ' + apiKey)
        myHeaders.append('Accept', 'application/json')
        const response = await fetch(url, { headers: myHeaders })
        if (response.ok) {
          const responseJson = await response.json()
          const myRepos = responseJson.repos
          console.log('MyRepos', myRepos)
          commit('SET_MY_REPOS', myRepos);
          commit('SET_MY_REPOS_CURRENT_PAGE', currentPage);

        } else {
          commit('SET_MY_REPOS', [])
          commit('SET_MY_REPOS_LOADED', false);
          throw new Error(response.statusText)
        }
      }
      catch (err) {
        commit('SET_MY_REPOS', [])
      }
  },

  enableRepoTracking: async({ commit, rootState }, { repo }) => {
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
        const repo = await response.json()
      } else {
        throw new Error(response.statusText)
      }
    }
    catch (err) {
      console.error(err);
    }
  },

  disableRepoTracking: async({ commit, rootState }, { repo }) => {
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
        const repo = await response.json()
      } else {
        throw new Error(response.statusText)
      }
    }
    catch (err) {
      console.error(err);
    }
  },

  updateWorkspaceRepoOffset: ({ commit, rootState }, offset) => {
    commit('SET_WORKSPACE_REPOS_OFFSET', offset)
  },

  fetchWorkspaceRepos: async ({ commit, rootState }, { limit, offset }) => {
    try {
      const url = `${rootState.config.apiUrl}/datasets/paginated?limit=${limit}&offset=${offset}&publicationType=release`
      const apiKey = rootState.userToken || Cookies.get('user_token')
      const myHeaders = new Headers();
      myHeaders.append('Authorization', 'Bearer ' + apiKey)
      myHeaders.append('Accept', 'application/json')
      const response = await fetch(url, {
        method: "GET",
        headers: myHeaders,
      })
      if (response.ok) {
        const workspaceRepos = await response.json()
        console.log('workspaceRepos', workspaceRepos)
        commit('SET_WORKSPACE_REPOS', workspaceRepos)
        commit('SET_WORKSPACE_REPOS_COUNT', workspaceRepos.totalCount)
      } else {
        throw new Error(response.statusText)
      }
    }
    catch (err) {
      console.error(err);
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
