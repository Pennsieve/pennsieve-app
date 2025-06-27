// composables/useTsAnnotation.js

import { computed } from 'vue'
import { useStore } from 'vuex'
import { useSendXhr, useHandleXhrError } from '@/mixins/request/request_composable'
import { useGetToken } from '@/composables/useGetToken'

export function useTsAnnotation() {
    const store = useStore()

    // Computed properties (equivalent to mapState)
    const activeViewer = computed(() => store.state.viewerModule.activeViewer)
    const viewerChannels = computed(() => store.state.viewerModule.viewerChannels)
    const viewerSidePanelOpen = computed(() => store.state.viewerModule.viewerSidePanelOpen)
    const viewerAnnotations = computed(() => store.state.viewerModule.viewerAnnotations)
    const activeAnnotation = computed(() => store.state.viewerModule.activeAnnotation)
    const config = computed(() => store.state.config)

    // Helper function to get channel ID (moved from original component)
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

    // Add annotation function
    const addAnnotation = async () => {
        // Assert that we only call this function on activeAnnotations without an existing ID
        if (activeAnnotation.value.id) {
            throw new TypeError("Trying to create an annotation that already exists", activeAnnotation.value.id)
        }

        let start = activeAnnotation.value.start
        let duration = activeAnnotation.value.duration
        const onAll = activeAnnotation.value.allChannels
        const label = activeAnnotation.value.label
        const description = activeAnnotation.value.description
        const layer_id = activeAnnotation.value.layer_id

        // Correct negative durations
        if (duration < 0) {
            duration = -duration
            start = start - duration
        }

        const onChannels = []
        for (let ch = 0; ch < viewerChannels.value.length; ch++) {
            const curChannelView = viewerChannels.value[ch]
            if ((curChannelView.selected && curChannelView.visible) || onAll) {
                const id = getChannelId(curChannelView)
                onChannels.push(id)
            }
        }

        const XhrBody = {
            name: '',
            channelIds: onChannels,
            label: label,
            description: description,
            layer_id: layer_id,
            start: start,
            end: start + duration
        }

        // Send ADD annotation request to server
        const timeseriesId = activeViewer.value.content.nodeId
        const url = `${config.value.apiUrl}/timeseries/${timeseriesId}/layers/${layer_id}/annotations`

        try {
            const token = await useGetToken()
            const response = await useSendXhr(url, {
                method: 'POST',
                header: {
                    'Authorization': `Bearer ${token}`
                },
                body: XhrBody
            })

            const newAnn = {
                name: '',
                id: response.id,
                label: response.label,
                description: response.description,
                start: response.start,
                duration: response.end - response.start,
                end: response.end,
                cStart: null,
                cEnd: null,
                selected: true,
                channelIds: response.channelIds,
                allChannels: false,
                layer_id: response.layerId,
                userId: response.userId
            }

            if (response.linkedPackage) {
                newAnn.linkedPackage = response.linkedPackage
            }

            // Check if all channels are selected
            if (newAnn.channelIds.length >= viewerChannels.value.length) {
                newAnn.allChannels = true
            }

            // Find layer
            let curLIndex = 0
            for (let i = 0; i < viewerAnnotations.value.length; i++) {
                if (viewerAnnotations.value[i].id === response.layerId) {
                    curLIndex = i
                    break
                }
            }

            await store.dispatch('viewerModule/createAnnotation', newAnn)
            sortAnns(viewerAnnotations.value[curLIndex].annotations)

            return newAnn
        } catch (error) {
            useHandleXhrError(error)
            throw error
        }
    }

    // Update annotation function
    const updateAnnotation = async () => {
        if (!activeAnnotation.value.id) {
            throw new TypeError("Trying to update an annotation that doesn't exist on server", activeAnnotation.value.id)
        }

        let start = activeAnnotation.value.start
        let duration = activeAnnotation.value.duration

        // Correct negative durations
        if (duration < 0) {
            duration = -duration
            start = start - duration
            // Update the active annotation with corrected values
            await store.dispatch('viewerModule/setActiveAnnotation', {
                ...activeAnnotation.value,
                start: start,
                duration: duration,
                end: start + duration
            })
        }

        const annLayerId = activeAnnotation.value.layer_id
        const timeseriesId = activeViewer.value.content.nodeId
        const url = `${config.value.apiUrl}/timeseries/${timeseriesId}/layers/${annLayerId}/annotations/${activeAnnotation.value.id}`

        const XhrBody = {
            name: '',
            channelIds: activeAnnotation.value.channelIds,
            label: activeAnnotation.value.label,
            description: activeAnnotation.value.description,
            layer_id: activeAnnotation.value.layer_id,
            start: start,
            end: start + duration
        }

        try {
            const token = await useGetToken()
            const response = await useSendXhr(url, {
                method: 'PUT',
                header: {
                    'Authorization': `Bearer ${token}`
                },
                body: XhrBody
            })

            await store.dispatch('viewerModule/updateAnnotation', activeAnnotation.value)
            return response
        } catch (error) {
            useHandleXhrError(error)
            throw error
        }
    }

    // Remove annotation function
    const removeAnnotation = async (annotation) => {
        let annLayerId = ''
        // Annotation data structure properties vary depending on if the user
        // is canceling newly created annotation or not
        if (annotation.layer) {
            annLayerId = annotation.layer.id
        } else {
            annLayerId = annotation.layer_id
        }

        const timeseriesId = activeViewer.value.content.nodeId
        const url = `${config.value.apiUrl}/timeseries/${timeseriesId}/layers/${annLayerId}/annotations/${annotation.id}`

        try {
            const token = await useGetToken()
            const response = await useSendXhr(url, {
                method: 'DELETE',
                header: {
                    'Authorization': `Bearer ${token}`
                }
            })

            await store.dispatch('viewerModule/deleteAnnotation', annotation)
            return response
        } catch (error) {
            useHandleXhrError(error)
            throw error
        }
    }

    // Return the public API
    return {
        // Computed properties
        activeViewer,
        viewerChannels,
        viewerSidePanelOpen,
        viewerAnnotations,
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