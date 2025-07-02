// utils/annotationUtils.js
import { defaultTo, find, propEq } from 'ramda'

/**
 * Convert hex color to RGBA with specified opacity
 */
export const hexToRgbA = (hex, opacity) => {
    let c
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('')
        if (c.length === 3) {
            c = [c[0], c[0], c[1], c[1], c[2], c[2]]
        }
        c = '0x' + c.join('')
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + opacity + ')'
    }
    throw new Error('Bad Hex')
}

/**
 * Sort annotations by start time
 */
export const sortAnnotations = (annotationArray) => {
    annotationArray.sort((a, b) => {
        if (a.start < b.start) return -1
        if (a.start > b.start) return 1
        return 0
    })
}

/**
 * Get the layer for a given annotation
 */
export const getLayer = (annotation, viewerAnnotations) => {
    const layerId = annotation?.layer_id || 0
    return defaultTo({}, find(propEq('id', layerId), viewerAnnotations))
}

/**
 * Binary search to find annotation index by time value
 */
export const annIndexOf = (annArray, val, first, startAtIndex = 0, checkEnd = false) => {
    let index
    if (checkEnd) {
        index = indexOfEnd(annArray, val, startAtIndex, annArray.length - 1, first)
    } else {
        index = indexOfStart(annArray, val, startAtIndex, annArray.length - 1, first)
    }

    if (index === -1) {
        index = 0
    } else if (index < 0) {
        index = -index - 2
    }
    return index
}

/**
 * Binary search helper for annotation start times
 */
const indexOfStart = (annArray, val, min, max, firstIndex) => {
    if (max < min) {
        let pred = max >= 0 ? max : -max - 2
        if (pred === -1) return pred

        const predVal = annArray[pred].start
        while (pred >= 0 && annArray[pred].start === predVal) {
            pred--
        }
        return -pred - 2
    }

    const mid = parseInt((min + max) / 2)

    if (annArray[mid].start > val) {
        return indexOfStart(annArray, val, min, mid - 1, firstIndex)
    } else if (annArray[mid].start < val) {
        return indexOfStart(annArray, val, mid + 1, max, firstIndex)
    } else {
        let index = mid
        if (firstIndex) {
            while (index >= 0 && annArray[index].start === val) {
                index--
            }
            index++
        } else {
            while (index < annArray.length && annArray[index].start === val) {
                index++
            }
            index--
        }
        return index
    }
}

/**
 * Binary search helper for annotation end times
 */
const indexOfEnd = (annArray, val, min, max, firstIndex) => {
    if (max < min) {
        let pred = max >= 0 ? max : -max - 2
        if (pred === -1) return pred

        const predVal = annArray[pred].start + annArray[pred].duration
        while (pred >= 0 && (annArray[pred].start + annArray[pred].duration) === predVal) {
            pred--
        }
        return -pred - 2
    }

    const mid = parseInt((min + max) / 2)
    const midEnd = annArray[mid].start + annArray[mid].duration

    if (midEnd > val) {
        return indexOfEnd(annArray, val, min, mid - 1, firstIndex)
    } else if (midEnd < val) {
        return indexOfEnd(annArray, val, mid + 1, max, firstIndex)
    } else {
        let index = mid
        if (firstIndex) {
            while (index >= 0 && (annArray[index].start + annArray[index].duration) === val) {
                index--
            }
            index++
        } else {
            while (index < annArray.length && (annArray[index].start + annArray[index].duration) === val) {
                index++
            }
            index--
        }
        return index
    }
}

/**
 * Validate annotation data structure
 */
export const validateAnnotation = (annotation) => {
    const required = ['id', 'start', 'duration', 'label', 'layer_id']
    return required.every(field => annotation.hasOwnProperty(field))
}

/**
 * Calculate annotation end time
 */
export const getAnnotationEnd = (annotation) => {
    return annotation.start + annotation.duration
}

/**
 * Check if annotation is within a time range
 */
export const isAnnotationInRange = (annotation, startTime, endTime) => {
    const annEnd = getAnnotationEnd(annotation)
    return !(annotation.start > endTime || annEnd < startTime)
}

/**
 * Get visible annotations within a time range
 */
export const getVisibleAnnotations = (annotations, startTime, endTime) => {
    return annotations.filter(ann => isAnnotationInRange(ann, startTime, endTime))
}

/**
 * Canvas scaling utility
 */
export const canvasScaler = (size, pixelRatio, offset = 0) => {
    return pixelRatio * (size + offset)
}

/**
 * Get annotation display name
 */
export const getAnnotationDisplayName = (annotation) => {
    return annotation.label || annotation.name || `Annotation ${annotation.id}`
}