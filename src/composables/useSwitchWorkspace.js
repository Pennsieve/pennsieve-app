import * as siteConfig from "@/site-config/site.json";
import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";
import store from "@/store";
import {checkIsSubscribed} from "@/composables/useCheckTerms";
import router from "@/router";
import {useComputeResourcesStore} from "@/stores/computeResourcesStore";
import {useGetPrimaryData} from "@/composables/useGetPrimaryData";

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

        // Refetch org-scoped data (members, teams, publishers, contributors,
        // data use agreements, dataset statuses, applications) so pages like
        // /:orgId/people don't render with stale or empty state from the
        // previous workspace.
        try {
            await useGetPrimaryData()
        } catch (err) {
            console.warn('Failed to refresh primary data on org switch:', err)
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