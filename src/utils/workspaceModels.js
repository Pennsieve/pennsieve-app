import * as siteConfig from '@/site-config/site.json'
import { useGetToken } from '@/composables/useGetToken'

// The models of a workspace (unpublished) dataset that can have records: the
// names of those with a version, sorted, from metadata-service
// (GET /metadata/models?dataset_id=; the dataset is named in the call, so the
// gateway checks the user's role on it, whatever workspace they're in). A
// dataset with no models, or one the user can't read, gives none.
export async function listWorkspaceModels(datasetNodeId, { config = siteConfig, getToken = useGetToken, fetchFn = globalThis.fetch } = {}) {
  if (!datasetNodeId) return []
  const resp = await fetchFn(`${config.api2Url}/metadata/models?dataset_id=${encodeURIComponent(datasetNodeId)}`, {
    headers: { Authorization: `Bearer ${await getToken()}`, Accept: 'application/json' },
  })
  if (resp.status === 403 || resp.status === 404) return []
  if (!resp.ok) throw new Error(`metadata-service responded ${resp.status}`)
  const list = await resp.json()
  return (Array.isArray(list) ? list : [])
    .map((item) => item.model || item)
    .filter((m) => m?.name && m.latest_version)
    .map((m) => m.name)
    .sort()
}
