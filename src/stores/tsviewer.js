// @/stores/viewerStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as site from "@/site-config/site.json";
import {useGetToken} from "@/composables/useGetToken";
import toQueryParams from "@/utils/toQueryParams";

import vuexStore from '../store/index'  // Assuming your Vuex store is exported from vuexStore.js

export const useViewerStore = defineStore('tsviewer', () => {

    const viewerChannels = ref([])
    const viewerMontageScheme = ref('NOT_MONTAGED')
    const customMontageMap = ref({})
    const workspaceMontages = ref([])
    const viewerErrors = ref(null)
    const selectedChannel = ref(null) // Add selectedChannel state
    const needsRerender = ref(null)

    // Getters (from original Vuex getters)
    const getMontageMessageByName = computed(() => {
        return (name) => {
            return workspaceMontages.value.find(montage => montage.name === name)
        }
    })

    const setChannels = (channels) => {
        viewerChannels.value = channels
    }

    const setViewerMontageScheme = (scheme) => {
        viewerMontageScheme.value = scheme
    }

    const setCustomMontageMap = (map) => {
        customMontageMap.value = map
    }

    const setWorkspaceMontages = (montages) => {
        workspaceMontages.value = montages
    }

    const setViewerErrors = (errors) => {
        viewerErrors.value = errors
    }

    const setSelectedChannel = (channelData) => {
        selectedChannel.value = channelData
    }

    const setNeedsRerender = (renderData) => {
        needsRerender.value = renderData
    }

    const updateChannelProperty = (channelId, property, value) => {
        const channel = viewerChannels.value.find(ch => ch.id === channelId)
        if (channel) {
            channel[property] = value
        }
    }

    const updateChannelVisibility = (channelId, visible) => {
        updateChannelProperty(channelId, 'visible', visible)
    }

    const updateChannelSelection = (channelId, selected) => {
        updateChannelProperty(channelId, 'selected', selected)
    }

    const updateChannelFilter = (channelId, filter) => {
        updateChannelProperty(channelId, 'filter', filter)
    }

    // Reset all state
    const resetViewer = () => {
        viewerChannels.value = []
        viewerMontageScheme.value = 'NOT_MONTAGED'
        customMontageMap.value = {}
        workspaceMontages.value = []
        viewerErrors.value = null
        selectedChannel.value = null
    }

    const fetchWorkspaceMontages = async () => {
        try {
            let endpoint = `${site.api2Url}/timeseries/montages`
            const token = await useGetToken()

            const queryParams = toQueryParams({
                organization_id: vuexStore.getters.activeOrganization.organization.id
            })

            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')

            const resp = await fetch(url, {
                method: 'GET',
                headers: myHeaders
            })

            if (resp.ok) {
                const montageResponse = await resp.json()
                setWorkspaceMontages(montageResponse.montages)
                return montageResponse.montages
            } else {
                return Promise.reject(resp)
            }
        } catch (err) {
            return Promise.reject(err)
        }
    }

    const triggerRerender = (cause) => {
        setNeedsRerender({
            timestamp: Date.now(),
            cause: cause
        })
    }

    const resetRerenderTrigger = () => {
        needsRerender.value = null
    }

    return {
        // State
        viewerChannels,
        viewerMontageScheme,
        customMontageMap,
        workspaceMontages,
        viewerErrors,
        selectedChannel,
        needsRerender,

        // Getters
        getMontageMessageByName,

        // Actions
        setChannels,
        setViewerMontageScheme,
        setCustomMontageMap,
        setWorkspaceMontages,
        setViewerErrors,
        setSelectedChannel,
        updateChannelProperty,
        updateChannelVisibility,
        updateChannelSelection,
        updateChannelFilter,
        resetViewer,
        fetchWorkspaceMontages,
        triggerRerender,
        resetRerenderTrigger
    }
})