

/**
 * Check if the organization has accepted subscription terms
 * @param {Object} organization
 * @returns {Boolean}
 */
import {compose, defaultTo, find, pathOr, prop, propEq, propOr} from "ramda";
import {getters} from "@/store";

export function checkIsSubscribed(organization) {
    const activeOrgTermsVersion = pathOr('', ['organization', 'customTermsOfService', 'version'], organization)
    const activeOrgHasTerms = Boolean(activeOrgTermsVersion)
    // if org has custom terms, check that user has accepter most recent version
    if (activeOrgHasTerms) {
        // get the user's terms of service object for current org
        // search through every customTermsOfService object to find match
        const orgId = pathOr('', ['organization', 'id'], organization)
        const profileTerms = compose(
            defaultTo(''),
            prop('version'),
            find(propEq('organizationId', orgId)),
            propOr([], 'customTermsOfService')
        )(getters.profile)
        // check versions for equality
        return activeOrgTermsVersion === profileTerms
    }

    // get Pennsieve terms on user profile object
    const profileTerms = pathOr('', ['pennsieveTermsOfService', 'version'], getters.profile)

    // short circuit if user has never accepted Pennsieve terms
    if (!profileTerms) {
        return false
    }

    // check versions for equality
    return this.bfTermsOfServiceVersion === profileTerms
}