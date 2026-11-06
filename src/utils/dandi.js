// The DANDI Archive (dandiarchive.org), whose dandisets are in the Registry
// of Open Data on AWS as the dandiarchive entry. Its bucket holds a
// version's metadata by dandiset and its files as blobs by content, so a
// notebook takes a dandiset version as views-service's own kind of source
// (viewsService createDandiView), not as a folder of the bucket. DANDI's
// public API (browsers may call it) finds dandisets, lists their versions
// and gives a version's folder tree with sizes.
//
// Zarr assets (a folder of objects, not one file) are read in place: a view
// lists each as one entry, and a folder shows them, marked.

export const DANDI_API = 'https://api.dandiarchive.org/api'
// The Open Data catalog's entry for the archive.
export const DANDI_REGISTRY = 'dandiarchive'
export const dandiUrl = (id, version) =>
  `https://dandiarchive.org/dandiset/${encodeURIComponent(id)}${version ? `/${encodeURIComponent(version)}` : ''}`

async function get(path, fetchFn) {
  const resp = await fetchFn(`${DANDI_API}${path}`, { headers: { Accept: 'application/json' } })
  const body = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(body?.detail || `DANDI responded ${resp.status}`)
  return body
}

// A search result as the pickers show it: its most recent published
// version, else its draft.
export const toDandiset = (r) => {
  const v = r.most_recent_published_version || r.draft_version || {}
  return {
    id: r.identifier,
    name: v.name || `Dandiset ${r.identifier}`,
    version: v.version || 'draft',
    published: !!r.most_recent_published_version,
    contact: r.contact_person || '',
    files: v.asset_count || 0,
    size: v.size || 0,
    modified: r.modified || '',
  }
}

// Open dandisets with files matching query (its words, in titles,
// descriptions and keywords), most recently changed first: { datasets,
// count, next } where next is the page that continues the list.
export async function searchDandi({ query = '', page = 1, pageSize = 25 } = {}, { fetchFn = globalThis.fetch } = {}) {
  const q = new URLSearchParams({ page: String(page), page_size: String(pageSize), embargoed: 'false', empty: 'false', ordering: '-modified' })
  const words = query.trim()
  if (words) q.set('search', words)
  const body = await get(`/dandisets/?${q}`, fetchFn)
  return {
    datasets: (body.results || []).map(toDandiset),
    count: body.count ?? null,
    next: body.next ? page + 1 : null,
  }
}

// How many open dandisets with files the archive has.
export async function countDandi(options = {}) {
  const { count } = await searchDandi({ pageSize: 1 }, options)
  return count
}

// A dandiset's versions, newest published first and the draft last:
// [{ version, name, files, size }].
export async function dandiVersions(id, { fetchFn = globalThis.fetch } = {}) {
  const body = await get(`/dandisets/${encodeURIComponent(id)}/versions/?page_size=100`, fetchFn)
  const versions = (body.results || []).map((v) => ({ version: v.version, name: v.name, files: v.asset_count || 0, size: v.size || 0 }))
  const published = versions.filter((v) => v.version !== 'draft').sort((a, b) => b.version.localeCompare(a.version))
  return [...published, ...versions.filter((v) => v.version === 'draft')]
}

// A view's title for a dandiset version: two versions are different files.
export const dandiViewTitle = (d) => `${d.name} (DANDI:${d.id}, ${d.version})`

const isZarr = (asset) => /\/zarr\//.test(asset?.url || '')

// One level of a version's folder tree under prefix ('' for its top, else
// ending in /), as OpenDataFolders shows a bucket's: { folders: [name],
// files: [{ name, size, zarr }], truncated }. DANDI filters by whole
// folders only, so startsWith narrows the level read.
export async function listDandiFolder({ id, version, prefix = '', startsWith = '' }, { fetchFn = globalThis.fetch } = {}) {
  const q = new URLSearchParams({ path_prefix: prefix.replace(/\/$/, ''), page_size: '1000' })
  const body = await get(`/dandisets/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/assets/paths/?${q}`, fetchFn)
  const level = { folders: [], files: [], truncated: !!body.next }
  for (const r of body.results || []) {
    const name = r.path.slice(prefix.length)
    if (startsWith && !name.startsWith(startsWith)) continue
    if (r.asset) level.files.push({ name, size: r.aggregate_size || 0, zarr: isZarr(r.asset) })
    else level.folders.push(name)
  }
  return level
}
