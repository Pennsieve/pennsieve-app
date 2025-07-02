// composables/useTsAnnotation.js - Updated to use Pinia store

import { computed } from 'vue'
import { useStore } from 'vuex'
import { storeToRefs } from 'pinia'
import { useSendXhr, useHandleXhrError } from '@/mixins/request/request_composable'
import { useGetToken } from '@/composables/useGetToken'
import { useViewerStore } from '@/stores/tsviewer' // Import Pinia store

export function useTsAnnotation() {
    const store = useStore() // Keep Vuex for other state
    const viewerStore = useViewerStore() // Add Pinia store
    const { viewerChannels, viewerAnnotations } = storeToRefs(viewerStore) // Get reactive refs

    // Computed properties - Mix of Vuex and Pinia
    const activeViewer = computed(() => store.state.viewerModule.activeViewer)
    const viewerSidePanelOpen = computed(() => store.state.viewerModule.viewerSidePanelOpen)
    const activeAnnotation = computed(() => store.state.viewerModule.activeAnnotation)
    const config = computed(() => store.state.config)

    // Use Pinia for these:
    // viewerChannels - now from Pinia via storeToRefs
    // viewerAnnotations - now from Pinia via storeToRefs

    // Helper function to get channel ID
    const getChannelId = (channel) => {
        const isViewingMontage = store.state.viewerModule.viewerMontageScheme !== 'NOT_MONTAGED'
        let id = channel.id || ''
        let list = []
        if (isViewingMontage) {
            list = id.split('_')
            id = list.length ? list[0] : id // remove channel name from id
        }
        return id
    }

    // Sort annotations helper
    const sortAnns = (annArray) => {
        annArray.sort(function Comparator(a, b) {
            if (a.start < b.start) return -1
            if (a.start > b.start) return 1
            return 0
        })
    }

    // Add annotation function with Pinia store usage
    const addAnnotation = async (annotation = null) => {
        // Use passed annotation or fall back to store
        const annotationData = annotation || activeAnnotation.value

        console.log('🔧 useTsAnnotation: addAnnotation called with:', annotationData)

        // Validate annotation data
        if (!annotationData || !annotationData.layer_id) {
            throw new TypeError("Missing annotation data or layer_id", annotationData)
        }

        // Assert that we only call this function on annotations without an existing ID
        if (annotationData.id) {
            throw new TypeError("Trying to create an annotation that already exists", annotationData.id)
        }

        let start = annotationData.start
        let duration = annotationData.duration || (annotationData.end - annotationData.start)
        const label = annotationData.label
        const description = annotationData.description
        const layer_id = annotationData.layer_id

        // Validate required fields
        if (!label) {
            throw new Error("Annotation label is required")
        }
        if (start === undefined || start === null) {
            throw new Error("Annotation start time is required")
        }

        // Correct negative durations
        if (duration < 0) {
            duration = -duration
            start = start - duration
        }

        // FIX: Use Pinia store for channelIds logic
        let channelIds = []

        console.log('🔧 useTsAnnotation: Processing channelIds...', {
            hasChannelIds: annotationData.channelIds && Array.isArray(annotationData.channelIds),
            allChannels: annotationData.allChannels,
            providedChannelIds: annotationData.channelIds,
            availableChannels: viewerChannels.value.length // Now from Pinia
        })

        if (annotationData.allChannels) {
            // When allChannels is true, include all channels (even if they are currently not visible)
            console.log('🔧 useTsAnnotation: allChannels=true, adding all visible channels')
            const allChannels = activeViewer.value.channels
            for (let ch = 0; ch < allChannels.length; ch++) {
                const curChannel = allChannels[ch] // Now from Pinia
                const id = curChannel.content.id
                channelIds.push(id)
                console.log('🔧 useTsAnnotation: Added channel ID:', id)
            }
        } else if (annotationData.channelIds && Array.isArray(annotationData.channelIds) && annotationData.channelIds.length > 0) {
            // Use provided channelIds if they exist and are not empty
            channelIds = annotationData.channelIds
            console.log('🔧 useTsAnnotation: Using provided channelIds:', channelIds)
        } else {
            // Fallback: compute from selected channels
            console.log('🔧 useTsAnnotation: Computing from selected channels')
            for (let ch = 0; ch < viewerChannels.value.length; ch++) {
                const curChannelView = viewerChannels.value[ch] // Now from Pinia
                if (curChannelView.selected && curChannelView.visible) {
                    const id = getChannelId(curChannelView)
                    channelIds.push(id)
                    console.log('🔧 useTsAnnotation: Added selected channel ID:', id)
                }
            }
        }

        console.log('🔧 useTsAnnotation: Final channelIds:', channelIds)

        // Create API payload that matches server expectations
        const apiPayload = {
            label: label,
            name: label,
            description: description || '',
            start: Math.floor(start),
            end: Math.floor(start + duration),
            channelIds: channelIds
        }

        console.log('🔧 useTsAnnotation: API payload:', apiPayload)

        // Use correct property for timeseries ID
        const timeseriesId = activeViewer.value.content.id
        const url = `${config.value.apiUrl}/timeseries/${timeseriesId}/layers/${layer_id}/annotations`

        console.log('🔧 useTsAnnotation: API URL:', url)

        try {
            // Use useGetToken() directly
            const token = await useGetToken()

            const response = await fetch(`${url}?api_key=${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(apiPayload)
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`HTTP ${response.status}: ${errorText}`)
            }

            const result = await response.json()
            console.log('🔧 useTsAnnotation: API success:', result)

            const newAnn = {
                name: '',
                id: result.id,
                label: result.label,
                description: result.description,
                start: result.start,
                duration: result.end - result.start,
                end: result.end,
                cStart: null,
                cEnd: null,
                selected: true,
                channelIds: result.channelIds || channelIds,
                allChannels: channelIds.length === 0 || channelIds.length >= viewerChannels.value.length, // Use Pinia
                layer_id: layer_id,
                userId: result.userId
            }

            if (result.linkedPackage) {
                newAnn.linkedPackage = result.linkedPackage
            }

            // Find layer and add annotation - Use Pinia store
            let curLIndex = 0
            for (let i = 0; i < viewerAnnotations.value.length; i++) {
                if (viewerAnnotations.value[i].id === layer_id) {
                    curLIndex = i
                    break
                }
            }

            // Use Pinia store methods
            viewerStore.createAnnotation(newAnn)
            if (viewerAnnotations.value[curLIndex] && viewerAnnotations.value[curLIndex].annotations) {
                sortAnns(viewerAnnotations.value[curLIndex].annotations)
            }

            return newAnn
        } catch (error) {
            console.error('🔧 useTsAnnotation: Error creating annotation:', error)
            useHandleXhrError(error)
            throw error
        }
    }

    // Update annotation function with Pinia store usage
    const updateAnnotation = async (annotation = null) => {
        // Use passed annotation or fall back to store
        const annotationData = annotation || activeAnnotation.value

        console.log('🔧 useTsAnnotation: updateAnnotation called with:', annotationData)

        if (!annotationData.id) {
            throw new TypeError("Trying to update an annotation that doesn't exist on server", annotationData.id)
        }

        if (!annotationData.layer_id) {
            throw new TypeError("Missing layer_id for annotation update", annotationData)
        }

        let start = annotationData.start
        let duration = annotationData.duration || (annotationData.end - annotationData.start)

        // Correct negative durations
        if (duration < 0) {
            duration = -duration
            start = start - duration
        }

        // Create API payload that matches server expectations
        const apiPayload = {
            label: annotationData.label,
            description: annotationData.description || '',
            start: Math.floor(start),
            end: Math.floor(start + duration),
            channelIds: annotationData.channelIds || []
        }

        console.log('🔧 useTsAnnotation: Update API payload:', apiPayload)

        const timeseriesId = activeViewer.value.content.id
        const url = `${config.value.apiUrl}/timeseries/${timeseriesId}/layers/${annotationData.layer_id}/annotations/${annotationData.id}`

        console.log('🔧 useTsAnnotation: Update API URL:', url)

        try {
            const token = await useGetToken()

            const response = await fetch(`${url}?api_key=${token}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(apiPayload)
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`HTTP ${response.status}: ${errorText}`)
            }

            const result = await response.json()
            console.log('🔧 useTsAnnotation: Update API success:', result)

            // Update the annotation with server response
            const updatedAnnotation = {
                ...annotationData,
                ...result,
                duration: result.end - result.start
            }

            // Use Pinia store method
            viewerStore.updateAnnotation(updatedAnnotation)
            return result
        } catch (error) {
            console.error('🔧 useTsAnnotation: Error updating annotation:', error)
            useHandleXhrError(error)
            throw error
        }
    }

    // Remove annotation function with Pinia store usage
    const removeAnnotation = async (annotation) => {
        if (!annotation || !annotation.id) {
            throw new TypeError("Invalid annotation for deletion", annotation)
        }

        let annLayerId = ''
        if (annotation.layer) {
            annLayerId = annotation.layer.id
        } else {
            annLayerId = annotation.layer_id
        }

        if (!annLayerId) {
            throw new TypeError("Missing layer_id for annotation deletion", annotation)
        }

        const timeseriesId = activeViewer.value.content.id
        const url = `${config.value.apiUrl}/timeseries/${timeseriesId}/layers/${annLayerId}/annotations/${annotation.id}`

        console.log('🔧 useTsAnnotation: Delete API URL:', url)

        try {
            const token = await useGetToken()

            const response = await fetch(`${url}?api_key=${token}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json'
                }
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`HTTP ${response.status}: ${errorText}`)
            }

            console.log('🔧 useTsAnnotation: Delete API success')

            // Use Pinia store method
            viewerStore.deleteAnnotation(annotation)
            return true
        } catch (error) {
            console.error('🔧 useTsAnnotation: Error deleting annotation:', error)
            useHandleXhrError(error)
            throw error
        }
    }

    // Return the public API
    return {
        // Computed properties
        activeViewer,
        viewerChannels, // Now from Pinia
        viewerSidePanelOpen,
        viewerAnnotations, // Now from Pinia
        activeAnnotation,
        config,

        // Methods
        addAnnotation,
        updateAnnotation,
        removeAnnotation,
        sortAnns,
        getChannelId
    }
}