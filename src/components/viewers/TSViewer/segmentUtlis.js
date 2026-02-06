// utils/segmentUtils.js
export function findSegmentIndex(segments, timestamp, options = {}) {
    const { findFirst = true, startIndex = 0 } = options

    if (!segments || segments.length === 0) {
        return -1
    }

    let min = startIndex
    let max = segments.length - 1

    while (min <= max) {
        const mid = Math.floor((min + max) / 2)
        const segment = segments[mid]

        if (segment.pageStart === timestamp) {
            if (findFirst) {
                // Find first occurrence
                let index = mid
                while (index > 0 && segments[index - 1].pageStart === timestamp) {
                    index--
                }
                return index
            } else {
                // Find last occurrence
                let index = mid
                while (index < segments.length - 1 && segments[index + 1].pageStart === timestamp) {
                    index++
                }
                return index
            }
        } else if (segment.pageStart < timestamp) {
            min = mid + 1
        } else {
            max = mid - 1
        }
    }

    // Return insertion point
    return max >= 0 ? -(max + 2) : -1
}