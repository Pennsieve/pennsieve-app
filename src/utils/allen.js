// The Allen Institute's open data (alleninstitute.org): its atlases,
// observatories and cell collections are each an entry of the Registry of
// Open Data on AWS named allen-<name> (registry.opendata.aws/allen-mouse-brain-atlas),
// SEA-AD's among them; the Allen Institute for AI's are allenai-<name>, and
// aren't. A notebook takes one, or a folder of it, as a view like any Open
// Data dataset's. Most are in us-west-2.
import { openDataCatalog } from '@/utils/viewsService'

export const isAllenEntry = (d) => /^allen-/.test(d?.name || '') && !!d.anonymous

export const countAllen = ({ catalog = openDataCatalog } = {}) => catalog().then((list) => list.filter(isAllenEntry).length)
