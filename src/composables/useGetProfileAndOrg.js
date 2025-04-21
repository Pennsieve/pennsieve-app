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