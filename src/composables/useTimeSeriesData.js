// @/composables/useTimeSeriesData.js
import {reactive, ref} from 'vue'
import {propOr} from "ramda";

export const useTimeSeriesData = () => {
    // Data structures from original
    const chData = ref([])
    const requestedPages = ref(new Map())
    const viewData = reactive({
        start: 0,
        duration: 0,
        channels: []
    })

    // State from original
    const channelsReady = ref(false)
    const autoScale = ref(0)
    const globalGaps = ref(null)
    const currentRequestedSamplePeriod = ref(1)

    // Configuration from original
    const pageSize = 15000000
    const prefetchPages = 3

    // Binary search function from original
    const segmIndexOf = (segmArray, val, first, startAtIndex) => {
        if (!startAtIndex) {
            startAtIndex = 0
        }
        let index = indexOfStart(segmArray, val, startAtIndex, segmArray.length - 1, first)

        if (index === -1) {
            index = 0
        } else if (index < 0) {
            index = -index - 2
        }
        return index
    }

    const indexOfStart = (segmArray, val, min, max, firstIndex) => {
        if (max < min) {
            let pred
            if (max >= 0) {
                pred = max
            } else {
                pred = -max - 2
            }
            if (pred === -1) {
                return pred
            }
            const predVal = segmArray[pred].pageStart
            while (pred >= 0 && segmArray[pred].pageStart === predVal) {
                pred--
            }
            pred++
            return -pred - 2
        }

        const mid = parseInt((min + max) / 2)

        if (segmArray[mid].pageStart > val) {
            return indexOfStart(segmArray, val, min, mid - 1, firstIndex)
        } else if (segmArray[mid].pageStart < val) {
            return indexOfStart(segmArray, val, mid + 1, max, firstIndex)
        } else {
            let index = mid
            if (firstIndex) {
                while (index >= 0 && segmArray[index].pageStart === val) {
                    index--
                }
                index++
            } else {
                while (index < segmArray.length && segmArray[index].pageStart === val) {
                    index++
                }
                index--
            }
            return index
        }
    }

    // Initialize channels (from original) - now accepts getChannelIdFn as parameter
    const initChannels = (channels, store, getChannelIdFn) => {
        if (!channels) {
            return Promise.resolve()
        }

        const chObjects = []
        if (channels.length > 0) {
            const channelConfig = []

            for (let ic = 0; ic < channels.length; ic++) {
                const curC = channels[ic].content
                const curId = getChannelIdFn ? getChannelIdFn(curC) : curC.id

                const curChannel = {
                    id: curId,
                    serverId: curC.serverId,
                    label: curC.name,
                    displayName: curC.displayName,
                    type: curC.channelType,
                    segments: [],
                    start: curC.start,
                    end: curC.end,
                    sampleFreq: curC.rate,
                    unit: curC.unit,
                    gaps: [],
                    dataSegments: []
                }

                const label = curChannel.label.split("<->", 3)
                const label_prefix = label[0]
                let label_value = (label.length > 1) ? parseFloat(label[1]) : 0
                label_value = (isNaN(label_value) ? label[1] : label_value)

                channelConfig.push({
                    id: curChannel.id,
                    serverId: curChannel.serverId,
                    type: curChannel.type,
                    label: curChannel.label,
                    displayName: curChannel.displayName,
                    label_split: label,
                    label_prefix: label_prefix,
                    label_value: label_value,
                    dataSegments: [],
                    rank: ic,
                    visible: true,
                    plotAgainst: null,
                    rowBaseline: null,
                    rowScale: 1,
                    rowAdjust: 0,
                    selected: false,
                    hover: false,
                    unit: curC.unit,
                    sf: curC.rate,
                    filter: {},
                    hideFilter: true,
                    isEditing: false,
                })

                chObjects.push(curChannel)
            }

            // Return channelConfig to be set in store by caller
            if (store) {
                store.setChannels(channelConfig)
            }
        }

        computeSummary(chObjects)
        chData.value = chObjects
        autoScale.value = channels.length
        channelsReady.value = true

        return Promise.resolve()
    }

    // Compute summary (from original)
    const computeSummary = (channels) => {
        if (channels.length === 0) {
            globalGaps.value = null
            return
        }
        globalGaps.value = channels[0]?.gaps?.[0] || null
    }

    // Data callback (from original)
    const dataCallback = (obj) => {
        let curChData = null
        const serverResponseId = obj.data.chId || obj.data.source
        const serverResponseName = obj.data.label || obj.data.name

        // ✅ ROBUST MATCHING: Find exact match first (serverId + label)
        curChData = chData.value.find(channel =>
            channel.serverId === serverResponseId &&
            channel.label === serverResponseName
        )

        if (curChData) {
            // console.log('✅ EXACT MATCH found:', curChData.id)
        } else {
            // ❌ REJECT serverId-only matches for safety
            console.error('❌ NO EXACT MATCH - rejecting to prevent data corruption:', {
                serverResponseId,
                serverResponseName,
                availableChannels: chData.value.map(ch => ({
                    id: ch.id,
                    serverId: ch.serverId,
                    label: ch.label,
                    matches: {
                        serverId: ch.serverId === serverResponseId,
                        label: ch.label === serverResponseName
                    }
                }))
            })
            return // 🚨 STOP here to prevent wrong data attribution
        }

        // ✅ PROCESS THE DATA (existing logic)
        switch (obj.type) {
            case 'gap':
            case 'Neural':
            case 'Continuous':
                // Check if data already exists
                let addData = false
                let curSegments = curChData && curChData.segments

                if (curSegments && obj.type !== 'gap') {
                    addData = true
                    if (curSegments.length > 0) {
                        let fIndex = segmIndexOf(curSegments, obj.data.startTs, true, 0)

                        while (curSegments[fIndex] && curSegments[fIndex].pageStart === obj.data.pageStart) {
                            if (curSegments[fIndex].startTs === obj.data.startTs) {
                                addData = false
                                break
                            }
                            fIndex++
                        }
                    }
                }

                // ✅ CRITICAL: Update request counter for the CORRECT channel
                let requestedPage = requestedPages.value.get(obj.data.pageStart)
                if (requestedPage) {
                    let countForChannel = requestedPage.counter.get(curChData.id)

                    if (isNaN(countForChannel)) {
                        countForChannel = obj.nrResponses || 1
                        requestedPage.counter.set(curChData.id, countForChannel)
                    }

                    if (countForChannel > 0) {
                        countForChannel = countForChannel - 1
                        requestedPage.counter.set(curChData.id, countForChannel)

                        // console.log('📊 Updated counter for channel:', {
                        //     channelId: curChData.id,
                        //     pageStart: obj.data.pageStart,
                        //     newCount: countForChannel
                        // })
                    }

                    // Check if page is complete
                    if (countForChannel === 0) {
                        let isComplete = true
                        for (let [chId, count] of requestedPage.counter.entries()) {
                            if (count > 0 || isNaN(count)) {
                                isComplete = false
                                break
                            }
                        }

                        if (isComplete) {
                            requestedPages.value.delete(obj.data.pageStart)
                            // console.log('✅ Page completed and removed:', {
                            //     pageStart: obj.data.pageStart,
                            //     remainingPages: requestedPages.value.size
                            // })
                        }
                    }
                }

                // Add data to cache
                if (addData) {
                    curSegments.push(obj.data)
                    curSegments.sort((a, b) => {
                        if (a.startTs < b.startTs) return -1
                        if (a.startTs > b.startTs) return 1
                        return 0
                    })

                    // console.log('📈 Added data to cache:', {
                    //     channelId: curChData.id,
                    //     pageStart: obj.data.pageStart,
                    //     nrPoints: obj.data.nrPoints
                    // })
                }
                break

            case 'realtime':
                break
        }
    }

    // Invalidate cache (from original)
    const invalidate = () => {
        globalGaps.value = []
        requestedPages.value.clear()
        for (let i = 0; i < chData.value.length; i++) {
            chData.value[i].segments = []
        }
        for (let i = 0; i < viewData.channels.length; i++) {
            viewData.channels[i].blocks = []
        }
    }

    // Auto scale (from original) - now accepts cHeight as parameter
    const autoScaleViewData = (cHeight) => {
        let sumMedian = 0
        let nrSeg = 0
        let allChannels = viewData.channels

        for (let i = 0; i < allChannels.length; i++) {
            let curBlocks = allChannels[i].blocks
            for (let j = 0; j < curBlocks.length; j++) {
                if (curBlocks[j].type !== 'Continuous') {
                    continue
                }
                sumMedian += standardDeviation(curBlocks[j].parsedData[1])
                nrSeg++
            }
        }

        const avgStd = sumMedian / nrSeg
        if (!isNaN(avgStd) && cHeight) {
            return (cHeight / allChannels.length) / (2 * avgStd)
        }
        return 1
    }

    // Helper functions from original
    const standardDeviation = (values) => {
        const avg = average(values)
        const squareDiffs = values.map(function(value) {
            const diff = value - avg
            const sqrDiff = diff * diff
            return sqrDiff
        })
        const avgSquareDiff = average(squareDiffs)
        const stdDev = Math.sqrt(avgSquareDiff)
        return stdDev
    }

    const average = (data) => {
        const sum = data.reduce(function(sum, value) {
            return sum + value
        }, 0)
        const avg = sum / data.length
        return avg
    }

    const updateCurrentRequestedSamplePeriod = (rsPeriod) => {
        currentRequestedSamplePeriod.value = Math.ceil(rsPeriod)
    }

// Check if data is current for the viewport (simple implementation)
    const isDataCurrentForViewport = (segmentData) => {
        // Simple validation - you can make this more sophisticated
        // For now, just check if the data has a valid timestamp
        return segmentData && segmentData.startTs && segmentData.startTs > 0
    }


    return {
        // State
        chData,
        requestedPages,
        viewData,
        channelsReady,
        autoScale,
        globalGaps,

        // Constants
        pageSize,
        prefetchPages,
        currentRequestedSamplePeriod,

        // Methods
        initChannels,
        computeSummary,
        dataCallback,
        invalidate,
        autoScaleViewData,
        segmIndexOf,
        updateCurrentRequestedSamplePeriod,
        isDataCurrentForViewport,

        // Helpers
        standardDeviation,
        average
    }
}