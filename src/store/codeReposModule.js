import Cookies from "js-cookie";
import {
  pathOr,
  propOr
} from 'ramda'
import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError} from "@/mixins/request/request_composable";

const initialState = () => ({
  myRepos: [],
  myReposPaginationParams: {
    page: 1,
    size: 10,
    currentPage: 1
  },
  myReposCount: 0,
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
  activeRepo: {},
  activeRepoBannerURL: '',
  isLoadingCodeRepoBanner: false,
  hasReadMe: false,
  canPublish: false
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
  },
  SET_CODE_REPO_BANNER_URL(state, URL) {
    state.activeRepoBannerURL = URL;
  },
  SET_IS_LOADING_CODE_REPO_BANNER(state, isLoadingBanner) {
    state.isLoadingCodeRepoBanner = isLoadingBanner
  },
  SET_HAS_README(state, readMe) {
    state.hasReadMe = Object.keys(readMe).length !== 0;
  }
}

export const actions = {
  /*
    This method fetches github repos that belong to the authenticated user. 
    Use this data to populate the MyRepos view. 
  */
  fetchMyRepos: async({ commit, rootState }, { page, size }) => {
      // Fetch paginated repos for the MyRepos view.
      try {
        useGetToken()
            .then(token =>{
              const url =`${rootState.config.api2Url}/repositories?page=${page}&size=${size}`
              const myHeaders = new Headers()
              myHeaders.append('Authorization', 'Bearer ' + token)
              myHeaders.append('Accept', 'application/json')
              return fetch(url, { headers: myHeaders })
                .then(response => {
                  if (response.ok) {
                    return response.json()
                      .then(json => {
                        const myRepos = json.repos
                        commit('SET_MY_REPOS', myRepos);
                        commit('SET_MY_REPOS_CURRENT_PAGE', page);
                        commit('SET_MY_REPOS_COUNT', json.count)
                      })
                  } else {
                    commit('SET_MY_REPOS', [])
                    commit('SET_MY_REPOS_LOADED', false);
                    throw new Error(response.statusText)
                  }
                })
        })
      }
      catch (err) {
        console.log('Error fetching my repos')
        commit('SET_MY_REPOS', [])
      }
  },

  enableRepoTracking: async({ commit, rootState }, { repo }) => {
      return useGetToken()
        .then(token =>{
          const url = `${rootState.config.api2Url}/repository/enable`
          const myHeaders = new Headers();
          myHeaders.append('Authorization', 'Bearer ' + token)
          myHeaders.append('Accept', 'application/json')
          return fetch(url, {
            method: "POST",
            headers: myHeaders,
            body: JSON.stringify({origin: repo.origin, url: repo.url, type: repo.type})
          })
            .then(response => {
              if (response.ok) {
                return response.json()
              } else {
                throw new Error(response.statusText)
              }
            })
        })

  },

  disableRepoTracking: async({ commit, rootState }, { repo }) => {
      return useGetToken()
          .then(token =>{
            const url = `${rootState.config.api2Url}/repository/disable`
            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            return fetch(url, {
              method: "POST",
              headers: myHeaders,
              body: JSON.stringify({origin: repo.origin, url: repo.url, type: repo.type})
            })
              .then(response => {
                if (response.ok) {
                  return response.json()
                } else {
                  throw new Error(response.statusText)
                }
              })
          })
          .catch(useHandleXhrError)


  },

  updateWorkspaceRepoOffset: ({ commit }, offset) => {
    commit('SET_WORKSPACE_REPOS_OFFSET', offset)
  },

  fetchWorkspaceRepos: async ({ commit, rootState, dispatch }, { limit, offset, page }) => {
    try {
      useGetToken()
          .then(token =>{
            const url = `${rootState.config.apiUrl}/datasets/paginated?limit=${limit}&offset=${offset}&type=release`
            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            return fetch(url, {
              method: "GET",
              headers: myHeaders,
            })
                .then(response => {
                  if (response.ok) {
                    return response.json()
                        .then(workspaceRepos => {
                          commit('SET_WORKSPACE_REPOS', workspaceRepos)
                          commit('SET_WORKSPACE_REPOS_COUNT', workspaceRepos.totalCount)
                          commit('SET_WORKSPACE_REPOS_CURRENT_PAGE', page)
                          dispatch('fetchWorkspaceReposBanner')
                        })
                  } else {
                    throw new Error(response.statusText)
                  }
                })

          })
          .catch(useHandleXhrError)

    }
    catch (err) {
      console.error(err);
    }
  },
  
  saveRepoSettings: async({ state, commit, rootState }, { formVal, repo }) => {
    const { url } = repo.content.releases[0];
    const { intId } = repo.content;
    const bodyToSend = {
      organization_id: rootState.activeOrganization.organization.intId,
      dataset_id: intId,
      url: url,
      name: formVal.givenName,
      description: formVal.description,
      auto_publish: formVal.isAutoPublished,
      tags: formVal.tags,
    }
    try {
      return useGetToken()
          .then(token =>{
            const url = `${rootState.config.api2Url}/repository/external`
            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            return fetch(url, {
              method: "PUT",
              headers: myHeaders,
              body: JSON.stringify(bodyToSend)
            })
                .then(response => {
                  if (!response.ok) {
                    throw new Error(`${response.status}`);
                  }
                  return Promise.resolve()
                })
            })
            .catch(useHandleXhrError)
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
      return useGetToken()
          .then(token =>{
            const url = `${rootState.config.api2Url}/repository/publish`
            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            return fetch(url, {
              method: "POST",
              headers: myHeaders,
              body: JSON.stringify(bodyToSend)
            })
                .then(response => {
                  if (!response.ok) {
                    throw new Error(`${response.status}`);
                  }
                  return Promise.resolve()
                })
          })
          .catch(useHandleXhrError)



      return response;
    }
    catch (err) {
      console.error(err);
      throw err; 
    }
  },

  fetchBanner: async ({commit, rootState}, datasetId) => {
    const token = await useGetToken();
    commit('SET_IS_LOADING_CODE_REPO_BANNER', true)
    const url = `${rootState.config.apiUrl}/datasets/${datasetId}/banner?api_key=${token}`
    try {
      const myHeaders = new Headers();
      myHeaders.append('Accept', 'application/json')
      const response = await fetch(url, {
        method: "GET",
        headers: myHeaders,
      }).then((res)=> {
        if(!res.ok) {
          throw new Error(`${res.status}`);
        } else {
          return res.json()
        }
        }).then((res) => {
          const bannerURL = propOr('', 'banner', res)
          commit('SET_CODE_REPO_BANNER_URL', bannerURL)
          commit('SET_IS_LOADING_CODE_REPO_BANNER', false)
          return bannerURL
        })
      return response
    }
    catch (err) {
      commit('SET_IS_LOADING_CODE_REPO_BANNER', false)
      console.error(err);
    }
  },

  fetchWorkspaceReposBanner: async({state, commit, dispatch}) => {
    state.workspaceRepos.forEach(async (repo) => {
      const url = await dispatch('fetchBanner', repo.content.id)
      const updatedWorkspaceRepo = { ...repo, presignedBannerURL : url}
      commit('UPDATE_WORKSPACE_REPOS', updatedWorkspaceRepo)
    })
  },
  fetchReadMe: async({state, commit, rootState, dispatch}, id) => {
    try {
      return useGetToken()
          .then(token =>{
            const url = `${rootState.config.apiUrl}/datasets/${id}/readme`
            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')
            return fetch(url, {
              method: "GET",
              headers: myHeaders
            })
                .then(response => {
                  if (response.ok) {
                    return response.json()
                        .then(readMe => {
                          commit('SET_HAS_README', readMe)
                          return readMe
                        })
                  } else {
                    throw new Error(`${response.status}`);
                  }
                })
          })
          .catch(useHandleXhrError)
    }
    catch (err) {
      console.error(err);
      throw err; 
    }

  },
}

export const getters = {
  activeRepo : state => state.activeRepo,
  activeRepoDatasetId : state => pathOr('', ['content', 'id'], state.activeRepo),
  bannerURL : state => state.activeRepoBannerURL,
  isLoadingCodeRepoBanner : state => state.isLoadingCodeRepoBanner,
    myReposPaginationParams: state => state.myReposPaginationParams,
    myRepos: state => state.myRepos,
  hasReadMe: state => state.hasReadMe,
  canPublish: state => state.canPublish
}

const codeReposModule = {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}

export default codeReposModule
