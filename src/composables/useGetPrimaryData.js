import * as siteConfig from '@/site-config/site.json'
import { curryN, find, propEq, propOr } from 'ramda'
import store from '@/store'
import { useGetToken } from '@/composables/useGetToken'
import { useSendXhr } from '@/mixins/request/request_composable'

function _isInList(member, activeOrganization, listName) {
    const profileId = propOr(0, 'id', member)
    const list = propOr([], listName, activeOrganization)
    const inList = find(propEq('id', profileId), list)
    return Boolean(inList)
}
const isInList = curryN(3, _isInList)

function getOrgRole(member, activeOrganization) {
    const checkList = isInList(member, activeOrganization)
    switch (true) {
        case checkList('administrators'):
            return 'Administrator'
        case checkList('owners'):
            return 'Owner'
        default:
            return 'Collaborator'
    }
}

function updateMembers(users) {
    return users.map(member => {
        const role = getOrgRole(member, store.getters.activeOrganization)
        let newFields = { role }
        if (!member.storage) {
            newFields = { storage: 0, role }
        }
        return Object.assign({}, newFields, member)
    })
}

// GetPrimaryData calls endpoints that return data that should always
// be available on each page. This data is organization scoped and is
// renewed on app reload and on workspace switch.
export async function useGetPrimaryData() {
    return useGetToken().then(async token => {
        const activeOrganization = store.getters.activeOrganization

        if (activeOrganization?.isGuest) {
            return Promise.resolve()
        }

        const activeOrgId = activeOrganization.organization.id
        const teamUrl = `${siteConfig.apiUrl}/organizations/${activeOrgId}/teams?api_key=${token}`

        const teamAndPublishersPromise = useSendXhr(teamUrl)
            .then(response => store.dispatch('updateTeams', response))
            .then(() => {
                const publisherTeam = store.getters.publisherTeam
                const publisherTeamMembersUrl = `${siteConfig.apiUrl}/organizations/${activeOrgId}/teams/${publisherTeam.id}/members?api_key=${token}`
                return useSendXhr(publisherTeamMembersUrl)
                    .then(publisherTeamMembers => store.dispatch('updatePublishers', publisherTeamMembers))
            })

        const orgMembersUrl = `${siteConfig.apiUrl}/organizations/${activeOrgId}/members?api_key=${token}`
        let orgMembersPromise
        if (store.getters.hasFeature('sandbox_org_feature')) {
            orgMembersPromise = Promise.resolve()
        } else {
            orgMembersPromise = useSendXhr(orgMembersUrl)
                .then(orgMembersResponse => {
                    const orgMembers = updateMembers(orgMembersResponse)
                    store.dispatch('updateOrgMembers', orgMembers)
                })
                .catch(err => console.warn('Failed to load org members:', err))
        }

        const orgContributorsUrl = `${siteConfig.apiUrl}/contributors?api_key=${token}`
        const orgContributorsPromise = useSendXhr(orgContributorsUrl)
            .then(orgContributors => store.dispatch('setOrgContributors', orgContributors))
            .catch(err => console.warn('Failed to load org contributors:', err))

        const dataUseAgreementsUrl = `${siteConfig.apiUrl}/organizations/${activeOrgId}/data-use-agreements?api_key=${token}`
        const dataUseAgreementsPromise = useSendXhr(dataUseAgreementsUrl)
            .then(dataUseAgreements => store.dispatch('updateDataUseAgreements', dataUseAgreements))
            .catch(err => console.warn('Failed to load data use agreements:', err))

        const datasetStatusesUrl = `${siteConfig.apiUrl}/organizations/${activeOrgId}/dataset-status?api_key=${token}`
        const datasetStatusesPromise = useSendXhr(datasetStatusesUrl)
            .then(datasetStatuses => store.dispatch('updateOrgDatasetStatuses', datasetStatuses))
            .catch(err => console.warn('Failed to load dataset statuses:', err))

        // Applications are loaded lazily by Analysis.vue on mount and refetched
        // by its watcher when activeOrganization changes — no pre-warm needed here.

        return Promise.all([
            teamAndPublishersPromise,
            orgMembersPromise,
            orgContributorsPromise,
            dataUseAgreementsPromise,
            datasetStatusesPromise,
        ])
    })
}
