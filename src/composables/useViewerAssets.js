// @/composables/useViewerAssets.js
// Single owner of the /packages/assets fetch. Module-level refs are
// shared across consumers — only ViewerPane.loadViewer calls
// fetchViewerAssets; FileDetails just reads viewerAssets reactively.

import { ref } from 'vue'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'

const viewerAssets = ref([])

export function useViewerAssets() {
  const fetchViewerAssets = async (datasetId, packageId) => {
    if (!datasetId || !packageId) {
      viewerAssets.value = []
      return null
    }

    const accessToken = await useGetToken()
    const requestUrl = `${siteConfig.api2Url}/packages/assets?dataset_id=${datasetId}&package_id=${packageId}`
    const response = await fetch(requestUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const result = response.ok ? await response.json() : null

    viewerAssets.value = result?.assets || []
    return result
  }

  const removeViewerAsset = (assetId) => {
    viewerAssets.value = viewerAssets.value.filter((a) => a.id !== assetId)
  }

  return { viewerAssets, fetchViewerAssets, removeViewerAsset }
}
