// composables/useAnnotationRendering.js
import { ref, computed } from 'vue'
import { useViewerStore } from '@/stores/tsviewer'
import { storeToRefs } from 'pinia'
import { useGetToken } from "@/composables/useGetToken"
import { propOr, pathOr } from 'ramda'
import { sortAnnotations, annIndexOf, getLayer } from '@/utils/annotationUtils'

export function useAnnotationRendering() {
    const viewerStore = useViewerStore()
    const { viewerAnnotations, viewerChannels } = storeToRefs(viewerStore)

    const renderAnn = ref([])
    const hoverOffsets = ref([])
    const focusedAnn = ref(null)
    const a11yList = ref(['#FFFF4E'])

    const config = computed(() => viewerStore.config)

    const computeRenderOptions = (anns, props) => {
        const annotationHeight = props.constants?.ANNOTATIONLABELHEIGHT || 20
        const halfAnnotationHeight = (annotationHeight / 2) | 0
        const xOffset = props.constants?.XOFFSET || 0

        for (const curAnn of anns) {
            // Invert if duration is negative
            let viewStart = curAnn.start
            let viewDuration = curAnn.duration
            if (curAnn.duration < 0) {
                viewStart = curAnn.start + curAnn.duration
                viewDuration = -curAnn.duration
            }

            const curAnnStart = xOffset + (viewStart - props.start) / props.rsPeriod
            curAnn.cStart = curAnnStart | 0

            if (curAnn.duration !== 0) {
                const curAnnEnd = xOffset + (viewStart + viewDuration - props.start) / props.rsPeriod
                curAnn.cEnd = curAnnEnd | 0
            } else {
                curAnn.cEnd = (curAnn.cStart + props.cWidth / 40) | 0
            }

            if (!curAnn.allChannels) {
                curAnn.allOffsets = []
                curAnn.minOffset = props.cHeight | 0
                curAnn.maxOffset = 0

                const channelConfig = viewerChannels.value
                for (const channelId of curAnn.channelIds) {
                    let channelOffset = null
                    for (const curChannelView of channelConfig) {
                        if (curChannelView.id === channelId && curChannelView.visible) {
                            channelOffset = curChannelView.rowBaseline | 0
                            if (channelOffset < curAnn.minOffset) curAnn.minOffset = channelOffset
                            if (channelOffset > curAnn.maxOffset) curAnn.maxOffset = channelOffset
                            console.log(channelOffset)
                            curAnn.allOffsets.push(channelOffset)
                            break
                        }
                    }
                }

                // Add to hoverOffsets
                if (hoverOffsets.value.indexOf(curAnn.minOffset) < 0) {
                    hoverOffsets.value.push(curAnn.minOffset)
                }
                curAnn.cY = curAnn.minOffset
            } else {
                curAnn.allOffsets = [halfAnnotationHeight]
                curAnn.cY = halfAnnotationHeight
            }
        }
    }

    const renderAnnotationAreas = (ctx, anns, props, pHeight) => {
        const annotationHeight = props.constants?.ANNOTATIONLABELHEIGHT || 20
        const halfAnnotationHeight = (annotationHeight / 2) | 0

        ctx.setTransform(props.pixelRatio, 0, 0, props.pixelRatio, 0, 0)
        ctx.save()
        ctx.lineWidth = 1
        ctx.setLineDash([8, 5])
        ctx.strokeStyle = 'rgba(0,0,0, 0.6)'
        ctx.fillStyle = 'rgba(0,0,0,0.05)'

        for (const curAnn of anns) {
            const curAnnLayer = getLayer(curAnn, viewerAnnotations.value)

            if (curAnn.selected) {
                ctx.save()
                ctx.strokeStyle = curAnnLayer.selColor
                ctx.fillStyle = curAnnLayer.bkColor
                ctx.lineWidth = 1
            }

            const curAnnStartRounded = Math.round(curAnn.cStart) + 0.5
            const curAnnEndRounded = Math.round(curAnn.cEnd) + 0.5

            if (curAnn.allChannels) {
                if (curAnn.duration === 0) {
                    // No duration - draw line
                    ctx.beginPath()
                    ctx.moveTo(curAnnStartRounded + 1, annotationHeight)
                    ctx.lineTo(curAnnStartRounded, pHeight)
                    ctx.stroke()
                } else {
                    // With duration - draw rectangle
                    ctx.fillRect(curAnnStartRounded, annotationHeight, curAnnEndRounded - curAnnStartRounded, pHeight - annotationHeight)
                    ctx.beginPath()
                    ctx.moveTo(curAnnStartRounded, annotationHeight)
                    ctx.lineTo(curAnnStartRounded, pHeight)
                    ctx.moveTo(curAnnEndRounded, annotationHeight)
                    ctx.lineTo(curAnnEndRounded, pHeight)
                    ctx.stroke()
                }
            } else if (curAnn?.channelIds?.length === 1) {
                // Single channel
                if (curAnn.duration === 0) {
                    ctx.beginPath()
                    ctx.moveTo(curAnnStartRounded, curAnn.minOffset + halfAnnotationHeight)
                    ctx.lineTo(curAnnStartRounded, curAnn.minOffset + halfAnnotationHeight + 8)
                    ctx.stroke()
                }
            } else {
                // Multiple channels
                if (curAnn.duration === 0) {
                    ctx.beginPath()
                    ctx.moveTo(curAnnStartRounded, curAnn.minOffset + halfAnnotationHeight)
                    ctx.lineTo(curAnnStartRounded, curAnn.maxOffset - halfAnnotationHeight)
                    ctx.stroke()
                } else {
                    ctx.fillRect(curAnnStartRounded - 1, curAnn.minOffset + halfAnnotationHeight,
                        curAnnEndRounded - curAnnStartRounded + 1, curAnn.maxOffset - curAnn.minOffset - annotationHeight)
                    ctx.beginPath()
                    ctx.moveTo(curAnnStartRounded, curAnn.minOffset + halfAnnotationHeight)
                    ctx.lineTo(curAnnStartRounded, curAnn.maxOffset - halfAnnotationHeight)
                    ctx.moveTo(curAnnEndRounded, curAnn.minOffset + halfAnnotationHeight)
                    ctx.lineTo(curAnnEndRounded, curAnn.maxOffset - halfAnnotationHeight)
                    ctx.stroke()
                }
            }

            if (curAnn.selected) {
                ctx.restore()
            }
        }
        ctx.restore()
    }

    const renderAnnotationLabels = async (ctx, anns, props, hideFocusedAnn, pointerMode, viewerActiveTool) => {
        const annotationHeight = props.constants?.ANNOTATIONLABELHEIGHT || 20
        const halfAnnotationHeight = (annotationHeight / 2) | 0

        ctx.setTransform(props.pixelRatio, 0, 0, props.pixelRatio, 0, 0)
        ctx.save()
        ctx.lineWidth = 2
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'left'

        for (const curAnn of anns) {
            const curAnnLayer = getLayer(curAnn, viewerAnnotations.value)

            if (curAnn === focusedAnn.value && hideFocusedAnn) {
                continue
            }

            // Set colors
            if (curAnn.selected) {
                ctx.fillStyle = curAnnLayer.selColor || 'rgba(51,204,102, 0.8)'
                ctx.strokeStyle = 'white'
            } else {
                ctx.fillStyle = curAnnLayer.color || 'rgba(51,204,102,0.8)'
                ctx.strokeStyle = curAnn === focusedAnn.value ? 'white' : 'rgba(255,255,255,0.8)'
            }

            const curAnnStartRounded = Math.round(curAnn.cStart) + 1
            const curAnnEndRounded = Math.round(curAnn.cEnd)

            // Render label backgrounds
            let minOffsetIdx = 0
            for (let i = 0; i < curAnn.allOffsets.length; i++) {
                ctx.fillRect(curAnnStartRounded - 1, curAnn.allOffsets[i] - halfAnnotationHeight,
                    curAnnEndRounded - curAnnStartRounded + 2, annotationHeight)
                if (curAnn.allOffsets[i] === curAnn.minOffset) {
                    minOffsetIdx = i
                }
            }

            // Render resize handles
            const firstOffset = curAnn.allOffsets[minOffsetIdx]
            if (['annSelect', 'annResize-left', 'annResize-right'].includes(pointerMode) && viewerActiveTool === "annotate") {
                ctx.beginPath()
                if (curAnn.duration !== 0) {
                    ctx.moveTo(curAnnEndRounded - 3, firstOffset - halfAnnotationHeight + 3)
                    ctx.lineTo(curAnnEndRounded - 3, firstOffset + halfAnnotationHeight - 3)
                }
                ctx.moveTo(curAnnStartRounded + 3, firstOffset - halfAnnotationHeight + 3)
                ctx.lineTo(curAnnStartRounded + 3, firstOffset + halfAnnotationHeight - 3)
                ctx.stroke()
            }

            // Render text
            if ((curAnnEndRounded - curAnnStartRounded) > ((curAnn.label.length * 8) + 10)) {
                ctx.fillStyle = a11yList.value.indexOf(curAnnLayer.hexColor) >= 0 ? 'black' : 'white'
                const textX = curAnn.linkedPackage ? curAnnStartRounded + 30 : curAnnStartRounded + 10
                const textY = curAnn.linkedPackage ?
                    firstOffset + halfAnnotationHeight - (halfAnnotationHeight / 2) :
                    firstOffset + halfAnnotationHeight - 6
                ctx.fillText(curAnn.label, textX, textY)
            }

            // Render linked package icon
            const linkedPackageDTO = curAnn.linkedPackageDTO
            if (linkedPackageDTO && (curAnnEndRounded - curAnnStartRounded) >= 30) {
                await renderLinkedPackageIcon(ctx, linkedPackageDTO, curAnnStartRounded, firstOffset, halfAnnotationHeight, annotationHeight)
            }
        }

        ctx.restore()
    }

    const renderLinkedPackageIcon = async (ctx, linkedPackageDTO, startX, offsetY, halfHeight, height) => {
        const preview = pathOr({}, ['objects', 'view', 1, 'content'], linkedPackageDTO)
        const fileType = propOr('', 'fileType', preview)
        const img = new Image()

        if (fileType === 'PNG') {
            const { id, packageId } = preview
            const apiUrl = config.value.apiUrl
            try {
                const token = await useGetToken()
                img.src = `${apiUrl}/packages/${packageId}/files/${id}/presign/?api_key=${token}`
                if (img.complete) {
                    ctx.drawImage(img, startX, offsetY - halfHeight, 27, height)
                } else {
                    img.addEventListener('load', () => {
                        ctx.drawImage(img, startX, offsetY - halfHeight, 27, height)
                    }, { once: true })
                }
            } catch (error) {
                console.error('Error loading image:', error)
            }
        } else {
            img.src = computeIcon(linkedPackageDTO)
            ctx.drawImage(img, startX + 5, offsetY - halfHeight, 20, 20)
        }
    }

    const computeIcon = (linkedPackageDTO) => {
        // Return appropriate icon based on package type
        return '/path/to/default/icon.png'
    }

    const render = (props, annotationsCanvas, annLabelArea, pHeight) => {
        if (!annotationsCanvas) {
            console.warn('TSAnnotationCanvas: annotationsCanvas prop is undefined or null')
            return
        }

        const ctxBk = annotationsCanvas.getContext('2d')
        const ctxLb = annLabelArea.getContext('2d')
        ctxBk.setTransform(props.pixelRatio, 0, 0, props.pixelRatio, 0, 0)
        ctxLb.setTransform(props.pixelRatio, 0, 0, props.pixelRatio, 0, 0)

        // Initialize hover offsets
        hoverOffsets.value = [(props.constants?.ANNOTATIONLABELHEIGHT || 20) / 2]

        // Clear canvas
        ctxBk.clearRect(0, 0, props.cWidth, props.cHeight)
        ctxLb.clearRect(0, 0, props.cWidth, props.cHeight)

        // Clear render array
        renderAnn.value = []

        // FIX: Ensure we have a valid viewport duration before proceeding
        const viewportDuration = props.duration && props.duration > 0 ? props.duration : 15000000 // 15 seconds fallback
        const viewportStart = props.start || 0
        const viewportEnd = viewportStart + viewportDuration

        console.log('🎨 Annotation render debug:', {
            start: viewportStart,
            duration: viewportDuration,
            end: viewportEnd,
            layerCount: viewerAnnotations.value?.length || 0,
            totalAnnotations: viewerAnnotations.value?.reduce((sum, layer) => sum + (layer.annotations?.length || 0), 0) || 0
        })

        // Populate render array from visible layers
        for (const curLayer of viewerAnnotations.value) {
            if (curLayer.visible && curLayer.annotations?.length > 0) {
                console.log(`🔍 Processing layer "${curLayer.name}" with ${curLayer.annotations.length} annotations`)

                // FIX: Use a more robust approach to find annotations in viewport
                // Instead of relying on annIndexOf which might be buggy, use simple filtering
                const annotationsInViewport = curLayer.annotations.filter(ann => {
                    const annStart = ann.start
                    const annEnd = ann.end || (ann.start + (ann.duration || 0))

                    // Include annotation if it overlaps with viewport at all
                    const overlaps = (annStart < viewportEnd) && (annEnd > viewportStart)

                    if (overlaps) {
                        console.log(`  ✅ Including annotation "${ann.label}": ${annStart} - ${annEnd}`)
                    }

                    return overlaps
                })

                console.log(`  📊 Found ${annotationsInViewport.length} annotations in viewport`)

                if (annotationsInViewport.length > 0) {
                    // Sort by start time for consistent rendering order
                    annotationsInViewport.sort((a, b) => a.start - b.start)
                    renderAnn.value.push(...annotationsInViewport)
                }
            }
        }

        console.log(`🎯 Total annotations to render: ${renderAnn.value.length}`)

        // Only proceed if we have annotations to render
        if (renderAnn.value.length === 0) {
            console.log('⚠️ No annotations found in viewport')
            return
        }

        // Sort all annotations by start time
        sortAnnotations(renderAnn.value)
        computeRenderOptions(renderAnn.value, props)

        // Render
        renderAnnotationAreas(ctxBk, renderAnn.value, props, pHeight)
        renderAnnotationLabels(ctxLb, renderAnn.value, props, true, props.pointerMode, props.viewerActiveTool)

        // Render focused annotation
        if (focusedAnn.value) {
            renderAnnotationLabels(ctxLb, [focusedAnn.value], props, false, props.pointerMode, props.viewerActiveTool)
        }

        console.log(`✅ Rendered ${renderAnn.value.length} annotations successfully`)
    }

    return {
        renderAnn,
        hoverOffsets,
        focusedAnn,
        render,
        computeRenderOptions,
        renderAnnotationAreas,
        renderAnnotationLabels
    }
}