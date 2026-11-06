// CZ CELLxGENE Discover (cellxgene.cziscience.com), whose Census releases are
// in the Registry of Open Data on AWS as the biohub-cellxgene-census entry
// (us-west-2): each dataset of a release is one .h5ad file in its h5ads/
// folder. views-service serves the datasets of the release it offers, as
// CELLxGENE describes them, as its cellxgene catalog (GET
// /open-data/catalogs/cellxgene: CELLxGENE's own API isn't open to
// browsers); a notebook takes some as a view of that folder naming their
// files.
import { viewsRequest, createOpenDataFilesView } from '@/utils/viewsService'

// The Open Data catalog's entry for the Census.
export const CELLXGENE_REGISTRY = 'biohub-cellxgene-census'
export const cellxgeneCollectionUrl = (id) => `https://cellxgene.cziscience.com/collections/${encodeURIComponent(id)}`

// The most a notebook takes at once: views-service's files per source.
export const CELLXGENE_MAX_PICKS = 100

// The release offered and its datasets ({ release, openDataset, prefix,
// datasets: [{ id, title, file, size, cellCount, collectionId,
// collectionName, doi, organisms, tissues, assays, diseases }] }), read
// once per page load (1.4 MB).
let cache = null
export function cellxgeneDatasets(options = {}) {
  if (!cache) {
    cache = viewsRequest('/open-data/catalogs/cellxgene', options).catch((err) => {
      cache = null
      throw err
    })
  }
  return cache
}

export const countCellxgene = ({ load = cellxgeneDatasets } = {}) => load().then((c) => c.datasets.length)

// The datasets with every word of query in their title, collection,
// organisms, tissues, assays or diseases; matches on the title or
// collection first. organism, when given, narrows them to it.
export function searchCellxgene(datasets = [], query = '', organism = '') {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const of = organism ? datasets.filter((d) => d.organisms.includes(organism)) : datasets
  if (!words.length) return of
  const text = (d) => [d.title, d.collectionName, ...d.organisms, ...d.tissues, ...d.assays, ...d.diseases].join(' ').toLowerCase()
  const head = (d) => `${d.title} ${d.collectionName}`.toLowerCase()
  return of
    .filter((d) => words.every((w) => text(d).includes(w)))
    .sort((a, b) => Number(words.every((w) => head(b).includes(w))) - Number(words.every((w) => head(a).includes(w))))
}

// The organisms the datasets are of, most datasets first.
export function cellxgeneOrganisms(datasets = []) {
  const n = new Map()
  for (const d of datasets) for (const o of d.organisms) n.set(o, (n.get(o) || 0) + 1)
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([o]) => o)
}

// A view's name for picks: the one's title, else the collection they're
// all from, else how many.
export function cellxgeneViewName(picks) {
  if (picks.length === 1) return `CELLxGENE: ${picks[0].title}`
  const collections = [...new Set(picks.map((p) => p.collectionName))]
  return collections.length === 1 ? `CELLxGENE: ${collections[0]} (${picks.length} datasets)` : `CELLxGENE: ${picks.length} datasets`
}

// The input folder's name for picks (inputsHelpers addedSourceName cleans
// it): the one's title, else their collection's, else the count.
export function cellxgeneFolderName(picks) {
  if (picks.length === 1) return picks[0].title
  const collections = [...new Set(picks.map((p) => p.collectionName))]
  return collections.length === 1 ? collections[0] : `${picks.length}-datasets`
}

// A view made for one run of the datasets picked: the release's folder,
// naming their files.
export async function createCellxgeneView(picks, { load = cellxgeneDatasets, create = createOpenDataFilesView } = {}) {
  const { openDataset, prefix } = await load()
  return create({ dataset: openDataset, name: cellxgeneViewName(picks), prefix, paths: picks.map((p) => p.file) })
}
