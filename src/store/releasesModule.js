import {defaultTo, propEq, find } from 'ramda'
import Cookies from "js-cookie";

const initialState = () => ({
  gitHubRepos: null,
  gitHubReposCount: null,
  externalRepos: null,
  externalReposCount: null,
})

export const state = initialState()

export const mutations = {
  CLEAR_STATE(state) {
    //reset all state to initial state
    const _initialState = initialState()
    // need to iteratively set keys to preserve reactivity
    Object.keys(_initialState).forEach(key => state[key] = _initialState[key])
  },
  SET_GITHUB_REPOS(state, gitHubRepos) {
    state.gitHubRepos = gitHubRepos
  },
  SET_GITHUB_REPOS_COUNT(state, count) {
    state.gitHubReposCount = count
  },
  SET_EXTERNAL_REPOS(state, externalRepos) {
    state.externalRepos = externalRepos
  },
  SET_EXTERNAL_REPOS_COUNT(state, count) {
    state.externalReposCount = count
  },
  UPDATE_REPO_IN_EXTERNAL_REPOS(state, modifiedRepo) {
    const index = state.externalRepos.findIndex(repo => repo.id === modifiedRepo.id);
  
    if (index !== -1) {
      state.externalRepos.splice(index, 1, modifiedRepo)
    }
  }
}

export const actions = {
  updatePublishingInfo: ({commit}, data) => commit('UPDATE_PUBLISHING_INFO', data),

  fetchGitHubRepos: async({ commit, rootState }) => {
    try {
      const url = `${rootState.config.api2Url}/repositories/github`
      const apiKey = rootState.userToken || Cookies.get('user_token')
      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + apiKey)
      myHeaders.append('Accept', 'application/json')
      const response = await fetch(url, { headers: myHeaders })
      if (response.ok) {
        const responseJson = await response.json()
        const gitHubRepos = responseJson.repos
        const gitHubReposCount = responseJson.count
        commit('SET_GITHUB_REPOS', gitHubRepos)
        commit('SET_GITHUB_REPOS_COUNT', gitHubReposCount)
      } else {
        commit('SET_GITHUB_REPOS', [])
        commit('SET_GITHUB_REPOS_COUNT', 0)
        throw new Error(response.statusText)
      }
    }
    catch (err) {
      // add error handling - unable to retrieve github repos, try again or something
      commit('SET_GITHUB_REPOS', null)
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
      // add error handling - unable to retrieve github repos, try again or something
      commit('SET_EXTERNAL_REPOS', null)
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
      // add error handling - could not enable repo tracking, try again or something
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
      // add error handling - could not disable repo tracking, try again or something
    }
  }
}

export const getters = {
  getPublishingInfo: state => (tag) => {
    return defaultTo({}, find(propEq('tag', tag), state.publishingInfo))
  },
}

const releasesModule = {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}

export default releasesModule
