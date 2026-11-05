// OpenNeuro (openneuro.org), whose public datasets are mirrored in the
// Registry of Open Data on AWS as the openneuro entry: one folder per
// dataset (ds000001/) in the openneuro.org bucket. Its own public GraphQL API
// (browsers may call it) finds them by title and modality; a notebook then
// takes one as a view of that folder, like any Open Data dataset. The bucket
// holds each dataset's latest snapshot.

export const OPENNEURO_API = 'https://openneuro.org/crn/graphql'
// The Open Data catalog's entry for OpenNeuro.
export const OPENNEURO_REGISTRY = 'openneuro'
export const openNeuroUrl = (id) => `https://openneuro.org/datasets/${encodeURIComponent(id)}`

// Modalities OpenNeuro's search filters by.
export const OPENNEURO_MODALITIES = ['mri', 'eeg', 'ieeg', 'meg', 'pet', 'beh']

const SEARCH = `query($q: DatasetSearchInput!, $first: Int, $after: String) {
  advancedSearch(query: $q, first: $first, after: $after) {
    edges { node { id latestSnapshot { tag description { Name Authors } summary { modalities subjects size totalFiles } } } }
    pageInfo { count hasNextPage endCursor }
  }
}`

async function gql(query, variables, fetchFn) {
  const resp = await fetchFn(OPENNEURO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const body = await resp.json().catch(() => ({}))
  // An error alongside data is about one result (a dataset since deleted,
  // say: its node is null); the rest are still good.
  if (!resp.ok || (body.errors?.length && !body.data)) {
    throw new Error(body.errors?.[0]?.message || `OpenNeuro responded ${resp.status}`)
  }
  return body.data
}

// A search result as the pickers show it.
export const toOpenNeuroDataset = (node) => {
  const snap = node.latestSnapshot || {}
  const summary = snap.summary || {}
  return {
    id: node.id,
    name: snap.description?.Name || node.id,
    tag: snap.tag || '',
    authors: snap.description?.Authors || [],
    modalities: summary.modalities || [],
    subjects: (summary.subjects || []).length,
    size: summary.size || 0,
    files: summary.totalFiles || 0,
  }
}

// Public datasets matching query (any words, in titles, descriptions and
// keywords) and modality, newest first without a query: { datasets, count,
// next } where next continues the list.
export async function searchOpenNeuro({ query = '', modality = '', first = 25, after = null } = {}, { fetchFn = globalThis.fetch } = {}) {
  const q = { publicOnly: true }
  const words = query.trim()
  if (words) q.keywords = [words]
  if (modality) q.modality = modality
  const data = await gql(SEARCH, { q, first, after }, fetchFn)
  const s = data.advancedSearch
  return {
    datasets: (s?.edges || []).filter((e) => e?.node).map((e) => toOpenNeuroDataset(e.node)),
    count: s?.pageInfo?.count ?? null,
    next: s?.pageInfo?.hasNextPage ? s.pageInfo.endCursor : null,
  }
}

// How many public datasets OpenNeuro has.
export async function countOpenNeuro(options = {}) {
  const { count } = await searchOpenNeuro({ first: 1 }, options)
  return count
}
