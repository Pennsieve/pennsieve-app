// BossDB (bossdb.org), whose public volumes are in the Registry of Open Data
// on AWS as the bossdb entry: the bossdb-open-data bucket holds each as a
// Neuroglancer precomputed volume at <collection>/<experiment>/<channel>/.
// The bucket says what's there (its folders); BossDB's API (anyone may read
// it with the token "public", and browsers may call it) describes what it
// lets the public token read: an experiment's description, a channel's
// type. A notebook takes a channel as a view of its folder, which
// views-service takes whole, as a stack read in place.

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

// The collections a notebook can take from: the Open Data bucket's top
// folders, by name.
export async function bossdbCollections({ listFolder = listOpenDataFolder } = {}) {
  const { folders = [] } = await listFolder({ dataset: BOSSDB_REGISTRY })
  return folders.map((f) => String(f).replace(/\/$/, '')).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
}

// The collections whose names have every word of query.
export function searchBossdb(collections, query = '') {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return words.length ? collections.filter((c) => words.every((w) => c.toLowerCase().includes(w))) : collections
}

// A collection's experiments: its folders in the bucket, each with its
// description and channel count where BossDB's API lets the public token
// read them (it doesn't for every public experiment: those are listed
// without).
export async function bossdbExperiments(collection, { fetchFn = globalThis.fetch, listFolder = listOpenDataFolder } = {}) {
  const { folders = [] } = await listFolder({ dataset: BOSSDB_REGISTRY, prefix: `${collection}/` })
  const experiments = await Promise.all(
    folders.map((name) =>
      get(`/collection/${part(collection)}/experiment/${part(name)}/`, fetchFn)
        .then((e) => ({ name, description: e.description || '', channels: e.channels || null, levels: e.num_hierarchy_levels || 0 }))
        .catch(() => ({ name, description: '', channels: null, levels: 0 }))
    )
  )
  return experiments.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
}

// An experiment's channels: its folders in the bucket (each a volume), with
// their type and data type where BossDB's API says ({ name, type, datatype,
// description, path }, path the folder).
export async function bossdbChannels(collection, experiment, { fetchFn = globalThis.fetch, listFolder = listOpenDataFolder } = {}) {
  const prefix = `${collection}/${experiment}/`
  const { folders = [] } = await listFolder({ dataset: BOSSDB_REGISTRY, prefix })
  const described = await Promise.all(
    folders.map((name) =>
      get(`/collection/${part(collection)}/experiment/${part(experiment)}/channel/${part(name)}/`, fetchFn).catch(() => null)
    )
  )
  return folders
    .map((name, i) => {
      const ch = described[i] || {}
      return {
        name,
        type: ch.type === 'annotation' ? 'segmentation' : ch.type || '',
        datatype: ch.datatype || '',
        description: ch.description || '',
        path: `${prefix}${name}/`,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
}

// How many collections a notebook can take from.
export async function countBossdb(options = {}) {
  return (await bossdbCollections(options)).length
}
