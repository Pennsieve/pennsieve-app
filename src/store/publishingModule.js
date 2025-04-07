import Cookies from 'js-cookie'

import toQueryParams from '../utils/toQueryParams.js'
import { PublicationTabs, PublicationTabsStatuses, PublicationTabsTypes, StatusActions, PublicationStatus } from '../utils/constants.js'

import EventBus from '../utils/event-bus'
import router from '@/router'
import {useGetToken} from "@/composables/useGetToken";

const publishingSearchParams = () => ({
  limit: 25,
  offset: 0,
  query: '',
  orderBy: 'Name',
  orderDirection: 'Asc',
  totalCount: 0
})

const fetchDatasetsUrl = async (state, rootState, publicationStatus, publicationType, isOnPublishedTab) => {

  return useGetToken()
      .then( token => {
        const queryParams = toQueryParams({
          publicationStatus,
          api_key: token,
          includeBannerUrl: true,
          includePublishStatus: true,
          publicationType,
          ...state.publishingSearchParams
        })

        const publishedQueryParams = toQueryParams({
          api_key: token,
          includeBannerUrl: true,
          ...state.publishingSearchParams
        })

        return isOnPublishedTab
            ? `${rootState.config.apiUrl}/datasets/published/paginated?${publishedQueryParams}`
            : `${rootState.config.apiUrl}/datasets/paginated?${queryParams}`

  })


  /**
   * Only fetch the datasets if the user is in the publishing tab
   */






}


const initialState = () => ({
    /*
     * Used for pending review tab which is a combination of
     * REQUESTED, ACCEPTED, and FAILED
     */
    [PublicationTabs.REVIEW]: {
      count: 0,
      datasets: []
    },
    [PublicationTabs.PUBLISHED]: {
      count: 0,
      datasets: []
    },
    [PublicationTabs.REJECTED]: {
      count: 0,
      datasets: []
    },
    [PublicationTabs.PROPOSED]: {
      count: 0,
      datasets: []
    },
    publishingSearchParams: publishingSearchParams(),
    isLoadingDatasets: false
})

export const state = initialState()

export const mutations = {
  CLEAR_STATE(state) {
    //reset all state to initial state
    const _initialState = initialState()
    // need to iteratively set keys to preserve reactivity
    Object.keys(_initialState).forEach(key => state[key] = _initialState[key])
  },

  CLEAR_SEARCH_PARAMS(state) {
    state.publishingSearchParams = publishingSearchParams()
  },

  UPDATE_PUBLISHING_TOTAL_COUNT(state, { type, count }) {
    state[type].count = count
  },

  UPDATE_DATASETS(state, { type, datasets }) {
    state[type].datasets = datasets
  },

  UPDATE_PUBLISHING_SEARCH_QUERY(state, searchQuery) {
    state.publishingSearchParams.query = searchQuery
  },

  UPDATE_PUBLISHING_OFFSET(state, offset) {
    state.publishingSearchParams.offset = offset
  },

  UPDATE_PUBLISHING_SEARCH_LIMIT(state, limit) {
    state.publishingSearchParams.limit = limit
  },

  UPDATE_PUBLISHING_SEARCH_ORDER_DIRECTION(state, orderDirection) {
    state.publishingSearchParams.orderDirection = orderDirection
  },

  UPDATE_PUBLISHING_SEARCH_ORDER_BY(state, orderBy) {
    state.publishingSearchParams.orderBy = orderBy
  },

  UPDATE_PUBLISHING_SEARCH_TOTAL_COUNT(state, count) {
    state.publishingSearchParams.totalCount = count
  },

  UPDATE_IS_LOADING_DATASETS(state, isLoadingDatasets) {
    state.isLoadingDatasets = isLoadingDatasets
  }
}

