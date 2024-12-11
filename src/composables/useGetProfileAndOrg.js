import {useGetToken} from "@/composables/useGetToken";
import {useSendXhr} from "@/mixins/request/request_composable";
import * as config from '@/site-config/site.json'



export async function useGetProfileAndOrg(store) {

    // Only get Profile and Workspaces if they have not been fetched before
    if (Object.keys(store.getters.profile).length ) {
        return Promise.resolve()
    }

    return useGetToken().then(async token => {
        const orgPromise = useSendXhr(`${config.apiUrl}/organizations?api_key=${token}`)
        const profilePromise = useSendXhr(`${config.apiUrl}/user?api_key=${token}`)

        return Promise.all([orgPromise, profilePromise])
            .then(async ( [orgs, profile]) => {
                const updatePromise = store.dispatch('updateProfile', profile)
                const updatePromise2 = store.dispatch('updateOrganizations',orgs.organizations)
                return Promise.all([updatePromise, updatePromise2])

            })
    }).catch(err => console.log(err))


}


// /**
//  * Gets user profile and active org data
//  * @param {String} token
//  */
// getProfileAndOrg: function(token) {
//     // add logic to only make organizations request if profile is defined
//     let currentPath = this.$router.currentRoute.path
//     const orgPromise = this.sendXhr(this.getActiveOrgUrl(token))
//     const profilePromise = this.sendXhr(this.getProfileUrl(token))
//
//     return Promise.all([orgPromise, profilePromise])
//         .then(([orgs, profile]) => {
//             this.updateProfile(profile)
//
//             const sortedOrgs = this.returnSort('organization.name', orgs.organizations)
//             this.updateOrganizations(sortedOrgs)
//
//             const preferredOrgId = profile.preferredOrganization
//
//             // check route params for orgId
//             const activeOrgId = preferredOrgId ?
//                 pathOr(preferredOrgId, ['params', 'orgId'], this.$route) :
//                 path(['organizations', 0, 'organization', 'id'], orgs)
//             const activeOrgIndex = orgs.organizations.findIndex(org => Boolean(org.organization.id === activeOrgId))
//             const activeOrg = orgs.organizations[activeOrgIndex]
//
//             // handle org switch
//
//             return this.handleRedirects(activeOrg, activeOrgId, preferredOrgId)

//         })
//         .catch(this.handleXhrError.bind(this))
// },