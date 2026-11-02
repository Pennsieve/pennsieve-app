// @/composables/usePackageViewerData.js
// Answers one question for a package row: does the data a viewer needs exist?
//
// Package state no longer says anything about viewability: READY only means
// the file passed the malware scan. Which viewer opens depends on what data
// exists for the package:
//
//   TimeSeries  channels (legacy streaming data), or a ready Zarr bundle
//   Slide       the deep-zoom tiles (the package's view files)
//   others      the source file or viewer assets, as before — no probe
//
// A package without that data has no viewer; it can only be downloaded.
//
// The answer is cached per package node id for the life of the session and
// concurrent askers share one request, so a folder costs at most one or two
// calls per READY timeseries or slide package and nothing for anything else.
//
// Deliberately NOT built on useViewerAssets: that composable owns a single
// shared `viewerAssets` ref which ViewerPane fills and FileDetails renders from,
// and a background row probe must not clobber it.

import { reactive } from 'vue'
import { pathOr } from 'ramda'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'

// Mirrors TIMESERIES_ZARR from @pennsieve-viz/tsviewer. `asset_type` is a
// free-form string the importer and the renderer agree on, and the literal is
// duplicated here on purpose: importing it would pull the whole viewer bundle
// into the file browser for the sake of one constant.
export const TIMESERIES_ZARR = 'timeseries-zarr'

/**
 * Package types whose viewer needs data beyond the source file.
 */
const PROBED_TYPES = ['timeseries', 'slide']

/**
 * True when a package DTO carries timeseries channels. Only the single-package
 * GET (`/packages/:id`) includes them; folder listings don't.
 * @param {Object} pkg package DTO
 * @returns {Boolean}
 */
export const hasTimeseriesChannels = (pkg) =>
  Array.isArray(pkg?.channels) && pkg.channels.length > 0

/**
 * True when a viewer for this package type depends on derived data that may
 * not exist (and so has to be probed for).
 * @param {String} packageType
 * @returns {Boolean}
 */
export const viewerNeedsData = (packageType) =>
  PROBED_TYPES.includes(String(packageType || '').toLowerCase())

/**
 * True when an assets listing (`/packages/assets`) has a ready Zarr bundle.
 * @param {Object} listing
 * @returns {Boolean}
 */
export const hasReadyZarrAsset = (listing) =>
  (listing?.assets || []).some(
    (asset) => asset.asset_type === TIMESERIES_ZARR && asset.status === 'ready'
  )

// packageNodeId -> Boolean. Reactive so a row re-renders when its probe lands.
const dataByPackage = reactive(new Map())
// packageNodeId -> Promise, so rows asking at the same time share one request.
const inFlight = new Map()

const getJson = async (url, init) => {
  const response = await fetch(url, init)
  return response.ok ? response.json() : null
}

const nonEmpty = (result) => {
  const list = Array.isArray(result) ? result : pathOr([], ['results'], result)
  return Array.isArray(list) && list.length > 0
}

async function probeTimeseries(token, datasetId, packageId) {
  const assets = await getJson(
    `${siteConfig.api2Url}/packages/assets?dataset_id=${datasetId}&package_id=${packageId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).catch(() => null)
  if (hasReadyZarrAsset(assets)) {
    return true
  }
  const channels = await getJson(
    `${siteConfig.apiUrl}/timeseries/${packageId}/channels?api_key=${token}`
  )
  return nonEmpty(channels)
}

async function probeSlide(token, packageId) {
  const view = await getJson(
    `${siteConfig.apiUrl}/packages/${packageId}/view?api_key=${token}`
  )
  return nonEmpty(view)
}

export function usePackageViewerData() {
  /**
   * Synchronous read of the cache — false until a probe has answered.
   * @param {String} packageId package node id
   * @returns {Boolean}
   */
  const hasViewerData = (packageId) => dataByPackage.get(packageId) === true

  /**
   * Fetch (once) whether the data the package's viewer needs exists.
   * @param {Object} args
   * @param {String} args.datasetId dataset node id
   * @param {String} args.packageId package node id
   * @param {String} args.packageType e.g. TimeSeries, Slide
   * @returns {Promise<Boolean>}
   */
  const probeViewerData = ({ datasetId, packageId, packageType }) => {
    const type = String(packageType || '').toLowerCase()
    if (!packageId || !viewerNeedsData(type)) {
      return Promise.resolve(false)
    }
    if (type === 'timeseries' && !datasetId) {
      return Promise.resolve(false)
    }
    if (dataByPackage.has(packageId)) {
      return Promise.resolve(dataByPackage.get(packageId))
    }
    const pending = inFlight.get(packageId)
    if (pending) {
      return pending
    }

    const request = (async () => {
      try {
        const token = await useGetToken()
        const found =
          type === 'timeseries'
            ? await probeTimeseries(token, datasetId, packageId)
            : await probeSlide(token, packageId)
        dataByPackage.set(packageId, found)
        return found
      } catch (err) {
        // Nothing to go on — promise no viewer rather than one that won't open.
        dataByPackage.set(packageId, false)
        return false
      } finally {
        inFlight.delete(packageId)
      }
    })()

    inFlight.set(packageId, request)
    return request
  }

  return { hasViewerData, probeViewerData }
}

// For tests.
export const _resetViewerDataCache = () => {
  dataByPackage.clear()
  inFlight.clear()
}
