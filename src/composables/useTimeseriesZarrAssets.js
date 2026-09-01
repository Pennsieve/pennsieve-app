// @/composables/useTimeseriesZarrAssets.js
// Answers one question for a package row: does it have a ready timeseries-zarr
// viewer asset?
//
// A package whose Zarr bundle is ready is viewable regardless of its legacy
// `content.state` — the pipeline that writes the bundle never moves the package
// out of UPLOADED, so gating the viewer on "Processed" hides packages that are
// perfectly viewable. File-browser rows only have the package row to go on, so
// the rows that state would otherwise hide ask here.
//
// The answer is cached per package node id for the life of the session and
// concurrent askers share one request, so a folder costs at most one call per
// package that state is currently hiding — and nothing at all for packages that
// already read as processed.
//
// Deliberately NOT built on useViewerAssets: that composable owns a single
// shared `viewerAssets` ref which ViewerPane fills and FileDetails renders from,
// and a background row probe must not clobber it.

import { reactive } from 'vue'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'

// Mirrors TIMESERIES_ZARR from @pennsieve-viz/tsviewer. `asset_type` is a
// free-form string the importer and the renderer agree on, and the literal is
// duplicated here on purpose: importing it would pull the whole viewer bundle
// into the file browser for the sake of one constant.
const TIMESERIES_ZARR = 'timeseries-zarr'

// packageNodeId -> Boolean. Reactive so a row re-renders when its probe lands.
const zarrByPackage = reactive(new Map())
// packageNodeId -> Promise, so rows asking at the same time share one request.
const inFlight = new Map()

export function useTimeseriesZarrAssets() {
  /**
   * Synchronous read of the cache — false until a probe has answered.
   * @param {String} packageId package node id
   * @returns {Boolean}
   */
  const hasTimeseriesZarrAsset = (packageId) =>
    zarrByPackage.get(packageId) === true

  /**
   * Fetch (once) whether the package carries a ready timeseries-zarr asset.
   * @param {String} datasetId dataset node id
   * @param {String} packageId package node id
   * @returns {Promise<Boolean>}
   */
  const probeTimeseriesZarrAsset = (datasetId, packageId) => {
    if (!datasetId || !packageId) {
      return Promise.resolve(false)
    }
    if (zarrByPackage.has(packageId)) {
      return Promise.resolve(zarrByPackage.get(packageId))
    }
    const pending = inFlight.get(packageId)
    if (pending) {
      return pending
    }

    const request = (async () => {
      try {
        const accessToken = await useGetToken()
        const requestUrl = `${siteConfig.api2Url}/packages/assets?dataset_id=${datasetId}&package_id=${packageId}`
        const response = await fetch(requestUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const result = response.ok ? await response.json() : null
        const hasZarr = (result?.assets || []).some(
          (asset) =>
            asset.asset_type === TIMESERIES_ZARR && asset.status === 'ready'
        )
        zarrByPackage.set(packageId, hasZarr)
        return hasZarr
      } catch (err) {
        // Nothing to go on — leave the row on its legacy state rather than
        // promising a viewer that may not open.
        zarrByPackage.set(packageId, false)
        return false
      } finally {
        inFlight.delete(packageId)
      }
    })()

    inFlight.set(packageId, request)
    return request
  }

  return { hasTimeseriesZarrAsset, probeTimeseriesZarrAsset }
}
