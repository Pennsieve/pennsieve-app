// The International Brain Laboratory (internationalbrainlab.org), whose
// open data is in the Registry of Open Data on AWS as its ibl- entries
// (us-east-1): the brain-wide map, reproducible ephys, behaviour and autism
// models in the ibl-brain-wide-map-public bucket (by lab, subject, date and
// session under data/), and BrainWideBench in its own. IBL's search API
// needs a login, so a notebook takes one, or a folder of it, from the
// bucket as a view like any Open Data dataset's.
import { openDataCatalog } from '@/utils/viewsService'

export const IBL_PUBLISHER = 'International Brain Laboratory'

export const isIblEntry = (d) => d?.publisher === IBL_PUBLISHER && !!d.anonymous

export const countIbl = ({ catalog = openDataCatalog } = {}) => catalog().then((list) => list.filter(isIblEntry).length)
