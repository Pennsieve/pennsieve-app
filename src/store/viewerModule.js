import {
  mergeRight,
  propOr,
  propEq,
  findIndex,
  flatten,
  compose,
  pluck,
  pathOr,
  includes,
  remove,
  find,
  map, otherwise
} from 'ramda'
import { viewerSidePanelTypes, viewerToolTypes } from '../utils/constants'
import {useGetToken} from "@/composables/useGetToken";
import toQueryParams from "@/utils/toQueryParams";

const getLayerIndex = (key, data, viewerAnnotations) => {
  const layerId = propOr('', key, data)
  const layerIndex = findIndex(propEq('id', layerId), viewerAnnotations)

  return layerIndex
}

const initialState = () => ({
  activeViewer: {},
  viewerSidePanelOpen: false,
  viewerSlideInfo: {
    curRotation: 0,
    curZoom: 0,
    isMeasuring: false,
    measureLength: 0,
    zoomPerClick: 0,
    minZoom: 0,
    maxZoom: 0
  },
  viewerChannels: [],
  viewerAnnotations: [],
  activeAnnotationLayer: {},
  activeAnnotation: {},
  viewerErrors: {},
  //TODO make strings enum constants
  viewerSidePanelView: viewerSidePanelTypes.INFO_PANEL,
  viewerActiveTool: viewerToolTypes.POINTER,
  viewerMontageScheme: 'NOT_MONTAGED',
  customMontageMap: [],
  workspaceMontages: [],
})

export const state = initialState()

export const mutations = {
  //TODO figure out why we clear state twice?
  CLEAR_STATE(state) {
    //reset all state to initial state
    const _initialState = initialState()
    // need to iteratively set keys to preserve reactivity
    Object.keys(_initialState).forEach(key => state[key] = _initialState[key])
  },

  OPEN_VIEWER(state, viewer) {
    state.activeViewer = viewer
  },

  SET_SIDE_PANEL(state, sidePanel) {
    state.viewerSidePanelOpen = sidePanel.open
    state.viewerSidePanelView = sidePanel.view
  },

  SET_ACTIVE_TOOL(state, tool) {
    state.viewerActiveTool = tool
  },

  UPDATE_VIEWER_SLIDE_INFO (state, newSlideInfo) {
    state.viewerSlideInfo = newSlideInfo
  },

  SET_CHANNELS (state, channels) {
    state.viewerChannels = channels
  },

  UPDATE_CHANNEL (state, { data, channelIndex }) {
    state.viewerChannels[channelIndex] = data
  },

  CREATE_LAYER (state, data)  {
    state.viewerAnnotations.push(data)
  },

  SET_ACTIVE_ANNOTATION_LAYER (state, data) {
    state.activeAnnotationLayer = data
    state.viewerAnnotations.forEach(index => index.selected = false)
    const layerIndex = findIndex(propEq('id', data), state.viewerAnnotations)
    state.viewerAnnotations[layerIndex].selected = true


  },
  SET_ACTIVE_ANNOTATION (state, data) {
    state.viewerAnnotations.forEach( index =>
      index.annotations.forEach(ann =>
        ann.selected = false
      )
    )

    if (data.id) {
      const layerIndex = findIndex(propEq('id', data.layer_id), state.viewerAnnotations)
      const annotationIndex = findIndex(propEq('id', data.id), state.viewerAnnotations[layerIndex].annotations)
      state.viewerAnnotations[layerIndex].annotations[annotationIndex].selected = true
    }
    state.activeAnnotation = data
  },
  UPDATE_LAYER (state, { layer, index })  {
    state.viewerAnnotations[index] = layer
  },

  DELETE_LAYER (state, { index })  {
    state.viewerAnnotations.splice(index, 1)
  },

  SET_ANNOTATIONS (state, data) {
    state.viewerAnnotations = data
  },

  CREATE_ANNOTATION (state, { annotation, index }) {
    state.viewerAnnotations[index].annotations.push(annotation)
  },

  UPDATE_ANNOTATION (state, { data }) {
    const layerIndex = getLayerIndex('layer_id', data, state.viewerAnnotations)
    const annotations = state.viewerAnnotations[layerIndex].annotations
    const annotationIndex = findIndex(propEq('id', data.id), annotations)

    annotations[annotationIndex] = data
  },

  DELETE_ANNOTATION (state, { data }) {
    const layerIndex = getLayerIndex('layer_id', data, state.viewerAnnotations)
    const annotations = state.viewerAnnotations[layerIndex].annotations
    const annotationIndex = findIndex(propEq('id', data.id), annotations)

    annotations.splice(annotationIndex, 1)
  },


  SET_VIEWER_ERRORS (state, data) {
    state.viewerErrors = data
  },

  SET_VIEWER_MONTAGE_SCHEME (state, data) {
    state.viewerMontageScheme = data
  },

  SET_CUSTOM_MONTAGE_MAP (state, data) {
    state.customMontageMap = data
  },
  SET_WORKSPACE_MONTAGES (state, data) {
    state.workspaceMontages = data
  }
}

