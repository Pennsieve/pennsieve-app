// composables/useAnnotationLayers.js
import { ref, computed } from 'vue'
import { useViewerStore } from '@/stores/tsviewer'
import { useViewerInstance } from '@/composables/useViewerInstance'
import { useGetToken } from "@/composables/useGetToken"
import { useHandleXhrError, useSendXhr } from "@/mixins/request/request_composable"
import EventBus from '@/utils/event-bus'
import { hexToRgbA } from '@/utils/annotationUtils'

export function useAnnotationLayers() {
    const viewerStore = useViewerStore()
    // Use library's viewer controls for annotation state
    const viewerControls = useViewerInstance()

    const annLayerInfo = ref([])
    const defaultColors = ref([
        '#18BA62', '#FFBC27', '#E94B4B', '#0D4EFF', '#FF4FFF', '#50FFFF', '#FFFF4E', '#512BAF',
        '#8A6ECF', '#389BAD', '#187D46', '#B12800', '#0C2475', '#FF5321', '#FF99CC', '#DCC180',
        '#FF6C21', '#000000', '#9B9B9B', '#00FF00', '#FA8072', '#808000', '#A0522D', '#2760FF'
    ])

    const config = computed(() => viewerStore.config)

    const initializeLayers = async (response, activeViewerResourceId, emit) => {
        const annLayers = []

        // If no layers exist, create a default layer
        if (response.results.length === 0) {
            const payload = {
                name: 'Default',
                color: '#18BA62',
                description: 'Default Annotation Layer'
            }
            await createAnnotationLayer(payload, activeViewerResourceId, emit)
        } else {
            // Process existing layers
            for (let i = 0; i < response.results.length; i++) {
                const result = response.results[i]
                let layerColor = result.color || defaultColors.value[i % defaultColors.value.length]

                const layer = {
                    id: result.id,
                    name: result.name,
                    description: result.description,
                    visible: true,
                    selected: i === 0, // First layer is selected by default
                    annotations: [],
                    color: hexToRgbA(layerColor, 0.7),
                    hexColor: layerColor,
                    bkColor: hexToRgbA(layerColor, 0.15),
                    selColor: hexToRgbA(layerColor, 0.9)
                }

                annLayers.push(layer)
            }

            viewerStore.setAnnotations(annLayers)
            emit('annLayersInitialized')
        }

        annLayerInfo.value = response.results
    }

    const createAnnotationLayer = async (newLayer, activeViewerResourceId, emit) => {
        try {
            const token = await useGetToken()
            const url = `${config.value.apiUrl}/timeseries/${activeViewerResourceId}/layers?api_key=${token}`

            const response = await useSendXhr(url, {
                method: "POST",
                body: {
                    name: newLayer.name,
                    color: newLayer.color,
                    description: newLayer.description || newLayer.name
                }
            })

            // Process the created layer
            const layer = {
                ...response,
                annotations: [],
                hexColor: response.color,
                color: hexToRgbA(response.color, 0.7),
                bkColor: hexToRgbA(response.color, 0.15),
                selColor: hexToRgbA(response.color, 0.9),
                visible: true,
                selected: true
            }

            viewerStore.createLayer(layer)
            viewerStore.setActiveAnnotationLayer(layer.id)

            // Sync to library store so TSViewer sees the new layer
            if (viewerControls.createLayer) {
                viewerControls.createLayer(JSON.parse(JSON.stringify(layer)))
            }
            if (viewerControls.setActiveLayer) {
                viewerControls.setActiveLayer(layer.id)
            }

            EventBus.$emit('toast', {
                detail: {
                    msg: `'${layer.name}' Layer Created`
                }
            })

            return layer
        } catch (error) {
            useHandleXhrError(error)
            return null
        } finally {
            if (emit) {
                emit('closeAnnotationLayerWindow')
            }
        }
    }

    const updateLayerVisibility = (layerId, visible) => {
        // Use library's annotations from viewerControls
        const annotations = viewerControls.annotations?.value || []
        const layer = annotations.find(l => l.id === layerId)

        if (layer) {
            layer.visible = visible
            viewerControls.triggerRerender('layer-visibility')
        }
    }

    const selectLayer = (layerId) => {
        // Use library's annotations from viewerControls
        const annotations = viewerControls.annotations?.value || []

        // Deselect all layers
        annotations.forEach(layer => {
            layer.selected = false
        })

        // Select the target layer
        const layer = annotations.find(l => l.id === layerId)
        if (layer) {
            layer.selected = true
            // Use library's setActiveLayer if available
            if (viewerControls.setActiveLayer) {
                viewerControls.setActiveLayer(layerId)
            }
        }
    }

    const deleteLayer = async (layerId, activeViewer) => {
        try {
            const token = await useGetToken()
            const url = `${config.value.apiUrl}/timeseries/${activeViewer.content.id}/layers/${layerId}?api_key=${token}`

            await useSendXhr(url, { method: "DELETE" })

            // Remove from store
            viewerStore.removeLayer(layerId)

            // Sync to library store
            if (viewerControls.deleteLayer) {
                viewerControls.deleteLayer({ id: layerId })
            }

            EventBus.$emit('toast', {
                detail: {
                    msg: 'Layer deleted successfully'
                }
            })
        } catch (error) {
            useHandleXhrError(error)
            throw error
        }
    }

    const updateLayerColor = async (layerId, newColor, activeViewer) => {
        try {
            const token = await useGetToken()
            const url = `${config.value.apiUrl}/timeseries/${activeViewer.content.id}/layers/${layerId}?api_key=${token}`

            const response = await useSendXhr(url, {
                method: "PUT",
                body: { color: newColor }
            })

            // Update in store
            const layer = viewerStore.viewerAnnotations.find(l => l.id === layerId)
            if (layer) {
                layer.hexColor = newColor
                layer.color = hexToRgbA(newColor, 0.7)
                layer.bkColor = hexToRgbA(newColor, 0.15)
                layer.selColor = hexToRgbA(newColor, 0.9)
                viewerStore.updateLayer(layer)

                // Sync to library store
                if (viewerControls.updateLayer) {
                    viewerControls.updateLayer(JSON.parse(JSON.stringify(layer)))
                }
            }

            return response
        } catch (error) {
            useHandleXhrError(error)
            throw error
        }
    }

    const loadLayers = async (activeViewer, emit) => {
        try {
            const token = await useGetToken()
            const url = `${config.value.apiUrl}/timeseries/${activeViewer.content.id}/layers?api_key=${token}`
            const response = await useSendXhr(url)
            await initializeLayers(response, activeViewer.content.id, emit)
            return response
        } catch (error) {
            useHandleXhrError(error)
            throw error
        }
    }

    return {
        annLayerInfo,
        defaultColors,
        initializeLayers,
        createAnnotationLayer,
        updateLayerVisibility,
        selectLayer,
        deleteLayer,
        updateLayerColor,
        loadLayers
    }
}