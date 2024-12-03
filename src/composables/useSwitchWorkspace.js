import * as siteConfig from "@/site-config/site.json";
import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";
import store from "@/store";
import {checkIsSubscribed} from "@/composables/useCheckTerms";
import router from "@/router";

export async function useSwitchWorkspace(org) {
    const orgId = org.organization.id
    return useGetToken()
        .then(token => {
            const switchOrgUrl = `${siteConfig.apiUrl}/session/switch-organization?organization_id=${orgId}&api_key=${token}`
            return useSendXhr(switchOrgUrl, {method: 'PUT'})
                .then(response => {

                    const p1 = store.dispatch('clearDatasetFilters')
                    const p2 = store.dispatch('datasetModule/clearSearchState')
                    const p3 = store.dispatch('setDatasets', [])
                    const p4 = store.dispatch('updateConcepts', [])
                    const p5 = store.dispatch('updateFilesProxyId', null)
                    const p6 = store.dispatch('setDatasetTemplates', [])

                    return Promise.all([p1,p2,p3,p4,p5,p6])
                        .then(() => {
                            if (!checkIsSubscribed) {
                                router.replace(`/${orgId}/welcome/terms-of-service`)
                            } else {
                                router.replace(`/${orgId}/datasets`)
                            }
                        })

                }).then(() => {
                    console.log('Organization Switched')
                    return store.dispatch('updateActiveOrganization', org)
                })
        })
        .catch(err => useHandleXhrError(err))


}