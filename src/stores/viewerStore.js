// @/stores/viewerStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as site from "@/site-config/site.json";

export const useViewerStore = defineStore('useViewerStore', () => {
    // State (from original Vuex state)
    const config = ref(site)
    const activeViewer = ref(null)
    const viewerChannels = ref([])
    const viewerMontageScheme = ref('NOT_MONTAGED')
    const customMontageMap = ref({})
    const workspaceMontages = ref([])
    const viewerErrors = ref(null)

    // Getters (from original Vuex getters)
    const getMontageMessageByName = computed(() => {
        return (name) => {
            return workspaceMontages.value.find(montage => montage.name === name)
        }
    })

    // Actions (from original Vuex actions)
    const setActiveViewer = (viewer) => {
        activeViewer.value = viewer
    }

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
        activeViewer.value = null
        viewerChannels.value = []
        viewerMontageScheme.value = 'NOT_MONTAGED'
        customMontageMap.value = {}
        workspaceMontages.value = []
        viewerErrors.value = null
    }

    return {
        // State
        activeViewer,
        viewerChannels,
        viewerMontageScheme,
        customMontageMap,
        workspaceMontages,
        viewerErrors,
        config,

        // Getters
        getMontageMessageByName,

        // Actions
        setActiveViewer,
        setChannels,
        setViewerMontageScheme,
        setCustomMontageMap,
        setWorkspaceMontages,
        setViewerErrors,
        updateChannelProperty,
        updateChannelVisibility,
        updateChannelSelection,
        updateChannelFilter,
        resetViewer
    }
})

// For backward compatibility with existing Vuex usage
export const createViewerStoreCompat = () => {
    const store = viewerStore()

    return {
        state: {
            viewerModule: {
                get activeViewer() { return store.activeViewer },
                get viewerChannels() { return store.viewerChannels },
                get viewerMontageScheme() { return store.viewerMontageScheme },
                get customMontageMap() { return store.customMontageMap },
                get workspaceMontages() { return store.workspaceMontages },
                get viewerErrors() { return store.viewerErrors }
            }
        },

        dispatch: (action, payload) => {
            switch (action) {
                case 'viewerModule/setChannels':
                    store.setChannels(payload)
                    break
                case 'viewerModule/setViewerErrors':
                    store.setViewerErrors(payload)
                    break
                case 'viewerModule/setViewerMontageScheme':
                    store.setViewerMontageScheme(payload)
                    break
                case 'viewerModule/setActiveViewer':
                    store.setActiveViewer(payload)
                    break
                case 'viewerModule/setWorkspaceMontages':
                    store.setWorkspaceMontages(payload)
                    break
                default:
                    console.warn(`Unknown action: ${action}`)
            }
        }
    }
}