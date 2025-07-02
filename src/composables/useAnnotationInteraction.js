// composables/useAnnotationInteraction.js
import { ref } from 'vue'
import { useViewerStore } from '@/stores/tsviewer'

export function useAnnotationInteraction(focusedAnn, renderAnn, hoverOffsets) {
    const viewerStore = useViewerStore()
    const mouseDownPosition = ref([0, 0])

    const shouldCheckAnnotationHover = (mY, constants) => {
        const annHeight = constants?.ANNOTATIONLABELHEIGHT || 20
        const halfAnnHeight = annHeight / 2

        for (const offset of hoverOffsets.value) {
            if (mY >= (offset - halfAnnHeight) && mY <= (offset + halfAnnHeight)) {
                return true
            }
        }
        return false
    }

    const findAnnotationAtPosition = (mX, mY, constants) => {
        const annHeight = constants?.ANNOTATIONLABELHEIGHT || 20
        const halfAnnHeight = annHeight / 2

        for (let i = 0; i < (renderAnn.value?.length || 0); i++) {
            const ann = renderAnn.value[i]

            // Check horizontal position
            if (ann.cStart < mX && ann.cEnd > mX) {
                // Check vertical position
                if (mY > (ann.cY - halfAnnHeight) && mY < (ann.cY + halfAnnHeight)) {
                    return i
                }
            } else if (ann.cStart > mX) {
                // Break on first annotation where start > mX (they're sorted)
                break
            }
        }
        return null
    }

    const determinePointerMode = (mX, viewerActiveTool, annotation) => {
        if (!annotation) return viewerActiveTool

        switch (viewerActiveTool) {
            case 'annotate':
                if (mX <= (annotation.cStart + 10)) {
                    return 'annResize-left'
                } else if (mX >= (annotation.cEnd - 10) && annotation.duration > 0) {
                    return 'annResize-right'
                } else {
                    return 'annSelect'
                }
            case 'pointer':
                return 'annSelect'
            default:
                return viewerActiveTool
        }
    }

    const resetFocusedAnnotation = () => {
        if (focusedAnn.value?.oldStart !== undefined) {
            focusedAnn.value.start = focusedAnn.value.oldStart
            focusedAnn.value.duration = focusedAnn.value.oldDuration
            focusedAnn.value.end = focusedAnn.value.start + focusedAnn.value.duration
        }
    }

    const selectFocusedAnnotation = () => {
        if (focusedAnn.value) {
            viewerStore.setActiveAnnotation(focusedAnn.value)
            return true
        }
        return false
    }

    const onMouseDown = (mX, mY, pointerMode) => {
        if (focusedAnn.value && ['annResize-left', 'annResize-right'].includes(pointerMode)) {
            focusedAnn.value.oldStart = focusedAnn.value.start
            focusedAnn.value.oldDuration = focusedAnn.value.duration
            mouseDownPosition.value = [mX, mY]
        }
    }

    const onMouseMove = (mX, mY, pointerMode, mouseDown, props) => {
        let newPointerMode = pointerMode

        if (mouseDown && mouseDownPosition.value) {
            // Handle dragging/resizing
            const timeDiff = (mX - mouseDownPosition.value[0]) * props.rsPeriod

            switch (pointerMode) {
                case 'annResize-left':
                    if (focusedAnn.value.oldDuration > 0) {
                        focusedAnn.value.start = focusedAnn.value.oldStart + timeDiff
                        focusedAnn.value.duration = focusedAnn.value.oldDuration - timeDiff
                        focusedAnn.value.end = focusedAnn.value.start + focusedAnn.value.duration
                    } else {
                        focusedAnn.value.start = focusedAnn.value.oldStart + timeDiff
                    }
                    break
                case 'annResize-right':
                    focusedAnn.value.duration = focusedAnn.value.oldDuration + timeDiff
                    focusedAnn.value.end = focusedAnn.value.start + focusedAnn.value.duration
                    break
            }
        } else {
            // Handle hover detection
            const checkAnns = shouldCheckAnnotationHover(mY, props.constants)
            newPointerMode = props.viewerActiveTool

            if (checkAnns) {
                const annIndex = findAnnotationAtPosition(mX, mY, props.constants)

                if (annIndex !== null) {
                    const oldFocus = focusedAnn.value
                    const hoveredAnn = renderAnn.value[annIndex]

                    // Update focus if needed
                    if (!oldFocus || (mX < focusedAnn.value.cStart || mX > focusedAnn.value.cEnd)) {
                        focusedAnn.value = hoveredAnn
                    }

                    // Determine pointer mode based on position
                    newPointerMode = determinePointerMode(mX, props.viewerActiveTool, focusedAnn.value)
                } else {
                    focusedAnn.value = null
                }
            } else {
                focusedAnn.value = null
                newPointerMode = props.viewerActiveTool
            }
        }

        return newPointerMode
    }

    const onMouseUp = (pointerMode, emit) => {
        if (focusedAnn.value && ['annResize-left', 'annResize-right'].includes(pointerMode)) {
            // Correct negative durations
            if (focusedAnn.value.duration < 0) {
                const duration = -focusedAnn.value.duration
                const start = focusedAnn.value.start - duration
                focusedAnn.value.start = start
                focusedAnn.value.duration = duration
                focusedAnn.value.end = start + duration
            }

            viewerStore.setActiveAnnotation(focusedAnn.value)
            emit('updateAnnotation', focusedAnn.value)
        }
    }

    return {
        mouseDownPosition,
        shouldCheckAnnotationHover,
        findAnnotationAtPosition,
        determinePointerMode,
        resetFocusedAnnotation,
        selectFocusedAnnotation,
        onMouseDown,
        onMouseMove,
        onMouseUp
    }
}