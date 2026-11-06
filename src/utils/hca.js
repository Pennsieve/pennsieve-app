// The Human Cell Atlas (humancellatlas.org), whose open-access files are
// mirrored in the Registry of Open Data on AWS as the humancellatlas entry
// (us-east-1), stored by content: file/<sha256>.sha256. Its Data Portal's
// API (Azul; anyone may read it, and browsers may call it) finds projects
// and lists their files with each one's sha256; a notebook takes the files
// picked by their keys, under their own names, in a folder named after
// their project (viewsService createOpenDataFilesView).
import { createOpenDataFilesView } from '@/utils/viewsService'

export const HCA_API = 'https://service.azul.data.humancellatlas.org'
// The Open Data catalog's entry for the Human Cell Atlas.
export const HCA_REGISTRY = 'humancellatlas'
export const hcaProjectUrl = (id) => `https://explore.data.humancellatlas.org/projects/${encodeURIComponent(id)}`

// The most a notebook takes at once: views-service's sources per view, and
// files per source.
export const HCA_MAX_PROJECTS = 20
export const HCA_MAX_FILES = 100

// Raw reads and alignments: thousands to a project, and not what a notebook
// starts from. The picker leaves them out unless asked.
export const HCA_RAW_FORMATS = ['fastq', 'fastq.gz', 'fq.gz', 'bam', 'bai', 'cram']
// Matrices, ticked to start with.
const MATRIX_FORMATS = ['h5ad', 'loom', 'h5', 'rds', 'mtx.gz', 'mtx']

// An Azul filter: { field: { is: [values] } } for each field with values,
// open-access only.
function filtersOf(terms = {}) {
  const f = { accessible: { is: [true] } }
  for (const [k, v] of Object.entries(terms)) if (v && (!Array.isArray(v) || v.length)) f[k] = { is: Array.isArray(v) ? v : [v] }
  return JSON.stringify(f)
}

async function get(url, fetchFn) {
  const resp = await fetchFn(url, { headers: { Accept: 'application/json' } })
  const body = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(body?.Message || body?.message || `The Human Cell Atlas responded ${resp.status}`)
  return body
}

const index = (what, params) => `${HCA_API}/index/${what}?${new URLSearchParams(params)}`
const terms = (body, field) => (body.termFacets?.[field]?.terms || []).map((t) => t.term).filter(Boolean)

// The open-access projects of a species, an organ and an assay, by title,
// with the choices the filters offer: { titles, total, species, organs,
// assays }. Azul doesn't search by words: its title facet lists every
// project's, which the picker searches.
export async function hcaProjectTitles({ species = '', organ = '', assay = '' } = {}, { fetchFn = globalThis.fetch } = {}) {
  const body = await get(
    index('projects', { size: '1', filters: filtersOf({ genusSpecies: species, organ, libraryConstructionApproach: assay }) }),
    fetchFn
  )
  return {
    titles: terms(body, 'projectTitle').sort((a, b) => a.localeCompare(b)),
    total: body.pagination?.total || 0,
    species: terms(body, 'genusSpecies'),
    organs: terms(body, 'organ'),
    assays: terms(body, 'libraryConstructionApproach'),
  }
}

export async function countHca(options = {}) {
  return (await hcaProjectTitles({}, options)).total
}

// The titles with every word of query.
export function searchHcaTitles(titles = [], query = '') {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return words.length ? titles.filter((t) => words.every((w) => t.toLowerCase().includes(w))) : titles
}

const flat = (list, field) => [...new Set((list || []).flatMap((x) => x?.[field] || []).filter(Boolean))]

// A project as the picker shows it, from an Azul project hit.
export function toHcaProject(hit) {
  const p = hit.projects?.[0] || {}
  return {
    id: p.projectId,
    title: p.projectTitle || '',
    shortname: p.projectShortname || '',
    description: p.projectDescription || '',
    cellCount: p.estimatedCellCount || null,
    species: flat(hit.donorOrganisms, 'genusSpecies'),
    organs: flat(hit.samples, 'organ'),
    assays: flat(hit.protocols, 'libraryConstructionApproach'),
    diseases: flat(hit.samples, 'disease').filter((d) => d !== 'normal'),
  }
}