export const actions = {
  setActiveViewer: ({commit}, evt) => commit('OPEN_VIEWER', evt),
  openViewer: ({ commit }, evt) =>
    commit('OPEN_VIEWER', evt),
  closeViewer: ({ commit }, evt) =>
    commit('CLEAR_STATE', evt),
  setSidePanel: ({ commit }, evt) =>
    commit('SET_SIDE_PANEL', evt),
  setActiveTool: ({ commit }, evt) =>
    commit('SET_ACTIVE_TOOL', evt),
  setChannels: ({ commit }, evt) => {
    commit('SET_CHANNELS', evt)},
  updateChannel: ({ commit, state }, channel) => {
    const id = propOr('', 'id', channel)
    const channelIndex = findIndex(propEq('id', id), state.viewerChannels)

    commit('UPDATE_CHANNEL', { data: channel, channelIndex})
  },
  createLayer: ({ commit }, evt) =>
    commit('CREATE_LAYER', evt),
  setActiveAnnotationLayer: ({ commit }, evt) =>
    commit('SET_ACTIVE_ANNOTATION_LAYER', evt),
  updateLayer: ({ commit, state }, data) => {
    const index = getLayerIndex('id', data, state.viewerAnnotations)
    const layer = Object.assign( state.viewerAnnotations[index], data)
    commit('UPDATE_LAYER', { layer, index })
  },
  deleteLayer: ({ commit, state }, data) => {
    const index = getLayerIndex('id', data, state.viewerAnnotations)

    commit('DELETE_LAYER', { index })
  },
  setAnnotations: ({ commit }, annotations) =>
    commit('SET_ANNOTATIONS', annotations),
  createAnnotation: ({ commit, state }, annotation) => {
    const index = getLayerIndex('layer_id', annotation, state.viewerAnnotations)

    commit('CREATE_ANNOTATION', { annotation, index })
    commit('SET_ACTIVE_ANNOTATION', annotation)
  },
  setActiveAnnotation: ({ commit }, data) =>
    commit('SET_ACTIVE_ANNOTATION',  data),
  updateAnnotation: ({ commit }, data) =>
    commit('UPDATE_ANNOTATION', { data }),
  deleteAnnotation: ({commit, getters}, data) =>
    commit('DELETE_ANNOTATION', { data, getters }),
  updateViewerSlideInfo: ({ commit }, evt) => {
    const newSlideInfo = mergeRight(state.viewerSlideInfo, evt)

    commit('UPDATE_VIEWER_SLIDE_INFO', newSlideInfo)
  },
  setViewerErrors: ({ commit }, evt) =>
    commit('SET_VIEWER_ERRORS', evt),
  setViewerMontageScheme: ({commit}, evt) =>
    commit('SET_VIEWER_MONTAGE_SCHEME', evt),
  setCustomMontageMap: ({commit}, evt) => {
    commit('SET_VIEWER_MONTAGE_SCHEME', evt.montageScheme)
    commit('SET_CUSTOM_MONTAGE_MAP', JSON.parse(evt.customMontageMap))
  },
  fetchCloudFrontUrl: async ({rootState}, { packageId, datasetId }) => {
    try {
      const token = await useGetToken()
      const queryParams = toQueryParams({
        package_id: packageId,
        dataset_id: datasetId
      })
      const url = `${rootState.config.apiUrl}/packages/cloudfront/sign?${queryParams}`

      const myHeaders = new Headers()
      myHeaders.append('Authorization', 'Bearer ' + token)
      myHeaders.append('Accept', 'application/json')

      const resp = await fetch(url, {
        method: 'GET',
        headers: myHeaders
      })

      if (resp.ok) {
        const result = await resp.json()
        return result.url
      } else {
        return Promise.reject(resp)
      }
    } catch (err) {
      return Promise.reject(err)
    }
  },

  /**
   * Get viewer assets for a package
   * @param {String} packageId
   * @returns {Promise<Array>} Array of file assets
   */
  fetchViewerAssets: async ({rootState}, packageId) => {
    try {
      const token = await useGetToken()
      const url = `${rootState.config.apiUrl}/packages/${packageId}/view?api_key=${token}`

      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (resp.ok) {
        return await resp.json()
      } else {
        return Promise.reject(resp)
      }
    } catch (err) {
      return Promise.reject(err)
    }
  },

  /**
   * Get presigned URL for a file
   * @param {String} packageId
   * @param {String} fileId
   * @returns {Promise<String>} Presigned URL
   */
  fetchFileUrl: async ({rootState}, { packageId, fileId }) => {
    try {
      const token = await useGetToken()
      const url = `${rootState.config.apiUrl}/packages/${packageId}/files/${fileId}?api_key=${token}`

      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (resp.ok) {
        const result = await resp.json()
        return result.url
      } else {
        return Promise.reject(resp)
      }
    } catch (err) {
      return Promise.reject(err)
    }
  },

  fetchWorkspaceMontages: async ({commit, rootState}, evt) => {
    try {
      let endpoint = `${rootState.config.api2Url}/timeseries/montages`
      const token = await useGetToken()

      const queryParams = toQueryParams({
        organization_id: rootState.activeOrganization.organization.id
      })

      const url = `${endpoint}?${queryParams}`

      const myHeaders = new Headers();
      myHeaders.append('Authorization', 'Bearer ' + token)
      myHeaders.append('Accept', 'application/json')

      const resp = await fetch(url, {
        method: 'GET',
        headers: myHeaders
      })

      if (resp.ok) {
        const montages = await resp.json()
        commit('SET_WORKSPACE_MONTAGES', montages.montages)
        return montages.montages
      } else {
        return Promise.reject(resp)
      }
    } catch (err) {
      return Promise.reject(err)
    }
  }

}

export const getters = {
  workspaceMontages: state => {
    return state.workspaceMontages
  },
  viewerSelectedChannels: state => {
    return state.viewerChannels.filter(channel => {
      return channel.selected
    })
  },
  getViewerActiveLayer: state => () => {
    return find(propEq('selected', true), state.viewerAnnotations)
  },
  getAnnotationById: state => (id) => compose(
    find(propEq('id', id)),
    flatten,
    pluck('annotations')
  )(state.viewerAnnotations),

  getMontageMessageByName: state => (montageName) => {

    switch (montageName) {
      case "NOT_MONTAGED":
        return "NOT_MONTAGED"
      default:
        const m = find(propEq('name', montageName))(state.workspaceMontages)
        const channelPairs = m.channelPairs.map(r => {
          return r.channels
        })

        return channelPairs
    }

  },

  /**
   * MPP stands for Microns per Pixel
   * This is used to get the density of the slide
   * and translate it to physical size
   */
  viewerMpp: state => compose(
    propOr('', 'value'),
    find(propEq('key', 'aperio.MPP')),
    propOr([{}], 'properties'),
    find(propEq('category', 'Blackfynn')),
    propOr([{}], 'properties')
  )(state.activeViewer)


}

const viewerModule = {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}

export default viewerModule
