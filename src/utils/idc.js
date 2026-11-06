// The NCI Imaging Data Commons (imaging.datacommons.cancer.gov), whose
// collections are in the Registry of Open Data on AWS as the
// nci-imaging-data-commons entry (us-east-1, three buckets): each DICOM
// series is a folder, <series uuid>/, of one of them. IDC's API (anyone may
// read it, and browsers may call it) lists collections and their series. A
// notebook takes the series picked, each a folder named for people:
// radiology as files to download (tens of MB, read by tools that want a
// local folder), a slide (SM) whole as a stack read in place (gigabytes, a
// region at a time).
import { createOpenDataFilesView } from '@/utils/viewsService'

export const IDC_API = 'https://api.imaging.datacommons.cancer.gov/v3'
// The Open Data catalog's entry for IDC.
export const IDC_REGISTRY = 'nci-imaging-data-commons'
export const idcCollectionUrl = (id) => `https://portal.imaging.datacommons.cancer.gov/explore/filters/?collection_id=${encodeURIComponent(id)}`

// The most a notebook takes at once: views-service's sources per view.
export const IDC_MAX_SERIES = 20
// Whole-slide images: read in place, never downloaded.
export const IDC_SLIDE_MODALITIES = ['SM']

async function call(path, { body = null, fetchFn = globalThis.fetch } = {}) {
  const resp = await fetchFn(`${IDC_API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Accept: 'application/json', ...(body && { 'Content-Type': 'application/json' }) },
    ...(body && { body: JSON.stringify(body) }),
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(data?.detail || data?.message || `IDC responded ${resp.status}`)
  return data
}

const list = (s = '') =>
  String(s)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

// IDC's collections, by name: { id, name, cancerTypes, locations, species,
// subjects, description, supporting }.
export async function idcCollections(options = {}) {
  const rows = await call('/collections', options)
  return (rows || [])
    .map((c) => ({
      id: c.collection_id,
      name: c.collection_name || c.collection_id,
      cancerTypes: list(c.cancer_types),
      locations: list(c.tumor_locations),
      species: list(c.species),
      subjects: Number(c.subjects) || 0,
      description: c.description || '',
      supporting: list(c.supporting_data),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function countIdc(options = {}) {
  return (await idcCollections(options)).length
}

// The collections with every word of query in their name, cancer types,
// locations or species; species, when given, narrows them to it.
export function searchIdc(collections = [], query = '', species = '') {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const of = species ? collections.filter((c) => c.species.includes(species)) : collections
  if (!words.length) return of
  const text = (c) => [c.id, c.name, ...c.cancerTypes, ...c.locations, ...c.species].join(' ').toLowerCase()
  return of.filter((c) => words.every((w) => text(c).includes(w)))
}

// A collection's modalities, size and license breakdown.
export async function idcCollection(id, options = {}) {
  const c = await call(`/collections/${encodeURIComponent(id)}`, options)
  const modalities = Array.isArray(c.modalities) ? c.modalities : list(String(c.modalities || '').replace(/[[\]']/g, ''))
  return { id, modalities, series: Number(c.series) || 0, sizeTB: Number(c.size_TB) || 0, patients: Number(c.patients) || 0 }
}

// A series as the picker shows it, from a manifest row.
export const toIdcSeries = (r) => ({
  uuid: r.crdc_series_uuid,
  bucket: r.aws_bucket,
  collection: r.collection_id,
  patient: r.PatientID || '',
  modality: r.Modality || '',
  description: r.SeriesDescription || '',
  instances: r.instanceCount || 0,
  size: Math.round((r.series_size_MB || 0) * 1e6),
  slide: IDC_SLIDE_MODALITIES.includes(r.Modality),
})

// A page of a collection's series of a modality: { series, total }.
export async function idcSeries({ collection, modality = '', page = 0, pageSize = 50 }, options = {}) {
  const terms = { collection_id: [collection], ...(modality && { Modality: [modality] }) }
  const res = await call('/cohort/manifest', { ...options, body: { filters: { terms }, page, page_size: pageSize, include_rows: true } })
  return { series: (res.series || []).map(toIdcSeries).filter((s) => s.uuid && s.bucket), total: Number(res.total_series) || 0 }
}

// A series' folder in a session: its patient, and its modality and
// description with the start of its id (descriptions repeat).
export function idcSeriesFolder(s) {
  const clean = (x) =>
    String(x || '')
      .replace(/[\/\u0000-\u001f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
  const name = [s.modality, clean(s.description)].filter(Boolean).join(' ')
  return `${clean(s.patient) || 'series'}/${name ? `${name} ` : ''}(${String(s.uuid).slice(0, 8)})`
}

// A view's name for picks (series).
export function idcViewName(picks) {
  if (picks.length === 1) return `IDC: ${picks[0].collection} ${picks[0].patient} ${picks[0].modality}`.trim()
  const collections = [...new Set(picks.map((p) => p.collection))]
  return `IDC: ${collections.length === 1 ? collections[0] : `${collections.length} collections`} (${picks.length} series)`
}

// A view made for one run of the series picked: each its folder, a slide
// taken whole as a stack.
export function createIdcView(picks, { create = createOpenDataFilesView } = {}) {
  return create({
    dataset: IDC_REGISTRY,
    name: idcViewName(picks),
    groups: picks.map((s) => ({
      prefix: `${s.uuid}/`,
      bucket: s.bucket,
      folder: idcSeriesFolder(s),
      ...(s.slide && { stack: 'dicom-wsi' }),
    })),
  })
}
