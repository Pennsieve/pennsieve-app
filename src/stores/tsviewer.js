// @/stores/tsviewer.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as site from "@/site-config/site.json";
import {useGetToken} from "@/composables/useGetToken";
import toQueryParams from "@/utils/toQueryParams";
import { propOr, propEq, findIndex } from 'ramda'

import vuexStore from '../store/index'  // Assuming your Vuex store is exported from vuexStore.js

export const useViewerStore = defineStore('tsviewer', () => {

    const config = site
    const viewerChannels = ref([])
    const viewerMontageScheme = ref('NOT_MONTAGED')
    const customMontageMap = ref({})
    const workspaceMontages = ref([])
    const viewerErrors = ref(null)
    const needsRerender = ref(null)

    // Annotation-related state
    const viewerAnnotations = ref([])
    const activeAnnotationLayer = ref({})
    const activeAnnotation = ref({})
    const viewerActiveTool = ref('POINTER')

    // Getters (from original Vuex getters)
    const getMontageMessageByName = computed(() => {
        return (name) => {
            return workspaceMontages.value.find(montage => montage.name === name)
        }
    })

    const viewerSelectedChannels = computed(() => {
        return viewerChannels.value.filter(channel => channel.selected)
    })

    const getViewerActiveLayer = computed(() => {
        return () => {
            const activeLayer = viewerAnnotations.value.find(annotation => annotation.selected)
            if (!activeLayer) {
                console.warn('No active layer found, available layers:', viewerAnnotations.value)
                // Return the first layer if no layer is selected
                return viewerAnnotations.value.length > 0 ? viewerAnnotations.value[0] : null
            }
            return activeLayer
        }
    })

    const validateAnnotationLayers = () => {
        let hasErrors = false

        viewerAnnotations.value.forEach((layer, index) => {
            if (!layer.id && layer.id !== 0) {
                console.error(`Layer at index ${index} missing ID:`, layer)
                hasErrors = true
            }

            if (!layer.annotations) {
                console.warn(`Layer at index ${index} missing annotations array:`, layer)
                layer.annotations = []
            }
        })

        if (hasErrors) {
            console.error('Annotation layer validation failed. Layers:', viewerAnnotations.value)
        }

        return !hasErrors
    }

    const getAnnotationById = computed(() => {
        return (id) => {
            const allAnnotations = viewerAnnotations.value.flatMap(layer => layer.annotations || [])
            return allAnnotations.find(annotation => annotation.id === id)
        }
    })

    // Actions
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
        if(!montages) {
          workspaceMontages.value = []
        } else {
          workspaceMontages.value = montages
        }
    }

    const setViewerErrors = (errors) => {
        viewerErrors.value = errors
    }


    const setNeedsRerender = (renderData) => {
        needsRerender.value = renderData
    }

    // Add annotation-related actions
    const setAnnotations = (annotations) => {
        // FIX: Validate annotation structure before setting
        const validatedAnnotations = annotations.map(annotation => {
            // Ensure each annotation has required properties
            if (!annotation.id && annotation.id !== 0) {
                console.warn('Annotation layer missing ID:', annotation)
                // Generate a temporary ID if missing
                annotation.id = Math.random().toString(36).substr(2, 9)
            }

            // Ensure annotations array exists
            if (!annotation.annotations) {
                annotation.annotations = []
            }

            // Ensure other required properties exist
            if (!annotation.name) {
                annotation.name = `Layer ${annotation.id}`
            }

            return annotation
        })

        viewerAnnotations.value = validatedAnnotations
        console.log('Set annotations with validated structure:', validatedAnnotations)
    }

    const setActiveAnnotationLayer = (layerId) => {
        if (!layerId && layerId !== 0) {
            console.error('setActiveAnnotationLayer called with invalid layerId:', layerId)
            return
        }

        activeAnnotationLayer.value = layerId

        // Clear all selected flags first
        viewerAnnotations.value.forEach(annotation => annotation.selected = false)

        // Find and select the target layer
        const layerIndex = findIndex(propEq('id', layerId), viewerAnnotations.value)
        if (layerIndex >= 0) {
            viewerAnnotations.value[layerIndex].selected = true
            console.log('Successfully set active layer:', viewerAnnotations.value[layerIndex])
        } else {
            console.error('Layer with ID not found:', layerId, 'Available layers:', viewerAnnotations.value)
        }
    }

    const setActiveAnnotation = (annotation) => {
        // Clear all selected annotations
        viewerAnnotations.value.forEach(layer =>
            layer.annotations?.forEach(ann => ann.selected = false)
        )

        // Set the new active annotation as selected if it has an ID
        if (annotation.id) {
            const layerIndex = findIndex(propEq('id', annotation.layer_id), viewerAnnotations.value)
            if (layerIndex >= 0) {
                const annotationIndex = findIndex(propEq('id', annotation.id), viewerAnnotations.value[layerIndex].annotations)
                if (annotationIndex >= 0) {
                    viewerAnnotations.value[layerIndex].annotations[annotationIndex].selected = true
                }
            }
        }

        activeAnnotation.value = annotation
    }

    const setActiveTool = (tool) => {
        viewerActiveTool.value = tool
    }

    const createLayer = (layer) => {
        // FIX: Validate layer structure before creating
        if (!layer.id && layer.id !== 0) {
            console.error('Cannot create layer without ID:', layer)
            return
        }

        // Ensure the layer has required properties
        const validatedLayer = {
            id: layer.id,
            name: layer.name || `Layer ${layer.id}`,
            description: layer.description || '',
            visible: layer.visible !== undefined ? layer.visible : true,
            selected: layer.selected || false,
            annotations: layer.annotations || [],
            color: layer.color,
            hexColor: layer.hexColor,
            bkColor: layer.bkColor,
            selColor: layer.selColor,
            userId: layer.userId,
            ...layer // Spread any additional properties
        }

        viewerAnnotations.value.push(validatedLayer)
        console.log('Created layer with validated structure:', validatedLayer)
    }


    const updateLayer = (layerData) => {
        const index = findIndex(propEq('id', layerData.id), viewerAnnotations.value)
        if (index >= 0) {
            const updatedLayer = Object.assign(viewerAnnotations.value[index], layerData)
            viewerAnnotations.value[index] = updatedLayer
        }
    }

    const deleteLayer = (layerData) => {
        const index = findIndex(propEq('id', layerData.id), viewerAnnotations.value)
        if (index >= 0) {
            viewerAnnotations.value.splice(index, 1)
        }
    }

    const createAnnotation = (annotation) => {
        const layerIndex = findIndex(propEq('id', annotation.layer_id), viewerAnnotations.value)
        if (layerIndex >= 0) {
            if (!viewerAnnotations.value[layerIndex].annotations) {
                viewerAnnotations.value[layerIndex].annotations = []
            }
            viewerAnnotations.value[layerIndex].annotations.push(annotation)
            setActiveAnnotation(annotation)
        }
    }

    const updateAnnotation = (annotation) => {
        const layerIndex = findIndex(propEq('id', annotation.layer_id), viewerAnnotations.value)
        if (layerIndex >= 0) {
            const annotations = viewerAnnotations.value[layerIndex].annotations
            const annotationIndex = findIndex(propEq('id', annotation.id), annotations)
            if (annotationIndex >= 0) {
                annotations[annotationIndex] = annotation
            }
        }
    }

    const deleteAnnotation = (annotation) => {
        const layerIndex = findIndex(propEq('id', annotation.layer_id), viewerAnnotations.value)
        if (layerIndex >= 0) {
            const annotations = viewerAnnotations.value[layerIndex].annotations
            const annotationIndex = findIndex(propEq('id', annotation.id), annotations)
            if (annotationIndex >= 0) {
                annotations.splice(annotationIndex, 1)
            }
        }
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
        viewerAnnotations.value = []
        activeAnnotationLayer.value = {}
        activeAnnotation.value = {}
        viewerActiveTool.value = 'POINTER'
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
        needsRerender,
        viewerAnnotations,
        activeAnnotationLayer,
        activeAnnotation,
        viewerActiveTool,
        config,

        // Getters
        getMontageMessageByName,
        viewerSelectedChannels,
        getViewerActiveLayer,
        getAnnotationById,

        // Actions
        setChannels,
        setViewerMontageScheme,
        setCustomMontageMap,
        setWorkspaceMontages,
        setViewerErrors,
        setAnnotations,
        setActiveAnnotationLayer,
        setActiveAnnotation,
        setActiveTool,
        createLayer,
        updateLayer,
        deleteLayer,
        createAnnotation,
        updateAnnotation,
        deleteAnnotation,
        updateChannelProperty,
        updateChannelVisibility,
        updateChannelSelection,
        updateChannelFilter,
        validateAnnotationLayers,
        resetViewer,
        fetchWorkspaceMontages,
        triggerRerender,
        resetRerenderTrigger
    }
})