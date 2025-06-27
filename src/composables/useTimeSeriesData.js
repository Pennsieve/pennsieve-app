// @/composables/useTimeSeriesData.js
import { ref, reactive, computed } from 'vue'

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
                    label: curC.name,
                    displayName: curC.displayName,
                    type: curC.channelType,
                    segments: [],
                    start: curC.start,
                    end: curC.end,
                    sampleFreq: curC.rate,
                    unit: curC.unit,
                    gaps: [],
                    virtualId: curC.virtualId
                }

                const label = curChannel.label.split("<->", 3)
                const label_prefix = label[0]
                let label_value = (label.length > 1) ? parseFloat(label[1]) : 0
                label_value = (isNaN(label_value) ? label[1] : label_value)

                channelConfig.push({
                    id: curChannel.id,
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
                    virtualId: curChannel.virtualId
                })

                chObjects.push(curChannel)
            }

            // Sort channels (original logic)
            channelConfig.sort(function(a, b) {
                if (a.label_split.length > 2 || b.label_split.length > 2) {
                    return (a.label > b.label) ? 1 : ((b.label > a.label) ? -1 : 0)
                }

                if (a.label_prefix === b.label_prefix) {
                    return (a.label_value > b.label_value) ? 1 : ((b.label_value > a.label_value) ? -1 : 0)
                }

                return (a.label_prefix > b.label_prefix) ? 1 : ((b.label_prefix > a.label_prefix) ? -1 : 0)
            })

            // Update rank on sorted channels
            for (let i = 0; i < channelConfig.length; i++) {
                channelConfig[i].rank = i
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


        // Autoscale counter logic
        if (autoScale.value > 0) {
            autoScale.value--
        }

        // Find channel for object in chData
        let curChData = null
        for (let ch = 0; ch < chData.value.length; ch++) {
            if (chData.value[ch].label === obj.data.label) {
                curChData = chData.value[ch]
                break
            }
        }

        // Process based on type
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

                // Remove from requested pages
                let requestedPage = requestedPages.value.get(obj.data.pageStart)
                if (requestedPage) {
                    // console.log('📦 Processing response:', {
                    //     pageStart: obj.data.pageStart,
                    //     chId: obj.data.chId,
                    //     label: obj.data.label,
                    //     nrResponses: obj.nrResponses,
                    //     currentCounters: Object.fromEntries(requestedPage.counter),
                    //     requestedPages_size: requestedPages.value.size
                    // })

                    let countForChannel = requestedPage.counter.get(obj.data.chId)

                    if (isNaN(countForChannel)) {
                        // First response - initialize properly
                        countForChannel = obj.nrResponses
                        requestedPage.counter.set(obj.data.chId, countForChannel)

                        // Decrement for this response
                        countForChannel = countForChannel - 1
                        requestedPage.counter.set(obj.data.chId, countForChannel)
                        // console.log('✅ First response - set to:', countForChannel)
                    } else if (countForChannel > 0) {
                        // Only decrement if positive
                        countForChannel = countForChannel - 1
                        requestedPage.counter.set(obj.data.chId, countForChannel)
                        // console.log('📉 Decremented to:', countForChannel)
                    } else {
                        // console.warn('⚠️ Ignoring extra response - already complete')
                        return
                    }

                    if (countForChannel === 0) {
                        let isComplete = true
                        let pendingChannels = []

                        for (let [chId, count] of requestedPage.counter.entries()) {
                            if (count > 0 || isNaN(count)) {
                                isComplete = false
                                pendingChannels.push({ chId, count })
                            }
                        }

                        // console.log('🔍 Completion check for page', obj.data.pageStart, ':', {
                        //     isComplete,
                        //     pendingChannels,
                        //     allCounters: Object.fromEntries(requestedPage.counter)
                        // })

                        if (isComplete) {
                            // console.log('✅ DELETING completed page:', obj.data.pageStart)
                            requestedPages.value.delete(obj.data.pageStart)
                            // console.log('📊 requestedPages.size after cleanup:', requestedPages.value.size)
                        }
                    }
                } else {
                    // console.log('❓ No requestedPage found for pageStart:', obj.data.pageStart)
                }

                // Add data to cache
                if (addData) {
                    curSegments.push(obj.data)
                    curSegments.sort(function Comparator(a, b) {
                        if (a.startTs < b.startTs) return -1
                        if (a.startTs > b.startTs) return 1
                        return 0
                    })
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