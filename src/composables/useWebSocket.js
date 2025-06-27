// @/composables/useWebSocket.js
import { ref, onUnmounted, readonly } from 'vue'
import protobuf from 'protobufjs'
import { useGetToken } from "@/composables/useGetToken"

export const useWebSocket = () => {
    const websocket = ref(null)
    const connectionStatus = ref('disconnected')
    const initWebsocket = ref(true)

    // Protocol buffer definition from original
    const proto = {
        'nested': {
            'Event': {
                'fields': {
                    'source': { 'type': 'string', 'id': 1 },
                    'pageStart': { 'type': 'uint64', 'id': 2 },
                    'pageEnd': { 'type': 'uint64', 'id': 3 },
                    'samplePeriod': { 'type': 'double', 'id': 4 },
                    'pointsPerEvent': { 'type': 'uint64', 'id': 5 },
                    'isResampled': { 'type': 'bool', 'id': 6 },
                    'data': { 'rule': 'repeated', 'type': 'double', 'id': 7 },
                    'times': { 'rule': 'repeated', 'type': 'uint64', 'id': 8 },
                    'spikeGroup': { 'rule': 'repeated', 'type': 'uint32', 'id': 9 }
                }
            },
            'Instruction': {
                'fields': {
                    'command': { 'type': 'string', 'id': 1 },
                    'argument': { 'type': 'string', 'id': 2 }
                }
            },
            'Segment': {
                'fields': {
                    'startTs': { 'type': 'uint64', 'id': 1 },
                    'source': { 'type': 'string', 'id': 2 },
                    'lastUsed': { 'type': 'uint64', 'id': 3 },
                    'unit': { 'type': 'string', 'id': 4 },
                    'samplePeriod': { 'type': 'double', 'id': 5 },
                    'requestedSamplePeriod': { 'type': 'double', 'id': 6 },
                    'pageStart': { 'type': 'uint64', 'id': 7 },
                    'isMinMax': { 'type': 'bool', 'id': 8 },
                    'unitM': { 'type': 'uint64', 'id': 9 },
                    'segmentType': { 'type': 'string', 'id': 10 },
                    'nrPoints': { 'type': 'uint64', 'id': 11 },
                    'data': { 'rule': 'repeated', 'type': 'double', 'id': 12 },
                    'pageEnd': { 'type': 'uint64', 'id': 13 },
                    'channelName': { 'type': 'string', 'id': 14 }
                }
            },
            'IngestSegment': {
                'fields': {
                    'channelId': { 'type': 'string', 'id': 1 },
                    'startTime': { 'type': 'uint64', 'id': 2 },
                    'samplePeriod': { 'type': 'double', 'id': 3 },
                    'data': { 'rule': 'repeated', 'type': 'double', 'id': 4 }
                }
            },
            'TimeSeriesMessage': {
                'fields': {
                    'segment': { 'type': 'Segment', 'id': 3 },
                    'event': { 'rule': 'repeated', 'type': 'Event', 'id': 4 },
                    'instruction': { 'type': 'Instruction', 'id': 5 },
                    'ingestSegment': { 'type': 'IngestSegment', 'id': 6 },
                    'totalResponses': { 'type': 'uint64', 'id': 7 },
                    'responseSequenceId': { 'type': 'uint64', 'id': 8 }
                }
            }
        }
    }

    // Initialize protobuf
    const protobufInstance = protobuf.Root.fromJSON(proto)
    const timeSeriesMessage = protobufInstance.TimeSeriesMessage

    // Message handlers
    let onSegmentHandler = null
    let onEventHandler = null
    let onChannelDetailsHandler = null
    let onErrorHandler = null

    // Configuration - can be set from outside
    let useMedian = false

    const openWebsocket = (timeSeriesUrl, packageId, userToken) => {
        if (websocket.value && (websocket.value.readyState === 0 || websocket.value.readyState === 1)) {
            return
        }

        useGetToken()
            .then(token => {
                const url = timeSeriesUrl + '?session=' + (userToken || token) + '&package=' + packageId
                websocket.value = new WebSocket(url)
                websocket.value.onopen = onWebsocketOpen
                websocket.value.onclose = onWebsocketClose
                websocket.value.onmessage = onWebsocketMessage
            })
            .catch(console.log)
    }

    let clearChannelsCallback = null
    let packageId = null

    const onWebsocketOpen = () => {
        connectionStatus.value = 'connected'

        if (initWebsocket.value) {
            // Clear filters on initial connection
            if (clearChannelsCallback) {
                clearChannelsCallback()
            }

            // Clear montage
            if (packageId) {
                const payload = { montage: 'NOT_MONTAGED', packageId: packageId }
                websocket.value.send(JSON.stringify(payload))
            }
            initWebsocket.value = false
        }
    }

    const onWebsocketClose = () => {
        connectionStatus.value = 'disconnected'
        // Don't auto-reconnect here - let the component handle it
    }

    const onWebsocketMessage = (msg) => {
        // Process JSON messages
        if (typeof msg.data === 'string') {
            let data = {}
            try {
                data = JSON.parse(msg.data)
            } catch (e) {
                onErrorHandler?.({ error: 'JSON Parse Error' })
                return
            }

            if (data.channelDetails) {
                onChannelDetailsHandler?.(data.channelDetails)
            } else if (data.error) {
                onErrorHandler?.(data)
            }
            return
        }

        // Process protobuf messages
        const myReader = new FileReader()
        myReader.addEventListener('loadend', function(e) {
            const buffer = e.target.result
            const barray = new Uint8Array(buffer)

            const timeSeriesMsg = timeSeriesMessage.decode(barray)
            const segment = timeSeriesMsg.segment

            // Handle Neural Data
            if (timeSeriesMsg.event && timeSeriesMsg.event.length > 0 && timeSeriesMsg.event[0].pageStart) {
                const tsEvent = timeSeriesMsg.event[0]
                const dataPoints = [[], []]
                const nrVal = tsEvent.times.length / 2

                let curI = 0
                for (let i = 0; i < nrVal; i++) {
                    dataPoints[0].push(tsEvent.times[curI])
                    dataPoints[1].push(tsEvent.times[curI + 1])
                    curI += 2
                }

                let cData = new Array(3)
                let k = 0
                while (k < 3) {
                    cData[k] = new Float32Array(dataPoints[0].length)
                    k++
                }

                const segm = {
                    chId: tsEvent.source,
                    lastUsed: 0,
                    unit: 'uV',
                    samplePeriod: tsEvent.samplePeriod,
                    pageStart: tsEvent.pageStart,
                    pageEnd: tsEvent.pageEnd,
                    startTs: tsEvent.pageStart,
                    isMinMax: tsEvent.isResampled,
                    unitM: 1,
                    type: 'Neural',
                    nrPoints: nrVal,
                    parsedData: dataPoints,
                    cData: cData
                }

                onEventHandler?.({
                    pageStart: tsEvent.pageStart,
                    data: segm,
                    type: 'Neural',
                    nrResponses: timeSeriesMsg.totalResponses
                })
            }

            // Handle Regular Timeseries data
            if (segment !== null) {
                let nrVal = null
                if (segment.isMinMax) {
                    nrVal = segment.data.length / 2
                } else {
                    nrVal = segment.data.length
                }

                const parsedData = new Array(3)
                const startTs = segment.startTs

                let sumElem = 0
                let nrValidPoints = 0
                let i = 0
                while (i < 3) {
                    parsedData[i] = new Float64Array(nrVal)
                    i++
                }

                if (segment.isMinMax) {
                    let curI = 0
                    for (let i = 0; i < nrVal; i++) {
                        let curY = -segment.data[curI]
                        let curY2 = -segment.data[curI + 1]
                        parsedData[0][i] = startTs + (i * segment.samplePeriod)
                        parsedData[1][i] = curY
                        parsedData[2][i] = curY2
                        if (!isNaN(curY)) {
                            nrValidPoints++
                            sumElem += curY + (curY2 - curY) / 2
                        }
                        curI += 2
                    }
                } else {
                    for (let i = 0; i < nrVal; i++) {
                        let curY = -segment.data[i]
                        parsedData[0][i] = startTs + (i * segment.samplePeriod)
                        parsedData[1][i] = curY
                        if (!isNaN(curY)) {
                            nrValidPoints++
                            sumElem += curY
                        }
                    }
                }

                let elemMedian = 0
                if (useMedian) {
                    const sortedYvals = Array.prototype.slice.call(parsedData[1]).sort()
                    elemMedian = sortedYvals[Math.round(sortedYvals.length / 2)]
                }

                let cData = new Array(3)
                let k = 0
                while (k < 3) {
                    cData[k] = new Float32Array(parsedData[0].length)
                    k++
                }

                const segm = {
                    chId: segment.source,
                    lastUsed: segment.lastUsed,
                    unit: segment.unit,
                    samplePeriod: segment.samplePeriod,
                    pageStart: segment.pageStart,
                    pageEnd: segment.pageEnd,
                    startTs: startTs,
                    isMinMax: segment.isMinMax,
                    unitM: segment.unitM,
                    type: segment.segmentType,
                    nrPoints: nrVal,
                    cData: cData,
                    parsedData: parsedData,
                    median: elemMedian,
                    sumElem: sumElem,
                    nrValidPoints: nrValidPoints,
                    name: segment.channelName,
                    label: segment.channelName,
                    virtualId: `${segment.source}_${segment.channelName}`
                }

                if (segm.nrPoints > 0) {
                    onSegmentHandler?.({
                        pageStart: segment.pageStart,
                        data: segm,
                        type: segment.segmentType,
                        nrResponses: timeSeriesMsg.totalResponses
                    })
                } else {
                    onSegmentHandler?.({
                        pageStart: segment.pageStart,
                        data: segm,
                        nrResponses: timeSeriesMsg.totalResponses,
                        type: 'gap'
                    })
                }
            }
        })

        myReader.readAsArrayBuffer(msg.data)
    }

    const send = (message) => {
        if (websocket.value && websocket.value.readyState === 1) {
            websocket.value.send(JSON.stringify(message))
            return true
        }
        return false
    }

    const sendMontageMessage = (montageScheme) => {
        let payload
        switch (montageScheme) {
            case "NOT_MONTAGED":
                payload = { montage: "NOT_MONTAGED", packageId: packageId }
                break
            default:
                payload = { montage: "CUSTOM_MONTAGE", packageId: packageId, montageMap: montageScheme }
        }
        send(payload)
    }

    const sendFilterMessage = (msg) => {
        if (websocket.value && websocket.value.readyState === 1) {
            websocket.value.send(JSON.stringify(msg))
        } else {
            setTimeout(() => sendFilterMessage(msg), 200)
        }
    }

    const disconnect = () => {
        if (websocket.value) {
            websocket.value.close()
            websocket.value = null
        }
        connectionStatus.value = 'disconnected'
    }

    // Event handler setters
    const onSegment = (handler) => { onSegmentHandler = handler }
    const onEvent = (handler) => { onEventHandler = handler }
    const onChannelDetails = (handler) => { onChannelDetailsHandler = handler }
    const onError = (handler) => { onErrorHandler = handler }

    onUnmounted(() => {
        disconnect()
    })

    // Configuration setters
    const setClearChannelsCallback = (callback) => { clearChannelsCallback = callback }
    const setPackageId = (id) => { packageId = id }
    const setUseMedian = (value) => { useMedian = value }

    const sendDumpBufferRequest = () => {
        if (websocket.value && websocket.value.readyState === 1) {
            const message = {
                requestType: 'DumpBufferRequest',
            }
            websocket.value.send(JSON.stringify(message))
            // console.log('🗑️ Sent dump buffer request')
            return true
        }
        console.warn('⚠️ Cannot send dump buffer request - WebSocket not connected')
        return false
    }

// Then update the return statement to include it:
    return {
        websocket: readonly(websocket),
        connectionStatus: readonly(connectionStatus),
        openWebsocket,
        send,
        sendMontageMessage,
        sendFilterMessage,
        sendDumpBufferRequest,  // ← Add this line
        disconnect,
        setClearChannelsCallback,
        setPackageId,
        setUseMedian,
        onSegment,
        onEvent,
        onChannelDetails,
        onError
    }
}