// The projects of these titles, in their order (one request: Azul's
// project records are large, so only those shown are read).
export async function hcaProjects(titles, { fetchFn = globalThis.fetch } = {}) {
  if (!titles.length) return []
  const body = await get(index('projects', { size: String(titles.length), filters: filtersOf({ projectTitle: titles }) }), fetchFn)
  const byTitle = new Map((body.hits || []).map((h) => [h.projects?.[0]?.projectTitle, toHcaProject(h)]))
  return titles.map((t) => byTitle.get(t)).filter(Boolean)
}

// A project's file formats, most files first: [{ format, count }].
export async function hcaFormats(projectId, { fetchFn = globalThis.fetch } = {}) {
  const body = await get(index('files', { size: '1', filters: filtersOf({ projectId }) }), fetchFn)
  return (body.termFacets?.fileFormat?.terms || []).filter((t) => t.term).map((t) => ({ format: t.term, count: t.count }))
}

// A file as the picker shows it, from an Azul file hit.
export const toHcaFile = (hit) => {
  const f = hit.files?.[0] || {}
  return {
    id: f.uuid,
    name: f.name,
    format: f.format || '',
    size: f.size || 0,
    sha256: f.sha256 || '',
    content: (f.contentDescription || []).filter(Boolean).join(', '),
    matrix: MATRIX_FORMATS.includes(f.format) || (f.contentDescription || []).some((c) => /matrix/i.test(c || '')),
  }
}

// A page of a project's files of the formats given: { files, next }, next
// the URL of the next page (Azul's) or null.
export async function hcaFiles(projectId, formats, { next = null, fetchFn = globalThis.fetch } = {}) {
  const url = next || index('files', { size: '100', sort: 'fileName', order: 'asc', filters: filtersOf({ projectId, fileFormat: formats }) })
  const body = await get(url, fetchFn)
  return { files: (body.hits || []).map(toHcaFile).filter((f) => f.sha256), next: body.pagination?.next || null }
}

// The formats to start with: all but raw reads.
export const defaultFormats = (formats) => formats.map((f) => f.format).filter((f) => !HCA_RAW_FORMATS.includes(f))

// A view's name for picks ({ id, title, shortname, files }).
export function hcaViewName(picks) {
  if (picks.length === 1) return `HCA: ${picks[0].title}`
  return `HCA: ${picks.length} projects`
}

// A project's folder in a view: its short name, as a folder name may have
// it.
export const hcaFolder = (p) => (p.shortname || p.id).replace(/[\/\u0000-\u001f]+/g, '-').trim() || p.id

// Its files' names in a view: their own, with the start of their id when
// two share one.
export function hcaFileNames(files) {
  const seen = new Map()
  for (const f of files) seen.set(f.name, (seen.get(f.name) || 0) + 1)
  return Object.fromEntries(
    files.map((f) => {
      if (seen.get(f.name) === 1) return [`${f.sha256}.sha256`, f.name]
      const dot = f.name.indexOf('.')
      const [stem, ext] = dot > 0 ? [f.name.slice(0, dot), f.name.slice(dot)] : [f.name, '']
      return [`${f.sha256}.sha256`, `${stem} (${String(f.id).slice(0, 8)})${ext}`]
    })
  )
}

// A view made for one run of the picks: each project's files, by their
// keys, under their names, in its folder.
export function createHcaView(picks, { create = createOpenDataFilesView } = {}) {
  return create({
    dataset: HCA_REGISTRY,
    name: hcaViewName(picks),
    groups: picks.map((p) => ({
      prefix: 'file/',
      paths: p.files.map((f) => `${f.sha256}.sha256`),
      names: hcaFileNames(p.files),
      folder: hcaFolder(p),
    })),
  })
}
