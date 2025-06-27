// @/composables/useDataRequests.js
import { ref, onUnmounted, readonly } from 'vue'

export const useDataRequests = () => {
    // State from original
    const aSyncRequests = ref([])
    const aSyncPreRequests = ref([])
    const prefetchTimer = ref(null)
    const isPrefetching = ref(false)
    const lastViewPageRequest = ref(null)

    // Persistent state for viewport tracking (from original)
    const prevStart = ref(0)
    const prevDuration = ref(0)

    // Prefetch function from original
    let preFetchRequestFnc = null

    const initializePrefetch = (requestDataFromServer, requestedPagesRef) => {
        preFetchRequestFnc = function() {
            const nrPending = aSyncPreRequests.value.length
            if (nrPending > 0) {
                // ✅ More lenient prefetch blocking for montaged channels
                const maxPendingPages = 5 // Increased from 3
                const currentPendingSize = requestedPagesRef.value?.size || 0

                // console.log('🔍 Prefetch check:', {
                //     pendingRequests: nrPending,
                //     currentPendingPages: currentPendingSize,
                //     maxAllowed: maxPendingPages,
                //     nextRequest: aSyncPreRequests.value[0]
                // })

                if (currentPendingSize < maxPendingPages) {
                    // console.log('🚀 Starting prefetch request:', {
                    //     start: aSyncPreRequests.value[0].start,
                    //     channels: aSyncPreRequests.value[0].channels.map(ch => ({
                    //         id: ch.id,
                    //         serverId: ch.serverId,
                    //         label: ch.label
                    //     }))
                    // })

                    const success = requestDataFromServer([aSyncPreRequests.value[0]])
                    if (success) {
                        aSyncPreRequests.value.splice(0, 1)
                    } else {
                        console.warn('❌ Prefetch request failed')
                        // Stop prefetching if requests are failing
                        clearInterval(prefetchTimer.value)
                        isPrefetching.value = false
                    }
                } else {
                    console.log('🚫 Prefetch blocked - too many pending pages:', {
                        current: currentPendingSize,
                        max: maxPendingPages,
                        pendingPageStarts: Array.from(requestedPagesRef.value?.keys() || [])
                    })
                }
            } else {
                console.log('✅ No more prefetch requests, stopping prefetch timer')
                clearInterval(prefetchTimer.value)
                isPrefetching.value = false
            }
        }
    }

    // Generate points (from original requestData logic)
    const generatePoints = (showChannels, start, duration, viewData, requestedPages, constants, rsPeriod, ts_end, segmIndexOf, getChannelIdFn) => {
        viewData.start = start
        viewData.duration = duration

        // Get IDS from viewData channels
        const viewDataChIds = []
        for (let i = 0; i < viewData.channels.length; i++) {
            const channelId = getChannelIdFn ? getChannelIdFn(viewData.channels[i]) : viewData.channels[i].id
            viewDataChIds.push(channelId)
        }

        // Get viewDataChannels
        for (let i = 0; i < showChannels.length; i++) {
            const curShowChannel = showChannels[i]
            const showChannelId = getChannelIdFn ? getChannelIdFn(curShowChannel) : curShowChannel.id
            const idx = viewDataChIds.indexOf(showChannelId)
            if (idx < 0) {
                viewData.channels.push({
                    id: showChannelId,
                    mean: null,
                    firstRenderedIndex: 0,
                    lastRenderedIndex: 0,
                    blocks: []
                })
            }
        }

        return requestData(showChannels, start, duration, viewData, requestedPages, constants, rsPeriod, ts_end, segmIndexOf, getChannelIdFn)
    }

    // Request data (from original)
    const requestData = (showChannels, start, duration, viewData, requestedPages, constants, rsPeriod, ts_end, segmIndexOf, getChannelIdFn) => {
        const pageSize = 15000000

        // Init async requests for viewport pages
        aSyncRequests.value = []

        // If we rerender the same viewport --> don't change prefetch
        let updatePrefetchPages = false
        if (prevStart.value !== start || prevDuration.value !== duration) {
            aSyncPreRequests.value = []
            updatePrefetchPages = true
        }

        // Update previous values for next comparison
        prevStart.value = start
        prevDuration.value = duration

        // Timestamp of first value in viewport
        const viewDataChIds = []
        for (let i = 0; i < viewData.channels.length; i++) {
            viewDataChIds.push(viewData.channels[i])
        }

        // Iterate over channels and populate aSyncRequests
        for (let iChan = 0; iChan < showChannels.length; iChan++) {
            let continuationSegment = false
            const curChan = showChannels[iChan]
            const chDataSegments = curChan.segments
            const curChanId = getChannelIdFn ? getChannelIdFn(curChan) : curChan.id

            // Get dataView - find the channel in viewData
            const idx = viewDataChIds.findIndex(ch => {
                const chId = getChannelIdFn ? getChannelIdFn(ch) : ch.id
                return chId === curChanId
            })

            if (idx === -1) {
                continue // Skip this channel if not found in viewData
            }

            const chanViewData = viewData.channels[idx]
            if (!chanViewData) {
                continue // Skip if channel data not found
            }
            chanViewData.blocks = []

            // Populate chanViewData until all data in scope is added
            let curTime = Math.floor(start / pageSize) * pageSize
            if (curTime < 0) {
                curTime = 0
            }

            let firstSegment = 0
            let segmOffset = 0
            if (chDataSegments.length > 0) {
                firstSegment = segmIndexOf(chDataSegments, curTime, true, 0)
            }

            // Iterate over blocks in viewport
            let endRequestTime = start + duration + constants.PREFETCHPAGES * pageSize
            if (endRequestTime > ts_end) {
                endRequestTime = ts_end
            }

            let curSegm
            if (chDataSegments.length > 0) {
                curSegm = chDataSegments[firstSegment]
            }

            while ((curTime < endRequestTime) || continuationSegment) {
                continuationSegment = false

                // Check if current time matches cached page
                let inRange = false
                if (curSegm) {
                    inRange = curTime >= curSegm.pageStart && curTime <= curSegm.pageEnd
                }

                if (inRange) {
                    // Data is already cached
                    let isViewPage = curSegm.startTs < start + duration

                    segmOffset += 1
                    curTime += pageSize

                    // Only add to viewData if segment is not a prefetch page
                    if (isViewPage) {
                        chanViewData.blocks.push(curSegm)
                    }

                    const prevPageTime = curSegm.pageStart
                    curSegm = chDataSegments[firstSegment + segmOffset]
                    if (curSegm && prevPageTime === curSegm.pageStart) {
                        continuationSegment = true
                    }
                } else {
                    // Data needs to be requested from server

                    // Check if already being requested
                    if (requestedPages.get(curTime)) {
                        curTime += pageSize
                        if (curSegm && curTime >= curSegm.pageEnd) {
                            while (curSegm && curSegm.pageEnd < curTime) {
                                segmOffset += 1
                                curSegm = chDataSegments[firstSegment + segmOffset]
                                if (!curSegm) {
                                    break
                                }
                            }
                        }
                        continue
                    }

                    let isViewPage = curTime < start + duration

                    // Check if requested range is already requested by other channel
                    let isAdded = false
                    if (isViewPage) {
                        // Remove from pre-request
                        for (let iA in aSyncPreRequests.value) {
                            if (aSyncPreRequests.value[iA].start === curTime) {
                                aSyncPreRequests.value.splice(iA, 1)
                                break
                            }
                        }

                        for (let iA in aSyncRequests.value) {
                            if (aSyncRequests.value[iA].start === curTime) {
                                aSyncRequests.value[iA].channels.push(curChan)
                                isAdded = true
                            }
                        }
                        if (!isAdded) {
                            aSyncRequests.value.push({
                                channels: [curChan],
                                start: curTime,
                                duration: pageSize,
                                isInViewport: true,
                                pixelWidth: Math.ceil(rsPeriod)
                            })
                        }
                    } else {
                        if (updatePrefetchPages) {
                            for (let iA in aSyncPreRequests.value) {
                                if (aSyncPreRequests.value[iA].start === curTime) {
                                    aSyncPreRequests.value[iA].channels.push(curChan)
                                    isAdded = true
                                }
                            }
                            if (!isAdded) {
                                aSyncPreRequests.value.push({
                                    channels: [curChan],
                                    start: curTime,
                                    duration: pageSize,
                                    isInViewport: false,
                                    pixelWidth: Math.ceil(rsPeriod)
                                })
                            }
                        }
                    }

                    curTime += pageSize
                    if (curSegm && curTime >= curSegm.pageEnd) {
                        while (curSegm && curSegm.pageEnd < curTime) {
                            segmOffset += 1
                            curSegm = chDataSegments[firstSegment + segmOffset]
                            if (!curSegm) {
                                break
                            }
                        }
                    }
                }
            }

            // Sort the ChannelView pages
            chanViewData.blocks.sort(viewSegmComparator)
        }

        return {
            asyncRequests: aSyncRequests.value,
            asyncPreRequests: aSyncPreRequests.value
        }
    }

    // View segment comparator from original
    const viewSegmComparator = (a, b) => {
        if (a.startTs < b.startTs) return -1
        if (a.startTs > b.startTs) return 1
        return 0
    }

    // Request data from server (from original) - now accepts ts_end as parameter
    const requestDataFromServer = (requests, firstRequest = 0, websocket, userToken, activeViewer, rsPeriod, requestedPages, ts_end) => {
        if (requests.length === 0) {
            console.log('⚠️ No requests to send')
            return false
        }

        const datasetEndTime = ts_end

        // console.log('📤 Processing requests:', {
        //     count: requests.length,
        //     requests: requests.map(req => ({
        //         start: req.start,
        //         duration: req.duration,
        //         isInViewport: req.isInViewport,
        //         channelCount: req.channels.length,
        //         channels: req.channels.map(ch => ({
        //             id: ch.id,
        //             serverId: ch.serverId,
        //             label: ch.label
        //         }))
        //     }))
        // })

        for (let i = 0; i < requests.length; i++) {
            let curRequest
            if (i === 0) {
                curRequest = requests[firstRequest]
            } else if (i === firstRequest) {
                curRequest = requests[0]
            } else {
                curRequest = requests[i]
            }

            // Check for last block
            let requestEndTime = curRequest.start + curRequest.duration
            if (requestEndTime > datasetEndTime) {
                requestEndTime = datasetEndTime
            }

            const ws = websocket
            if (ws && ws.readyState === 1) {
                // ✅ ENHANCED: Better virtual channel mapping for montaged channels
                const virtualChannels = curRequest.channels.map(channel => {
                    const serverChannelId = channel.serverId || channel.id
                    const channelName = channel.label || channel.name

                    // console.log('🔗 Mapping channel for request:', {
                    //     clientId: channel.id,
                    //     serverId: serverChannelId,
                    //     label: channelName
                    // })

                    return {
                        id: serverChannelId,  // Server expects serverId
                        name: channelName
                    }
                })

                const req = {
                    session: userToken,
                    minMax: true,
                    startTime: curRequest.start,
                    endTime: requestEndTime,
                    packageId: activeViewer.content.id,
                    pixelWidth: curRequest.pixelWidth,
                    virtualChannels
                }

                // console.log('📡 Sending WebSocket request:', {
                //     startTime: req.startTime,
                //     endTime: req.endTime,
                //     isInViewport: curRequest.isInViewport,
                //     virtualChannels: req.virtualChannels,
                //     pixelWidth: req.pixelWidth
                // })

                const reqJson = JSON.stringify(req)
                ws.send(reqJson)

                // Track the request with client channel IDs
                const nrChannels = curRequest.channels.length
                const channelCounter = new Map()
                for (let j = 0; j < nrChannels; j++) {
                    const channelId = curRequest.channels[j].id  // Use unique client id
                    channelCounter.set(channelId, NaN)
                }

                const requestInfo = {
                    count: nrChannels,
                    counter: channelCounter,
                    subPageCount: NaN,
                    ts: Date.now(),
                    inViewport: curRequest.isInViewport,
                    // Add debug info
                    channels: curRequest.channels.map(ch => ({
                        id: ch.id,
                        serverId: ch.serverId,
                        label: ch.label
                    }))
                }

                requestedPages.set(curRequest.start, requestInfo)

                // console.log('✅ Request tracked:', {
                //     pageStart: curRequest.start,
                //     channelCount: nrChannels,
                //     isInViewport: curRequest.isInViewport,
                //     totalTrackedPages: requestedPages.size
                // })
            } else {
                console.error('❌ WebSocket not ready for sending requests:', {
                    readyState: ws?.readyState,
                    wsExists: !!ws
                })
                return false
            }
        }

        aSyncRequests.value = []
        return true
    }

    // Start prefetching (from original)
    const startPrefetching = () => {
        if (aSyncPreRequests.value.length > 0) {
            if (!isPrefetching.value) {
                prefetchTimer.value = setInterval(preFetchRequestFnc, 150)
                isPrefetching.value = true
            }
        }
    }

    // Stop prefetching
    const stopPrefetching = () => {
        if (prefetchTimer.value) {
            clearInterval(prefetchTimer.value)
            prefetchTimer.value = null
        }
        isPrefetching.value = false
    }

    // Clear all requests
    const clearRequests = () => {
        const oldAsyncCount = aSyncRequests.value.length
        const oldPreCount = aSyncPreRequests.value.length

        aSyncRequests.value = []
        aSyncPreRequests.value = []
        prevStart.value = 0
        prevDuration.value = 0
        stopPrefetching()

        console.log('🧹 Cleared requests:', {
            asyncRequests: oldAsyncCount,
            preRequests: oldPreCount
        })
    }

    // Get viewport requests
    const getViewportRequests = () => {
        const requests = aSyncRequests.value.slice()
        aSyncRequests.value = []
        return requests
    }

    // Re-request pages (from original)
    const reRequestPages = (requestedPages, pageSize, rsPeriod) => {
        const requestPages = []
        requestedPages.forEach(function(value, key) {
            // Only rerequest pages where we already have partial return
            if (!isNaN(value.subPageCount)) {
                // Only include channels with partial return
                const channels = []
                value.counter.forEach(function(count, chId) {
                    if (!isNaN(count) && count > 0) {
                        channels.push(chId)
                    }
                })

                if (channels.length > 0) {
                    requestPages.push({
                        channels: channels,
                        start: key,
                        duration: pageSize,
                        isInViewport: true,
                        pixelWidth: Math.ceil(rsPeriod)
                    })
                }
            }
        })

        // Clear requestedPages
        requestedPages.clear()
        return requestPages
    }

    onUnmounted(() => {
        stopPrefetching()
    })

    return {
        // State
        aSyncRequests: readonly(aSyncRequests),
        aSyncPreRequests: readonly(aSyncPreRequests),
        isPrefetching: readonly(isPrefetching),
        lastViewPageRequest: readonly(lastViewPageRequest),

        // Methods
        initializePrefetch,
        generatePoints,
        requestData,
        requestDataFromServer,
        startPrefetching,
        stopPrefetching,
        clearRequests,
        getViewportRequests,
        reRequestPages
    }
}