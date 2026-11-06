// BossDB (bossdb.org), whose public volumes are in the Registry of Open Data
// on AWS as the bossdb entry: the bossdb-open-data bucket holds each as a
// Neuroglancer precomputed volume at <collection>/<experiment>/<channel>/.
// BossDB's API (anyone may read it with the token "public", and browsers may
// call it) describes them: a collection's experiments, an experiment's
// description and channels, a channel's type and where it's stored. A
// notebook takes a channel as a view of its folder, which views-service
// takes whole, as a stack read in place.

import { listOpenDataFolder } from '@/utils/viewsService'

export const BOSSDB_API = 'https://api.bossdb.io/v1'
// The Open Data catalog's entry for BossDB, and its bucket.
export const BOSSDB_REGISTRY = 'bossdb'
export const BOSSDB_BUCKET = 'bossdb-open-data'
export const bossdbUrl = (collection) => `https://bossdb.org/project/${encodeURIComponent(collection)}`

async function get(path, fetchFn) {
  const resp = await fetchFn(`${BOSSDB_API}${path}`, { headers: { Authorization: 'Token public', Accept: 'application/json' } })
  const body = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(body?.detail || body?.message || `BossDB responded ${resp.status}`)
  return body
}

const part = (s) => encodeURIComponent(s)

// The collections a notebook can take from: BossDB's public ones that are in
// the Open Data bucket (its top folders), by name.
export async function bossdbCollections({ fetchFn = globalThis.fetch, listFolder = listOpenDataFolder } = {}) {
  const [api, bucket] = await Promise.all([get('/collection/', fetchFn), listFolder({ dataset: BOSSDB_REGISTRY })])
  const inBucket = new Set((bucket.folders || []).map((f) => String(f).replace(/\/$/, '')))
  return (api.collections || []).filter((c) => inBucket.has(c)).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
}

// The collections whose names have every word of query.
export function searchBossdb(collections, query = '') {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return words.length ? collections.filter((c) => words.every((w) => c.toLowerCase().includes(w))) : collections
}

// A collection's experiments, each with its description and channels.
export async function bossdbExperiments(collection, { fetchFn = globalThis.fetch } = {}) {
  const c = await get(`/collection/${part(collection)}/`, fetchFn)
  const experiments = await Promise.all(
    (c.experiments || []).map((name) =>
      get(`/collection/${part(collection)}/experiment/${part(name)}/`, fetchFn)
        .then((e) => ({ name, description: e.description || '', channels: e.channels || [], levels: e.num_hierarchy_levels || 0 }))
        .catch(() => ({ name, description: '', channels: [], levels: 0 }))
    )
  )
  return experiments.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
}

// An experiment's channels a notebook can take: those stored as a volume in
// the Open Data bucket ({ name, type, datatype, path }, path its folder there).
export async function bossdbChannels(collection, experiment, channels, { fetchFn = globalThis.fetch } = {}) {
  const all = await Promise.all(
    channels.map((name) =>
      get(`/collection/${part(collection)}/experiment/${part(experiment)}/channel/${part(name)}/`, fetchFn).catch(() => null)
    )
  )
  return all
    .filter((ch) => ch && ch.bucket === BOSSDB_BUCKET && ch.cv_path)
    .map((ch) => ({
      name: ch.name,
      type: ch.type === 'annotation' ? 'segmentation' : ch.type || '',
      datatype: ch.datatype || '',
      description: ch.description || '',
      path: `${String(ch.cv_path).replace(/^\/+|\/+$/g, '')}/`,
    }))
}

// How many collections a notebook can take from.
export async function countBossdb(options = {}) {
  return (await bossdbCollections(options)).length
}
