// ENCODE (encodeproject.org), whose released files are in the Registry of
// Open Data on AWS as the encode-project entry (the encode-public bucket,
// us-west-2). ENCODE's own API (anyone may read it, and browsers may call
// it) finds experiments and says each file's S3 key; the files of an
// experiment are spread across dated folders (2022/06/14/<uuid>/ENCFF...),
// so a notebook takes the ones picked by their keys, in a folder named
// after the experiment (viewsService createOpenDataFilesView).
import { createOpenDataFilesView } from '@/utils/viewsService'

export const ENCODE_API = 'https://www.encodeproject.org'
// The Open Data catalog's entry for ENCODE, and its bucket.
export const ENCODE_REGISTRY = 'encode-project'
export const ENCODE_BUCKET = 'encode-public'
export const encodeUrl = (accession) => `${ENCODE_API}/experiments/${encodeURIComponent(accession)}/`

// The most a notebook takes at once: views-service's sources per view, and
// files per source.
export const ENCODE_MAX_EXPERIMENTS = 20
export const ENCODE_MAX_FILES = 100

const ORGANISM = 'replicates.library.biosample.donor.organism.scientific_name'

// A search: params, and a field for each of fields (only those come back).
async function search(params, fields, fetchFn) {
  const qs = new URLSearchParams({ ...params, format: 'json' })
  for (const f of fields) qs.append('field', f)
  const resp = await fetchFn(`${ENCODE_API}/search/?${qs}`, { headers: { Accept: 'application/json' } })
  const body = await resp.json().catch(() => ({}))
  // A search with no results is a 404 with an empty @graph.
  if (!resp.ok && !(resp.status === 404 && Array.isArray(body?.['@graph']))) {
    throw new Error(body?.description || `ENCODE responded ${resp.status}`)
  }
  return body
}

const facet = (body, field) =>
  ((body.facets || []).find((f) => f.field === field)?.terms || []).filter((t) => t.doc_count > 0).map((t) => t.key)

// The first limit released experiments matching query, an assay and an
// organism: { experiments, total, assays, organisms } (the facets'
// choices, most experiments first). ENCODE refuses a search that pages
// (any from, even 0: 403), so more is a bigger limit.
export async function searchEncode({ query = '', assay = '', organism = '', limit = 25 } = {}, { fetchFn = globalThis.fetch } = {}) {
  const params = { type: 'Experiment', status: 'released', limit: String(limit) }
  if (query.trim()) params.searchTerm = query.trim()
  if (assay) params.assay_title = assay
  if (organism) params[ORGANISM] = organism
  const fields = ['accession', 'description', 'assay_title', 'biosample_summary', 'lab.title', 'date_released']
  const body = await search(params, fields, fetchFn)
  return {
    experiments: (body['@graph'] || []).map((e) => ({
      accession: e.accession,
      description: e.description || '',
      assay: e.assay_title || '',
      biosample: e.biosample_summary || '',
      lab: e.lab?.title || '',
      released: e.date_released || '',
    })),
    total: body.total || 0,
    assays: facet(body, 'assay_title'),
    organisms: facet(body, ORGANISM),
  }
}

export async function countEncode(options = {}) {
  return (await searchEncode({ limit: 0 }, options)).total
}

// The S3 key of a file in the public bucket, or "" for one elsewhere.
export function encodeKey(s3Uri = '') {
  const prefix = `s3://${ENCODE_BUCKET}/`
  return s3Uri.startsWith(prefix) ? s3Uri.slice(prefix.length) : ''
}

// An experiment's released files in the public bucket: { accession, key,
// name, format, outputType, size, assembly, replicates, preferred }, its
// default analysis's first (ENCODE marks them preferred_default), then by
// output type.
export async function encodeFiles(accession, { fetchFn = globalThis.fetch } = {}) {
  const fields = ['accession', 's3_uri', 'file_format', 'file_type', 'output_type', 'file_size', 'assembly', 'biological_replicates', 'preferred_default']
  const body = await search({ type: 'File', dataset: `/experiments/${accession}/`, status: 'released', limit: 'all' }, fields, fetchFn)
  return (body['@graph'] || [])
    .map((f) => {
      const key = encodeKey(f.s3_uri)
      return {
        accession: f.accession,
        key,
        name: key.split('/').pop(),
        format: f.file_type || f.file_format || '',
        outputType: f.output_type || '',
        size: f.file_size || 0,
        assembly: f.assembly || '',
        replicates: f.biological_replicates || [],
        preferred: !!f.preferred_default,
      }
    })
    .filter((f) => f.key)
    .sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.outputType.localeCompare(b.outputType) || a.name.localeCompare(b.name))
}

// The files to start with: the default analysis's, if ENCODE marks any.
export const defaultFiles = (files) => files.filter((f) => f.preferred).slice(0, ENCODE_MAX_FILES)

// A view's name for picks ({ accession, assay, biosample, files }).
export function encodeViewName(picks) {
  if (picks.length === 1) return `ENCODE: ${picks[0].accession} (${picks[0].assay})`
  return `ENCODE: ${picks.length} experiments`
}

// A view made for one run of the picks: each experiment's files in its
// folder.
export function createEncodeView(picks, { create = createOpenDataFilesView } = {}) {
  return create({
    dataset: ENCODE_REGISTRY,
    name: encodeViewName(picks),
    groups: picks.map((p) => ({ paths: p.files.map((f) => f.key), folder: p.accession })),
  })
}
