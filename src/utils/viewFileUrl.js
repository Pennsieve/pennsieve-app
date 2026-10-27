import * as siteConfig from '@/site-config/site.json'
import { useGetToken } from '@/composables/useGetToken'
import { downloadServiceUrl, getFileUrl } from '@/utils/downloadService'

// Where a viewer gets a signed link to the contents of a file it shows.
//
// A package's source file is linked by download-service with purpose
// "view": an inline link, recorded apart from downloads, that applies the
// malware scan gate. A file still being scanned rejects with a
// DownloadServiceError 409 'scan_pending' (see isScanPendingError).
//
// A derived file (a View or File object made by processing, which
// pennsieve-api's /view returns ahead of the source) can't be signed by
// download-service yet, which links only a package's source file; it, and
// platforms without download-service, keep pennsieve-api's link
// (POAM-040).

// objectType as pennsieve-api's /view, /sources and /files return it.
export function isSourceFile(file) {
  return String(file?.content?.objectType || '').toLowerCase() === 'source'
}

// file is one entry of pennsieve-api's /view or /sources response. short
// asks for a short link in place of the presigned one, for Microsoft's
// Office viewer, which caps the URL it opens: download-service's redirecting
// link, or pennsieve-api's shortened one.
export async function viewFileUrl({ datasetId, packageId, file, short = false }, {
  config = siteConfig,
  getToken = useGetToken,
  fetchFn = globalThis.fetch,
} = {}) {
  if (downloadServiceUrl(config) && datasetId && isSourceFile(file)) {
    const { url } = await getFileUrl(
      { datasetId, packageId, purpose: 'view', short },
      { config, getToken, fetchFn },
    )
    return url
  }
  return legacyFileUrl({ packageId, fileId: file?.content?.id, short }, { config, getToken, fetchFn })
}

// pennsieve-api's presigned link to one file of a package (shortened through
// its URL shortener when short).
async function legacyFileUrl({ packageId, fileId, short }, { config, getToken, fetchFn }) {
  const token = await getToken()
  const url = `${config.apiUrl}/packages/${packageId}/files/${fileId}?api_key=${token}${short ? '&short=true' : ''}`
  const resp = await fetchFn(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!resp.ok) throw new Error(`could not get a link to the file (${resp.status})`)
  const result = await resp.json()
  return result.url
}
