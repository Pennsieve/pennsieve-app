// composables/useAnnotationData.js
import { ref, computed } from 'vue'
import { useViewerStore } from '@/stores/tsviewer'
import { storeToRefs } from 'pinia'
import { useGetToken } from "@/composables/useGetToken"
import { useHandleXhrError, useSendXhr } from "@/mixins/request/request_composable"
import { pathOr, propOr, find, propEq, defaultTo, head } from 'ramda'
import { sortAnnotations, annIndexOf } from '@/utils/annotationUtils'

export function useAnnotationData() {
    const viewerStore = useViewerStore()
    const { viewerChannels, viewerAnnotations, viewerMontageScheme } = storeToRefs(viewerStore)

    // Reactive state
    const cachedAnnRange = ref([])
    const annLayerInfo = ref([])

    const config = computed(() => viewerStore.config)

    const getChannelId = (channel) => {
        const isViewingMontage = viewerMontageScheme.value !== 'NOT_MONTAGED'
        let id = propOr('', 'id', channel)
        if (isViewingMontage) {
            const list = id.split('_')
            id = list.length ? head(list) : id
        }
        return id
    }

    const checkAnnotationRange = async (RStart, REnd, props, activeViewer, emit) => {
        const reqRange = []
        reqRange.push({ start: RStart, end: props.tsEnd })

        // Check if viewport is cached
        let firstIndex = 0
        for (let i = 0; i < cachedAnnRange.value.length; i++) {
            const curBlock = cachedAnnRange.value[i]
            if (RStart >= curBlock.start && REnd <= curBlock.end) {
                return // annotations in current viewport are cached
            } else if (reqRange[0].start > REnd) {
                break
            } else if (curBlock.start <= reqRange[0].start && curBlock.end >= RStart) {
                firstIndex = i + 1
                reqRange[0].start = curBlock.end
            } else if (curBlock.start > reqRange[0].start) {
                firstIndex = i
                break
            }
        }

        // Check if layers have annotations
        const annotationsTotal = viewerAnnotations.value.reduce((acc, li) => acc + li.annotations.length, 0)

        // If all in memory, return
        if (reqRange[0].start >= reqRange[0].end && annotationsTotal > 0) {
            return
        }

        // Find ranges to request
        const curRequestIndex = 0
        for (let i = firstIndex; i < cachedAnnRange.value.length; i++) {
            if (cachedAnnRange.value[i].start >= reqRange[curRequestIndex].start) {
                reqRange[curRequestIndex].end = cachedAnnRange.value[i].start
                if (cachedAnnRange.value[i].end < REnd) {
                    reqRange.push({ start: cachedAnnRange.value[i].end, end: props.tsEnd })
                } else {
                    break
                }
            }
        }

        if (reqRange[0].start >= reqRange[0].end && annotationsTotal > 0) {
            return
        }

        // Request annotations from server
        if (reqRange.length > 0) {
            const channelIds = viewerChannels.value.map(channel => getChannelId(channel))

            for (const curRange of reqRange) {
                for (const curLayer of viewerAnnotations.value) {
                    if (!curLayer.id) {
                        console.warn('Layer ID is undefined, skipping annotation request for layer:', curLayer)
                        continue
                    }

                    const endTime = Math.floor(curRange.end)
                    const params = {
                        id: activeViewer.content.id,
                        start: Math.floor(curRange.start),
                        end: endTime,
                        layerId: curLayer.id,
                        limit: props.constants.LIMITANNFETCH
                    }

                    try {
                        const token = await useGetToken()
                        const apiUrl = config.value.apiUrl
                        const baseUrl = `${apiUrl}/timeseries/${activeViewer.content.id}/layers/${curLayer.id}/annotations?api_key=${token}`
                        const urlParams = Object.keys(params).map(k => `&${k}=${params[k]}`).join('')
                        const url = `${baseUrl}${urlParams}`

                        const response = await fetch(url, {
                            method: 'GET',
                            headers: { 'Content-type': 'application/json' }
                        })

                        if (response.status >= 400) {
                            throw new Error(response.status)
                        }

                        const data = await response.json()
                        await processAnnotationResponse(data, emit)
                    } catch (err) {
                        useHandleXhrError(err)
                    }
                }
                cachedAnnRange.value.push({
                    start: Math.floor(curRange.start),
                    end: Math.floor(curRange.end)
                })
            }

            // Sort cached ranges
            cachedAnnRange.value.sort((a, b) => {
                if (a.start < b.start) return -1
                if (a.start > b.start) return 1
                return 0
            })
        }
    }

    const processAnnotationResponse = async (response, emit) => {
        const linkedPackages = propOr({}, 'linkedPackages', response)
        let resp = pathOr([], ['annotations', 'results'], response)

        // Handle pagination limit
        if (resp.length >= 500) {
            let maxStart = 0
            for (const annotation of resp) {
                if (annotation.start > maxStart) {
                    maxStart = annotation.start
                }
            }

            for (const range of cachedAnnRange.value) {
                if (range.end > maxStart && range.start < maxStart) {
                    range.end = maxStart
                    break
                }
            }
        }

        const isViewingMontage = viewerMontageScheme.value !== 'NOT_MONTAGED'

        if (resp.length > 0) {
            const annotations = resp.map(curAnn => {
                const newAnn = {
                    name: '',
                    id: curAnn.id,
                    label: curAnn.label,
                    description: curAnn.description,
                    start: curAnn.start,
                    duration: curAnn.end - curAnn.start,
                    end: curAnn.end,
                    cStart: null,
                    cEnd: null,
                    selected: false,
                    channelIds: curAnn.channelIds,
                    allChannels: false,
                    layer_id: curAnn.layerId,
                    userId: curAnn.userId
                }

                if (curAnn.linkedPackage) {
                    const pkgId = curAnn.linkedPackage
                    newAnn.linkedPackage = pathOr('', ['content', 'id'], linkedPackages[pkgId])
                    newAnn.linkedPackageDTO = linkedPackages[pkgId]
                }

                // Check if all channels are selected
                if (!isViewingMontage && newAnn.channelIds.length === viewerChannels.value.length) {
                    newAnn.allChannels = true
                } else if (isViewingMontage && newAnn.channelIds.length > viewerChannels.value.length) {
                    newAnn.allChannels = true
                }

                return newAnn
            })

            // Update layers with new annotations
            viewerAnnotations.value.forEach(layer => {
                const layerAnns = layer.annotations
                const filteredAnns = annotations.filter(ann => layer.id === ann.layer_id)
                layer.annotations = layerAnns.concat(filteredAnns)
                viewerStore.updateLayer(layer)
            })
        }

        emit('annotationsReceived')
    }

    const findNextAnnotation = (curTime) => {
        const annLayer = viewerStore.getViewerActiveLayer()
        const index = annIndexOf(annLayer.annotations, curTime, false)

        if (index < annLayer.annotations.length) {
            if (annLayer.annotations[index].start > curTime) {
                return annLayer.annotations[index]
            }
            return annLayer.annotations[index + 1] || annLayer.annotations[index]
        }
        return annLayer.annotations[index]
    }

    const findPreviousAnnotation = (curTime) => {
        const annLayer = viewerStore.getViewerActiveLayer()
        const index = annIndexOf(annLayer.annotations, curTime, true)

        if (annLayer.annotations[index].start < curTime) {
            return annLayer.annotations[index]
        }

        if (index > 0) {
            return annLayer.annotations[index - 1]
        }
        return annLayer.annotations[index]
    }

    return {
        cachedAnnRange,
        annLayerInfo,
        checkAnnotationRange,
        findNextAnnotation,
        findPreviousAnnotation,
        getChannelId
    }
}