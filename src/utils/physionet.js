// PhysioNet (physionet.org), whose open-access projects are in the Registry
// of Open Data on AWS one entry per project (registry.opendata.aws/<slug>),
// each a folder of the physionet-open bucket: <slug>/ holds a folder per
// published version (1.0.0/) and a zip of the project. The catalog's
// PhysioNet entries anyone can read are its projects; a notebook takes one
// as a view of a version's folder, like any Open Data dataset. PhysioNet's
// own API isn't open to browsers (no CORS), so the catalog describes them.
// Its credentialed projects (MIMIC and the like) aren't offered.
import { listOpenDataFolder, openDataCatalog } from '@/utils/viewsService'

export const PHYSIONET_PUBLISHER = 'PhysioNet'
export const physionetUrl = (slug) => `https://physionet.org/content/${encodeURIComponent(slug)}/`

// The catalog's PhysioNet projects (listOpenData entries), by title.
export const physionetProjects = (catalog = []) =>
  catalog.filter((d) => d.publisher === PHYSIONET_PUBLISHER && d.anonymous).sort((a, b) => a.title.localeCompare(b.title))

export const countPhysionet = ({ catalog = openDataCatalog } = {}) => catalog().then((list) => physionetProjects(list).length)

// Versions as PhysioNet numbers them (1.0.0, 2.1): by each number in turn.
const versionParts = (v) => v.split('.').map((n) => Number(n))
const isVersion = (v) => /^\d+(\.\d+)*$/.test(v)
export function compareVersions(a, b) {
  const x = versionParts(a)
  const y = versionParts(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0)
    if (d) return d
  }
  return 0
}

// A project's versions, newest first: its folders that are version numbers.
export async function physionetVersions(slug, { listFolder = listOpenDataFolder } = {}) {
  const { folders = [] } = await listFolder({ dataset: slug })
  return folders.filter(isVersion).sort((a, b) => compareVersions(b, a))
}
