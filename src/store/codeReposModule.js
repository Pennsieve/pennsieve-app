import Cookies from "js-cookie";

const initialState = () => ({
  myRepos: [],
  myReposPaginationParams: {
    page: 1,
    size: 10,
    currentPage: 1
  },
  myReposCount: 100,
  myReposLoaded: false,
  workspaceRepos: [],
  workspaceReposPaginationParams: {
    limit: 10,
    offset: 0,
    currentPage: 1
  },
  workspaceReposCount: 0,
  workspaceReposLoaded: false,
  datasetId: "",
  activeRepo: {}
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
  UPDATE_WORKSPACE_REPOS(state, udpatedWorkspaceRepo) {
    state.workspaceRepos = state.workspaceRepos.map((repo) => {
      if(repo.content.id === udpatedWorkspaceRepo.content.id) {
        return udpatedWorkspaceRepo
      } else return repo
    })
  },
  SET_WORKSPACE_REPOS_OFFSET(state, offset) {
    state.workspaceReposPaginationParams.offset = offset;
  },
  SET_WORKSPACE_REPOS_CURRENT_PAGE(state, currentPage) {
    state.workspaceReposPaginationParams.currentPage = currentPage;
  },
  SET_ACTIVE_CODE_REPO(state, activeRepoId) {
    state.activeRepo = state.workspaceRepos.find(repo => repo.content.id === activeRepoId)
  }

}

export const actions = {
  /*
    This method fetches github repos that belong to the authenticated user. 
    Use this data to populate the MyRepos view. 
  */
  fetchMyRepos: async({ commit, rootState }, { page, size, count }) => {
    // we are currently missing a total count from the API, so size is hardcoded - API limits it a 100, but I set it to 1000 in case they remove that limit
    // we derive the count from the count property on the response
      // if (count === 0) {
      //   try {
      //     const url =`${rootState.config.api2Url}/repositories/github?size=1000`
      //     const apiKey = rootState.userToken || Cookies.get('user_token')
      //     const myHeaders = new Headers()
      //     myHeaders.append('Authorization', 'Bearer ' + apiKey)
      //     myHeaders.append('Accept', 'application/json')
      //     const response = await fetch(url, { headers: myHeaders })
      //     if (response.ok) {
      //       const responseJson = await response.json()
      //       console.log('/repositories/github response', responseJson)
      //       const myReposCount = responseJson.count
      //       commit('SET_MY_REPOS_COUNT', myReposCount)
      //       console.log('** MY REPOS TOTAL COUNT: **', myReposCount)
      //     } else {
      //       commit('SET_MY_REPOS_COUNT', 0)
      //       throw new Error(response.statusText)
      //     }
      //   }
      //   catch (err) {
      //     commit('SET_MY_REPOS_COUNT', 0)
      //   }
      // }
      // Fetch paginated repos for the MyRepos view.
      try {
        const url =`${rootState.config.api2Url}/repositories?page=${page}&size=${size}`
        const apiKey = rootState.userToken || Cookies.get('user_token')
        const myHeaders = new Headers()
        myHeaders.append('Authorization', 'Bearer ' + apiKey)
        myHeaders.append('Accept', 'application/json')
        const response = await fetch(url, { headers: myHeaders })
        if (response.ok) {
          const responseJson = await response.json()
          const myRepos = responseJson.repos
          console.log('** MY REPOS: **', myRepos)
          commit('SET_MY_REPOS', myRepos);
          commit('SET_MY_REPOS_CURRENT_PAGE', page);

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

  updateWorkspaceRepoOffset: ({ commit }, offset) => {
    commit('SET_WORKSPACE_REPOS_OFFSET', offset)
  },

  fetchWorkspaceRepos: async ({ commit, rootState }, { limit, offset, page }) => {
    try {
      const url = `${rootState.config.apiUrl}/datasets/paginated?limit=${limit}&offset=${offset}&type=release`
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
        console.log('** WORKSPACE REPOS: **', workspaceRepos)
        commit('SET_WORKSPACE_REPOS', workspaceRepos)
        console.log('** WORKSPACE REPOS TOTAL COUNT: **', workspaceRepos.totalCount)
        commit('SET_WORKSPACE_REPOS_COUNT', workspaceRepos.totalCount)
        commit('SET_WORKSPACE_REPOS_CURRENT_PAGE', page)
      } else {
        throw new Error(response.statusText)
      }
    }
    catch (err) {
      console.error(err);
    }
  },
  
  saveRepoSettings: async({state, commit, rootState }, { formVal, repo }) => {
    const { url } = repo.value.content.releases[0];
    const { intId } = repo?.value?.content;

    const { description, givenName, isAutoPublished, tags } = repo
    const bodyToSend = {
      organization_id: rootState.activeOrganization.organization.intId,
      dataset_id: intId,
      url: url,
      name: formVal.givenName,
      subtitle: formVal.description,
      auto_publish: formVal.isAutoPublished,
      tags: formVal.tags,
      // "sync": {
      //   "banner": boolean,
      //   "readme": boolean,
      //   "changelog": boolean,
      //   "license": boolean,
      //   "contributors": boolean
      // }
    }
    try {
      const url = `${rootState.config.api2Url}/repository/external`
      const apiKey = rootState.userToken || Cookies.get('user_token')
      const myHeaders = new Headers();
      myHeaders.append('Authorization', 'Bearer ' + apiKey)
      myHeaders.append('Accept', 'application/json')
      const response = await fetch(url, {
        method: "PUT",
        headers: myHeaders,
        body: JSON.stringify(bodyToSend)
      })
      if (!response.ok) {
        throw new Error(`${response.status}`);
      }

      return response;
    }
    catch (err) {
      console.error(err);
      throw err; 
    }
    
   
  },

  publishCodeRepo: async ({ commit, rootState }, { repo }) => {
    const { url } = repo.content.releases[0];
    const { intId } = repo.content

    const bodyToSend = {
      organization_id: rootState.activeOrganization.organization.intId,
      dataset_id: intId, 
      url,
      type: 'publishing'
    }
    try {
      const url = `${rootState.config.api2Url}/repository/publish`
      const apiKey = rootState.userToken || Cookies.get('user_token')
      const myHeaders = new Headers();
      myHeaders.append('Authorization', 'Bearer ' + apiKey)
      myHeaders.append('Accept', 'application/json')
      const response = await fetch(url, {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify(bodyToSend)
      })
      if (!response.ok) {
        throw new Error(`${response.status}`);
      }

      return response;
    }
    catch (err) {
      console.error(err);
      throw err; 
    }
  }
}

export const getters = {
  activeRepo : state => state.activeRepo
}

const codeReposModule = {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}

export default codeReposModule