export const actions = {
  clearSearchState: ({commit}) => {
    commit('CLEAR_STATE')
  },
  clearSearchParams: ({commit}) => {
    commit('CLEAR_SEARCH_PARAMS')
  },
  updateDatasetTotalCount: ({commit}, { type, count }) => {
    commit('UPDATE_PUBLISHING_TOTAL_COUNT', { type, count })
  },

  updatePublishingSearchQuery: ({commit, dispatch}, evt) => {
    commit('UPDATE_PUBLISHING_SEARCH_QUERY', evt)
    commit('UPDATE_PUBLISHING_OFFSET', 0)

    dispatch('fetchDatasets')
  },

  updatePublishingOffset: ({commit, dispatch}, evt) => {
    commit('UPDATE_PUBLISHING_OFFSET', evt)

    dispatch('fetchDatasets')
  },

  updatePublishingSearchLimit: ({commit, dispatch}, evt) => {
    commit('UPDATE_PUBLISHING_SEARCH_LIMIT', evt)
    commit('UPDATE_PUBLISHING_OFFSET', 0)

    dispatch('fetchDatasets')
  },

  updatePublishingSearchOrderDirection: ({commit, dispatch}, evt) => {
    commit('UPDATE_PUBLISHING_SEARCH_ORDER_DIRECTION', evt)
    commit('UPDATE_PUBLISHING_OFFSET', 0)

    dispatch('fetchDatasets')
  },

  updatePublishingSearchOrderBy: ({commit, dispatch}, evt) => {
    commit('UPDATE_PUBLISHING_SEARCH_ORDER_BY', evt)
    commit('UPDATE_PUBLISHING_OFFSET', 0)

    dispatch('fetchDatasets')
  },

  updatePublishingSearchTotalCount: ({commit}, count) => {
    commit('UPDATE_PUBLISHING_SEARCH_TOTAL_COUNT', count)
  },

  updateDatasets: ({commit}, { type, datasets }) => {
    commit('UPDATE_DATASETS', { type, datasets })
  },

  updateIsLoadingDatasets: ({commit}, isLoadingDatasets) => {
    commit('UPDATE_IS_LOADING_DATASETS', isLoadingDatasets)
  },

  fetchDatasets: async ({state, commit, rootState}) => {
    /**
     * Only fetch the datasets if the user is in the publishing tab
     */
    const publicationStatus = PublicationTabsStatuses[router.currentRoute.value.name]
    if(!publicationStatus.length) {
      return
    }

    commit('UPDATE_IS_LOADING_DATASETS', true)

    const publicationType = PublicationTabsTypes[router.currentRoute.value.name]

    const isOnPublishedTab = publicationType === PublicationTabsTypes[PublicationTabs.PUBLISHED]

    const urlPromise = fetchDatasetsUrl(state, rootState, publicationStatus, publicationType, isOnPublishedTab)

    try {
      urlPromise.then(url => {
        fetch(url).then(resp => {
          return resp.json()
              .then(json => {
                commit('UPDATE_PUBLISHING_SEARCH_TOTAL_COUNT', json.totalCount);
                // If on the published tab, merge the dataset and published
                // dataset DTOs if the user has permissions for the dataset
                const updatedDatasets = isOnPublishedTab
                    ? json.datasets.map(dataset => {
                      const embargoAccess = dataset.embargoAccess || ''
                      const publishedDataset = { ...dataset.publishedDataset, embargoAccess}

                      return dataset.dataset
                          ? {...dataset.dataset, ...publishedDataset}
                          : publishedDataset
                    })
                    : json.datasets;
                commit('UPDATE_DATASETS', { type: router.currentRoute.value.name, datasets: updatedDatasets });
                commit('UPDATE_IS_LOADING_DATASETS', false);
              })
        })
      })

    } catch (err) {
      EventBus.$emit('ajaxError', err)
    }
  },

  getDatasetCount: async ({commit, rootState}, type) => {

    const statuses = PublicationTabsStatuses[type]
    const types = PublicationTabsTypes[type]
    const isOnPublishedTab = statuses.includes(PublicationStatus.COMPLETED)

    useGetToken()
        .then(token => {
          const queryParams = toQueryParams({
            publicationStatus: statuses,
            publicationType: types,
            api_key: token,
            limit: 0
          })

          const url = isOnPublishedTab
              ? `${rootState.config.apiUrl}/datasets/published/paginated?${queryParams}`
              : `${rootState.config.apiUrl}/datasets/paginated?${queryParams}`
          try {
            fetch(url)
                .then(resp => {
                  if (resp.ok) {
                    resp.json()
                        .then(json => {
                          commit('UPDATE_PUBLISHING_TOTAL_COUNT', { type, count: json.totalCount })
                        })
                  } else {
                    throw new Error(resp.statusText)
                  }
                })

          } catch (err) {
            EventBus.$emit('ajaxError', err)
          }

        })
  },

  getDatasetProposalCount: async ({ commit, rootState }, type) => {
    const url = `${rootState.config.api2Url}/publishing/submission`;
  
    try {
      const token = await useGetToken();
  
      const headers = new Headers({
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      });
  
      const response = await fetch(url, { method: 'GET', headers });
  
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
  
      const data = await response.json();
  
      if (data && typeof data.totalCount === 'number') {
        commit('UPDATE_PUBLISHING_TOTAL_COUNT', { type, count: data.totalCount });
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching dataset proposal count:', err);
      EventBus.$emit('ajaxError', err);
    }
  },
  


  fetchDatasetProposals: async ({state, commit, rootState}) => {
    // const publicationStatus = PublicationTabsStatuses[rootState.route.name]
    // if(!publicationStatus) {
    //   return
    // }
   
    let url = `${rootState.config.api2Url}/publishing/submission`
    const apiKey = await useGetToken()

    const myHeaders = new Headers();
    myHeaders.append('Authorization', 'Bearer ' + apiKey)
    myHeaders.append('Accept', 'application/json')
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: myHeaders,
      })
      if (response.ok) {
        const { proposals, totalCount } = await response.json()
        commit('UPDATE_PUBLISHING_SEARCH_TOTAL_COUNT', totalCount);
        commit('UPDATE_DATASETS', { type: router.currentRoute.value.name, datasets: proposals });
        commit('UPDATE_IS_LOADING_DATASETS', false);

      } else {
        throw new Error(response.statusText)
      }
    } catch (err) {
      EventBus.$emit('ajaxError', err)
    }
  },

  FrefreshPublishingData: ({ dispatch }, status) => {
    const actions = StatusActions[status]

    actions.forEach(action => {
      dispatch('getDatasetCount', action)
    })

    dispatch('fetchDatasets')
  }
}

export const getters = {
  getTotalCount: state => (type) => {
    if (state[type]) {
      return state[type].count || 0
    }
    return 0
  },
  getDatasets: state => (type) => {
    return state[type].datasets
  }
}

const publishingModule = {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}

export default publishingModule
