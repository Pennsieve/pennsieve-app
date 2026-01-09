import * as siteConfig from "@/site-config/site.json";
import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";
import store from "@/store";
import {checkIsSubscribed} from "@/composables/useCheckTerms";
import router from "@/router";

export async function useSwitchWorkspace(org) {
    const orgId = org.organization.id
    
    // Track when loading started for minimum display time
    const loadingStartTime = Date.now()
    const minimumLoadingTime = 600 // milliseconds
    
    // Set loading state to true at the beginning (in case it wasn't set already)
    store.dispatch('setIsSwitchingOrganization', true)
    
    return useGetToken()
        .then(token => {
            const switchOrgUrl = `${siteConfig.apiUrl}/session/switch-organization?organization_id=${orgId}&api_key=${token}`
            return useSendXhr(switchOrgUrl, {method: 'PUT'})
                .then(response => {

                    const p0 = store.dispatch('clearState')
                    const p1 = store.dispatch('clearDatasetFilters')
                    const p2 = store.dispatch('datasetModule/clearSearchState')
                    const p3 = store.dispatch('updateFilesProxyId', null)

                    return Promise.all([p0,p1,p2,p3])
                        .then(() => {
                            if (!checkIsSubscribed) {
                                router.replace(`/${orgId}/welcome/terms-of-service`)
                            } else {
                                router.replace(`/${orgId}/datasets`)
                            }
                        })

                }).then(() => {
                    return store.dispatch('updateActiveOrganization', org)
                })
                .finally(() => {
                    // Calculate how long the loading has been shown
                    const elapsedTime = Date.now() - loadingStartTime
                    const remainingTime = Math.max(0, minimumLoadingTime - elapsedTime)
                    
                    // Clear loading state after minimum time has passed
                    setTimeout(() => {
                        store.dispatch('setIsSwitchingOrganization', false)
                    }, remainingTime)
                })
        })
        .catch(err => {
            // Clear loading state on error with minimum display time
            const elapsedTime = Date.now() - loadingStartTime
            const remainingTime = Math.max(0, minimumLoadingTime - elapsedTime)
            
            setTimeout(() => {
                store.dispatch('setIsSwitchingOrganization', false)
            }, remainingTime)
            
            useHandleXhrError(err)
        })


}