import { reactive } from 'vue'

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

// OpenNeuro keeps private, withdrawn and not-yet-released datasets in the
// same bucket as public ones: their folders list, but their files can't be
// read. A dataset released in the last few days can be partly readable:
// its dataset_description.json is, its README and data aren't (ds009109).
// Anonymous HEADs of both files say which (the bucket lets browsers ask):
// false when either is refused, true when one reads and neither is
// refused, else null (neither there, or no answer), which stops no one.
// Answers are kept for the page, in a reactive map, so a picker shows them
// as they come.
const OPENNEURO_BUCKET_URL = 'https://s3.us-east-1.amazonaws.com/openneuro.org'
export const OPENNEURO_NOT_PUBLIC = "OpenNeuro hasn't made this dataset's files public (yet), so it can't be downloaded"
export const openNeuroReadable = reactive(new Map())
const asked = new Map()

const PROBES = ['dataset_description.json', 'README']

export function checkOpenNeuro(id, { fetchFn = globalThis.fetch } = {}) {
  if (!asked.has(id)) {
    const status = (file) =>
      fetchFn(`${OPENNEURO_BUCKET_URL}/${encodeURIComponent(id)}/${file}`, { method: 'HEAD' }).then((r) => r.status, () => 0)
    const answer = Promise.all(PROBES.map(status))
      .then((codes) => (codes.includes(403) ? false : codes.includes(200) ? true : null))
      .then((readable) => {
        openNeuroReadable.set(id, readable)
        return readable
      })
    asked.set(id, answer)
  }
  return asked.get(id)
}

// Checks ids a few at a time (a browser asks a host six at a time anyway),
// in order, until current() says the list has changed.
export async function checkOpenNeuroAll(ids, { current = () => true, at = 6, fetchFn } = {}) {
  const queue = [...ids]
  const worker = async () => {
    while (queue.length && current()) await checkOpenNeuro(queue.shift(), { fetchFn })
  }
  await Promise.all(Array.from({ length: Math.min(at, queue.length) }, worker))
}

// Whether a dataset is known to be unreadable: its id, or the ds folder a
// prefix of OpenNeuro's bucket starts with.
export const openNeuroUnreadable = (idOrPrefix = '') => openNeuroReadable.get(String(idOrPrefix).split('/')[0]) === false
