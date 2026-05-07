import * as siteConfig from "@/site-config/site.json";
import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";
import store from "@/store";
import {checkIsSubscribed} from "@/composables/useCheckTerms";
import router from "@/router";
import {useComputeResourcesStore} from "@/stores/computeResourcesStore";

export async function useSwitchWorkspace(org) {
    const orgId = org.organization.id

    // Set loading state to true at the beginning
    store.dispatch('setIsSwitchingOrganization', true)

    try {
        const token = await useGetToken()
        const switchOrgUrl = `${siteConfig.apiUrl}/session/switch-organization?organization_id=${orgId}&api_key=${token}`

        // Perform the organization switch
        await useSendXhr(switchOrgUrl, {method: 'PUT'})

        // Clear state and update stores
        useComputeResourcesStore().clearCache()
        await Promise.all([
            store.dispatch('clearState'),
            store.dispatch('clearDatasetFilters'),
            store.dispatch('datasetModule/clearSearchState'),
            store.dispatch('updateFilesProxyId', null)
        ])

        // Update the active organization before refetching org-scoped data
        await store.dispatch('updateActiveOrganization', org)

        // Force-refresh applications so the new org's apps are ready when the
        // user lands on any analysis tab (avoids stale list from the previous org)
        try {
            await store.dispatch('analysisModule/fetchApplications', { force: true })
        } catch (err) {
            console.warn('Failed to refresh applications on org switch:', err)
        }

        // Navigate to the appropriate route
        if (!checkIsSubscribed) {
            await router.replace(`/${orgId}/welcome/terms-of-service`)
        } else {
            await router.replace(`/${orgId}/datasets`)
        }
        
        // Clear loading state only after everything is complete
        store.dispatch('setIsSwitchingOrganization', false)
        
    } catch (err) {
        // Clear loading state immediately on error
        store.dispatch('setIsSwitchingOrganization', false)
        useHandleXhrError(err)
        throw err
    }
}