import {
  mergeRight,
  propOr,
  propEq,
  findIndex,
  compose,
  find,
} from 'ramda'
import { viewerSidePanelTypes, viewerToolTypes } from '../utils/constants'
import {useGetToken} from "@/composables/useGetToken";

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
  activeAnnotation: {},
  viewerErrors: {},
  //TODO make strings enum constants
  viewerSidePanelView: viewerSidePanelTypes.INFO_PANEL,
  viewerActiveTool: viewerToolTypes.POINTER,
  viewerMontageScheme: 'NOT_MONTAGED',
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

  UPDATE_CHANNEL (state, { data, channelIndex }) {
    state.viewerChannels[channelIndex] = data
  },

  CREATE_LAYER (state, data)  {
    state.viewerAnnotations.push(data)
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
  updateChannel: ({ commit, state }, channel) => {
    const id = propOr('', 'id', channel)
    const channelIndex = findIndex(propEq('id', id), state.viewerChannels)

    commit('UPDATE_CHANNEL', { data: channel, channelIndex})
  },
  createLayer: ({ commit }, evt) =>
    commit('CREATE_LAYER', evt),
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
   * Get source files for a package (the original uploaded files,
   * not processed viewer assets). Used by OmeViewer to get the
   * original .ome.tiff source file.
   * @param {String} packageId
   * @returns {Promise<Array>} Array of source file objects
   */
  fetchSourceFiles: async ({rootState}, packageId) => {
    try {
      const token = await useGetToken()
      const url = `${rootState.config.apiUrl}/packages/${packageId}/sources-paged?api_key=${token}`

      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (resp.ok) {
        const result = await resp.json()
        return result.results || result
      } else {
        return Promise.reject(resp)
      }
    } catch (err) {
      return Promise.reject(err)
    }
  },

  /**
   * Get viewer assets from the packages service (api2)
   * Returns { assets, cloudfront } with signed CloudFront policy
   */
  fetchPackageViewerAssets: async ({rootState}, { datasetId, packageId }) => {
    try {
      const token = await useGetToken()
      const url = `${rootState.config.api2Url}/packages/assets?dataset_id=${datasetId}&package_id=${packageId}`
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (resp.ok) {
        return await resp.json()
      }
      return null
    } catch (err) {
      console.warn('Failed to fetch package viewer assets:', err)
      return null
    }
  },

  /**
   * Get a single viewer asset by its UUID from the packages service (api2).
   * Returns { asset, cloudfront } with a signed CloudFront policy. Unlike
   * fetchPackageViewerAssets (which lists a package's assets and is subject
   * to the chat-scoped exclusion filter), this resolves by id directly — the
   * only reliable way to reach a chat-scoped figure, which is omitted from
   * the dataset/package listing. Returns null on any failure (caller degrades
   * to a fallback link).
   * @param {String} datasetId
   * @param {String} assetId
   */
  fetchViewerAssetById: async ({rootState}, { datasetId, assetId }) => {
    try {
      const token = await useGetToken()
      const url = `${rootState.config.api2Url}/packages/assets/${assetId}?dataset_id=${datasetId}`
      const resp = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (resp.ok) {
        return await resp.json()
      }
      return null
    } catch (err) {
      console.warn('Failed to fetch viewer asset by id:', err)
      return null
    }
  },

  /**
   * Promote a chat-scoped viewer asset by detaching its chat session
   * (PATCH clear_chat_session). Metadata-only: the asset's bytes never move
   * (dataset_id is unchanged); it simply starts appearing in a listing and is
   * no longer reclaimed when the chat session is deleted. Idempotent.
   *
   * Where it lands depends on `packageIds`:
   *   - Pass the source package's node id (e.g. ['N:package:…']) to attach the
   *     figure to that package — it becomes a package-scoped asset (shows in
   *     the package's asset listing). This is the default for figures derived
   *     from a package.
   *   - Pass [] (or omit) to leave it unlinked — it becomes a plain dataset
   *     asset (shows in the dataset's asset listing).
   * @param {String} datasetId
   * @param {String} assetId
   * @param {String[]} [packageIds] package node ids to link; [] for dataset-only
   */
  promoteViewerAsset: async ({rootState}, { datasetId, assetId, packageIds }) => {
    const token = await useGetToken()
    const url = `${rootState.config.api2Url}/packages/assets/${assetId}?dataset_id=${datasetId}`
    const body = { clear_chat_session: true }
    if (Array.isArray(packageIds)) {
      body.package_ids = packageIds
    }
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      throw new Error(`Failed to promote viewer asset: ${resp.status}`)
    }
    return await resp.json()
  },

  /**
   * Delete a viewer asset
   * @param {String} datasetId
   * @param {String} assetId
   */
  deleteViewerAsset: async ({rootState}, { datasetId, assetId }) => {
    const token = await useGetToken()
    const url = `${rootState.config.api2Url}/packages/assets/${assetId}?dataset_id=${datasetId}`
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (!resp.ok) {
      throw new Error(`Failed to delete viewer asset: ${resp.status}`)
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

}

export const getters = {
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
