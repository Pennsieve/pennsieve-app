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
    size: 25,
    currentPage: 1
  },
  myReposCount: 0,
  myReposLoaded: false,
  datasetId: "",
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
  SET_MY_REPOS_LOADED(state, loaded) {
    state.myReposLoaded = loaded
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
        console.log('fetchMyRepos called with:', { page, size })
        console.log('rootState.config.api2Url:', rootState.config.api2Url)
        return useGetToken()
            .then(token =>{
              const url =`${rootState.config.api2Url}/repositories?page=${page}&size=${size}`
              console.log('Making API call to:', url)
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
                        commit('SET_MY_REPOS_COUNT', json.count);
                        commit('SET_MY_REPOS_LOADED', true);
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
          const url = `${rootState.config.api2Url}/repository/enable?organization_id=${rootState.activeOrganization.organization.id}`
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
            const url = `${rootState.config.api2Url}/repository/disable?organization_id=${rootState.activeOrganization.organization.id}`
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
            const url = `${rootState.config.api2Url}/repository/external?organization_id=${rootState.activeOrganization.organization.id}`
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
            const url = `${rootState.config.api2Url}/repository/publish?organization_id=${rootState.activeOrganization.organization.id}`
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

  updateRepoPublishingSettings: async({ rootState }, { repositoryId, publishing_to_discover, publishing_to_appstore }) => {
    try {
      const token = await useGetToken()
      const url = `${rootState.config.api2Url}/repositories/${repositoryId}`
      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + token)
      myHeaders.append('Accept', 'application/json')
      myHeaders.append('Content-Type', 'application/json')
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: myHeaders,
        body: JSON.stringify({
          publishing_to_discover,
          publishing_to_appstore
        })
      })
      
      if (response.ok) {
        const responseJson = await response.json()
        return {
          status: "SUCCESS",
          result: responseJson
        }
      } else {
        throw new Error(response.statusText)
      }
    } catch (err) {
      throw err
    }
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
  bannerURL : state => state.activeRepoBannerURL,
  isLoadingCodeRepoBanner : state => state.isLoadingCodeRepoBanner,
    myReposPaginationParams: state => state.myReposPaginationParams,
    myRepos: state => state.myRepos,
  hasReadMe: state => state.hasReadMe,
  canPublish: state => state.canPublish,
  myReposCount: state => state.myReposCount,
  myReposLoaded: state => state.myReposLoaded
}

const codeReposModule = {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}

export default codeReposModule
