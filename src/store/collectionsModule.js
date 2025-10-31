import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError} from "@/mixins/request/request_composable";

const sortCollections = (collections) => {
  return collections.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true}))
}

const initialState = () => ({
  collections: [],
  datasetCollections: []
})

export const state = initialState()

export const mutations = {
  CLEAR_STATE(state) {
    //reset all state to initial state
    const _initialState = initialState()
    // need to iteratively set keys to preserve reactivity
    Object.keys(_initialState).forEach(key => state[key] = _initialState[key])
  },

  UPDATE_COLLECTIONS(state, collections) {
    state.collections = sortCollections(collections)
  },

  CREATE_COLLECTION(state, collection) {
    state.collections.push(collection)
  },

  ADD_COLLECTION(state, collection) {
    state.datasetCollections.push(collection)
  },

  REMOVE_COLLECTION(state, collectionId) {
    const collections = state.datasetCollections.filter(collection => collection.id !== collectionId)
    state.datasetCollections = collections
  },

  UPDATE_DATASET_COLLECTIONS(state, collections) {
    state.datasetCollections = sortCollections(collections)
  }
}

export const actions = {
  updateCollections: ({commit}, data) => commit('UPDATE_COLLECTIONS', data),

  fetchCollections: async({ commit, rootState }) => {
    useGetToken()
        .then(token => {
          const url = `${rootState.config.apiUrl}/collections?api_key=${token}`
          return fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          })
              .then(resp => {
                if (resp.ok) {
                  return resp.json()
                      .then(collections => {
                        return commit('UPDATE_COLLECTIONS', collections)
                      })
                } else {
                  return Promise.reject(resp)
                }
              })
        }).catch(err => useHandleXhrError(err))
  },

  createCollection: async ({commit, rootState}, { name, description }) => {
    try {
      const token = await useGetToken()
      const url = `${rootState.config.api2Url}/collections/`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, description })
      })
      
      if (response.ok) {
        const collection = await response.json()
        commit('CREATE_COLLECTION', collection)
        return collection
      } else {
        throw new Error(response.statusText)
      }
    } catch (err) {
      useHandleXhrError(err)
      throw err
    }
  },

  addCollection: async({ commit, rootState }, { datasetId, collectionId}) => {
    useGetToken()
        .then(token => {
          const url = `${rootState.config.apiUrl}/datasets/${datasetId}/collections?api_key=${token}`
          return fetch(url, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({collectionId})
          })
              .then(resp => {
                if (resp.ok) {
                  return resp.json()
                      .then(collections => {
                        return commit('UPDATE_DATASET_COLLECTIONS', collections)
                      })
                } else {
                  return Promise.reject(resp)
                }
              })
        })
        .catch(err => useHandleXhrError(err))
  },

  removeCollection: async({ commit, dispatch, rootState }, { datasetId, collectionId }) => {

    useGetToken()
        .then(token => {
          const url = `${rootState.config.apiUrl}/datasets/${datasetId}/collections/${collectionId}?api_key=${token}`
          return fetch(url, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            }})
              .then(resp => {
                if (resp.ok) {
                  const p1 = commit('REMOVE_COLLECTION', collectionId)
                  /**
                   * Need to fetch collections again in the chance that
                   * this collection was the deleted from the organization.
                   * This happens when a collection is removed and it wasn't
                   * assigned to another dataset.
                   */
                  const p2 = dispatch('fetchCollections')

                  return Promise.all([p1,p2])
                } else {
                  return Promise.reject(resp)
                }
              })
        }).catch(err => useHandleXhrError(err))

  },

  fetchDatasetCollections: async({ commit, rootState }, datasetId) => {
    return useGetToken()
      .then(token => {
        const url = `${rootState.config.apiUrl}/datasets/${datasetId}/collections?api_key=${token}`
        return fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
            .then(resp => {
              if (resp.ok) {
                return resp.json()
                    .then(collections => {
                      return commit('UPDATE_DATASET_COLLECTIONS', collections)
                    })
              } else {
                return Promise.reject(resp)
              }
            })
      }).catch(err => useHandleXhrError(err))
  },

  fetchCollectionDatasets: async({ rootState }, collectionId) => {
    try {
      const token = await useGetToken()
      const url = `${rootState.config.api2Url}/collections/${collectionId}/datasets`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const datasets = await response.json()
        return datasets
      } else {
        throw new Error(response.statusText)
      }
    } catch (err) {
      useHandleXhrError(err)
      throw err
    }
  },

  publishCollection: async({ rootState }, { collectionId, license, tags }) => {
    try {
      const token = await useGetToken()
      const url = `${rootState.config.api2Url}/collections/${collectionId}/publish`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ license, tags })
      })
      
      if (response.ok) {
        const result = await response.json()
        return result
      } else {
        throw new Error(response.statusText)
      }
    } catch (err) {
      useHandleXhrError(err)
      throw err
    }
  }
}

export const getters = {}

const collectionsModule = {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}

export default collectionsModule
