<template>
  <div v-if="hasHistory" class="section">
    <div class="section-header">
      <h3>Record History</h3>
      <div class="header-actions">
        <!-- Timeline Navigation Buttons (always visible, disabled when not available) -->
        <el-button
          @click="goBackward"
          :disabled="!canGoBackward"
          link
          size="small"
          class="timeline-nav-btn-header"
          :title="canGoBackward ? 'Go to previous version' : 'No previous version available'"
        >
          ←
        </el-button>
        
        <el-button
          @click="goForward"
          :disabled="!canGoForward"
          link
          size="small"
          class="timeline-nav-btn-header"
          :title="canGoForward ? 'Go to next version' : 'No next version available'"
        >
          →
        </el-button>
      </div>
    </div>

    <div class="timeline-container">
      <div 
        class="timeline-track" 
        ref="timelineTrackRef"
        @mousemove="handleTimelineMouseMove"
        @mouseleave="handleTimelineMouseLeave"
        @click="handleTimelineTrackClick"
      >
        <!-- Load more history button (left side) -->
        <div v-if="historyHasMore" class="load-more-history-inline">
          <el-button 
            @click="loadMoreHistory"
            :loading="historyLoading"
            link
            size="small"
            class="load-more-btn-inline"
            :title="historyLoading ? 'Loading older versions...' : 'Fetch older versions'"
          >
            <span v-if="historyLoading">⟳</span>
            <span v-else>⋯</span>
          </el-button>
        </div>

        <!-- Timeline continuation indicator (shows when nodes are filtered) -->
        <div v-if="showTimelineContinuation" class="timeline-continuation-inline" @click.stop>
          <el-button 
            @click="clearTimelineCutoff"
            link
            size="small"
            class="timeline-continuation-btn-inline"
            title="Show all timeline nodes"
          >
            <span>⋯</span>
          </el-button>
        </div>


        <!-- Timeline Mode Toggle Button (positioned left of Current button) -->
        <div v-if="showTimelineModeToggle" class="timeline-mode-toggle-inline" @click.stop>
          <el-button 
            @click="toggleTimelineMode"
            link
            size="small"
            class="timeline-mode-toggle-btn-inline"
            :title="timelineMode === 'history' ? 'Expand to now' : 'Switch to history mode'"
          >
            <span v-if="timelineMode === 'history'">⤵⤴</span>
            <span v-else>⤴⤵</span>
          </el-button>
        </div>

        <!-- Current version button (always visible on right side) -->
        <div class="go-to-latest-inline" @click.stop>
          <el-button 
            @click="goToLatestVersion"
            link
            size="small"
            :class="['go-to-latest-btn-inline', { 'is-current': isCurrentVersion }]"
            title="Current version - latest packages and relationships"
          >
            <span>Current</span>
          </el-button>
        </div>
        
        <!-- Timeline cursor for hover/click -->
        <div
          v-if="timelineCursor.visible && recordHistory.length > 1"
          class="timeline-cursor"
          :style="{ left: `${timelineCursor.position}%` }"
        >
          <div class="timeline-cursor-line"></div>
          <div class="timeline-cursor-tooltip">
            {{ formatTimestamp(timelineCursor.timestamp) }}
          </div>
        </div>
        
        <!-- Active timepoint marker for selected timestamp -->
        <div
          v-if="activeTimepoint"
          class="active-timepoint"
          :style="{ left: `${activeTimepoint.position}%` }"
        >
          <div class="active-timepoint-line"></div>
        </div>
        
        <!-- Timeline tick marks -->
        <div
          v-for="(tick, index) in timelineTicks"
          :key="`tick-${index}`"
          class="timeline-tick"
          :style="{ left: `${tick.position}%` }"
          :title="tick.label"
        >
          <div class="timeline-tick-mark"></div>
        </div>
        
        <!-- Timeline nodes -->
        <div
          v-for="(historyItem, index) in timelineData"
          :key="`history-${index}`"
          class="timeline-node"
          :class="{
            'is-current': historyItem.isCurrent,
            'is-highlighted': historyItem.isHighlighted,
            'clickable': !historyItem.isCurrent
          }"
          :style="{ left: `${historyItem.position}%` }"
          :title="`${historyItem.isCurrent ? 'Current version' : 'Previous version'} - ${formatTimestamp(historyItem.created_at)}`"
          @click="!historyItem.isCurrent && handleTimelineClick(historyItem)"
          @dblclick="!historyItem.isCurrent && goToHistoryRecord(historyItem)"
        >
          <div class="timeline-dot"></div>
          <div v-if="historyItem.isCurrent" class="timeline-label">
            <span class="timeline-date">{{ new Date(historyItem.created_at).toLocaleDateString() }}</span>
            <span class="timeline-current-indicator">{{ new Date(historyItem.created_at).toLocaleTimeString() }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, toRefs } from 'vue'
import { ElButton } from 'element-plus'

const props = defineProps({
  recordHistory: {
    type: Array,
    required: true
  },
  historyHasMore: {
    type: Boolean,
    default: false
  },
  historyLoading: {
    type: Boolean,
    default: false
  },
  previewTimestamp: {
    type: String,
    default: null
  },
  timelineCutoffTimestamp: {
    type: String,
    default: null
  },
  asOf: {
    type: String,
    default: null
  },
  record: {
    type: Object,
    default: null
  }
})

const emit = defineEmits([
  'preview-record',
  'go-to-history-record',
  'load-more-history',
  'go-to-latest-version',
  'clear-timeline-cutoff',
  'timeline-track-click'
])

// Template refs
const timelineTrackRef = ref(null)

// Timeline cursor state for click-anywhere functionality
const timelineCursor = ref({
  visible: false,
  position: 0,
  timestamp: null,
  x: 0
})

// Single click timeout for distinguishing single vs double click
let clickTimeout = null

// Timeline mode: 'history' (full history with latest on right) or 'future' (latest on left, extends to now)
const timelineMode = ref('history')

// Navigation state for forward/backward buttons
const currentHistoryIndex = computed(() => {
  if (!props.previewTimestamp || !props.recordHistory.length) return -1
  
  const sortedHistory = [...props.recordHistory].sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  )
  
  return sortedHistory.findIndex(item => item.created_at === props.previewTimestamp)
})

// Computed properties
const hasHistory = computed(() => props.recordHistory.length > 0)

// Navigation availability
const canGoBackward = computed(() => {
  return currentHistoryIndex.value > 0 || props.historyHasMore
})

const canGoForward = computed(() => {
  const sortedHistory = [...props.recordHistory].sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  )
  // Can go forward if we're on a specific node (not current) - either to next node or to "Current"
  return currentHistoryIndex.value >= 0
})

// Show timeline mode toggle button when we have history and latest node is showing
const showTimelineModeToggle = computed(() => {
  // Show button when we have history and the latest node is visible (not cut off by timeline cutoff)
  if (!hasHistory.value) return false
  
  // If there's a timeline cutoff, check if the latest node is visible
  if (props.timelineCutoffTimestamp) {
    const latestNode = [...props.recordHistory].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    )[0]
    
    if (latestNode) {
      const latestTime = new Date(latestNode.created_at).getTime()
      const cutoffTime = new Date(props.timelineCutoffTimestamp).getTime()
      return latestTime <= cutoffTime
    }
  }
  
  return true // Show by default when we have history and no cutoff restrictions
})

const isCurrentVersion = computed(() => {
  return (!props.asOf || props.asOf === '') && !props.previewTimestamp
})

// Active timepoint marker state for showing selected timestamp
const activeTimepoint = computed(() => {
  if (!props.previewTimestamp || !props.recordHistory.length) return null
  
  // Check if preview timestamp matches any existing node
  const matchingNode = props.recordHistory.find(h => h.created_at === props.previewTimestamp)
  if (matchingNode) return null // Don't show marker if there's already a node
  
  // Calculate position for the active timepoint
  if (props.recordHistory.length < 2) return null
  
  const sortedHistory = [...props.recordHistory].sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  )
  
  let startTime, endTime, totalSpan
  
  if (timelineMode.value === 'future') {
    // In future mode, timeline spans from oldest record to current time  
    const oldestTime = new Date(sortedHistory[0].created_at).getTime()
    const currentTime = new Date().getTime()
    startTime = oldestTime
    endTime = currentTime
    totalSpan = endTime - startTime
    
    // Ensure minimum span
    if (totalSpan <= 0) {
      totalSpan = 24 * 60 * 60 * 1000 // 24 hours minimum
      endTime = startTime + totalSpan
    }
  } else {
    // History mode: original behavior
    startTime = new Date(sortedHistory[0].created_at).getTime()
    endTime = new Date(sortedHistory[sortedHistory.length - 1].created_at).getTime()
    totalSpan = endTime - startTime
  }
  
  if (totalSpan === 0) return null
  
  const previewTime = new Date(props.previewTimestamp).getTime()
  const timeFromStart = previewTime - startTime
  const position = 5 + ((timeFromStart / totalSpan) * 83)  // Match timeline node positioning
  
  // Only show if position is within timeline bounds
  if (position < 5 || position > 88) return null
  
  return {
    position,
    timestamp: props.previewTimestamp
  }
})

// Timeline computed properties
const timelineData = computed(() => {
  if (!props.recordHistory.length) return []
  
  // API returns records in reverse chronological order (newest first)
  // We need to sort them by created_at ascending (oldest to newest) to position correctly
  let sortedHistory = [...props.recordHistory].sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  )
  
  // Apply cutoff timestamp if set (filter out newer nodes)
  if (props.timelineCutoffTimestamp) {
    const cutoffTime = new Date(props.timelineCutoffTimestamp).getTime()
    sortedHistory = sortedHistory.filter(h => 
      new Date(h.created_at).getTime() <= cutoffTime
    )
  }
  
  // Calculate positions based on actual time differences with current version on the right side
  if (sortedHistory.length === 1) {
    // Single version - position at 88% (right side)
    const historyRecord = sortedHistory[0]
    
    // Apply the same priority logic as multiple versions for consistency
    let isCurrent = false
    let isHighlighted = false
    
    // Priority 1: Preview timestamp (from clicking timeline or between nodes)
    if (props.previewTimestamp) {
      if (historyRecord.created_at === props.previewTimestamp) {
        isCurrent = true
      } else {
        isHighlighted = true // Single node representing preview data at different time
      }
    }
    // Priority 2: AsOf parameter (from URL navigation) - only if no preview
    else if (props.asOf) {
      if (historyRecord.created_at === props.asOf) {
        isCurrent = true
      }
    }
    // Priority 3: Current mode (no preview, no asOf) - only if neither above
    else {
      isHighlighted = true // Single node always represents current data
    }
    
    return [{
      ...historyRecord,
      position: 88, // Adjusted for reduced timeline width
      isCurrent,
      isHighlighted,
      index: 0
    }]
  }
  
  // Multiple versions - distribute based on actual time differences
  const oldestTime = new Date(sortedHistory[0].created_at).getTime()
  const newestTime = new Date(sortedHistory[sortedHistory.length - 1].created_at).getTime()
  const currentTime = new Date().getTime()
  
  let totalTimespan
  let startTime
  let endTime
  
  if (timelineMode.value === 'future') {
    // Future mode: latest node on left, timeline extends to current time
    startTime = newestTime
    endTime = currentTime
    totalTimespan = endTime - startTime
    
    // If the latest record is from the future or very recent, ensure we have some timeline span
    if (totalTimespan <= 0) {
      totalTimespan = 24 * 60 * 60 * 1000 // 24 hours minimum span
      endTime = startTime + totalTimespan
    }
  } else {
    // History mode: oldest to newest (original behavior)
    startTime = oldestTime
    endTime = newestTime
    totalTimespan = endTime - startTime
  }
  
  return sortedHistory.map((historyRecord, index) => {
    const recordTime = new Date(historyRecord.created_at).getTime()
    
    let position
    if (timelineMode.value === 'future') {
      // Future mode positioning: latest record at left (5%), timeline extends to current time
      if (totalTimespan === 0) {
        // All records are at the same time - position at left
        position = 5
      } else {
        // In future mode, older records should still be positioned to the left of newer records
        // So we need to calculate their position relative to the oldest record, not the newest
        const timeFromOldest = recordTime - oldestTime
        const historicalTimespan = newestTime - oldestTime
        
        if (historicalTimespan === 0) {
          // All historical records have same timestamp, position them at left
          position = 5
        } else {
          // Position historical records proportionally within the left portion of timeline
          // Use only a small portion (like 20%) for historical records, rest extends to future
          const historicalPortion = Math.min(0.2, historicalTimespan / (historicalTimespan + (currentTime - newestTime)))
          position = 5 + (timeFromOldest / historicalTimespan) * (historicalPortion * 83)
        }
      }
    } else {
      // History mode positioning (original behavior)
      if (totalTimespan === 0) {
        // All records have the same timestamp - use equal spacing within reduced timeline width
        position = 5 + ((index / (sortedHistory.length - 1)) * 83)
      } else {
        // Position based on actual time difference from oldest within timeline width
        const timeFromOldest = recordTime - startTime
        position = 5 + ((timeFromOldest / totalTimespan) * 83)
      }
    }
    
    // Determine if this node should appear as current or highlighted
    // STRICT: Only one node can have highlighting at a time
    let isCurrent = false
    let isHighlighted = false
    
    console.log(`Node ${historyRecord.created_at}: preview=${props.previewTimestamp}, asOf=${props.asOf}`)
    
    // ABSOLUTE PRIORITY: Only the first matching condition executes
    if (props.previewTimestamp && historyRecord.created_at === props.previewTimestamp) {
      // Case 1: Exact preview match - gets isCurrent
      isCurrent = true
      console.log(`Node ${historyRecord.created_at}: CURRENT (preview exact)`)
    }
    else if (props.previewTimestamp) {
      // Case 2: Preview exists but this node doesn't match - check if nearest
      const previewTime = new Date(props.previewTimestamp).getTime()
      const nodeTime = new Date(historyRecord.created_at).getTime()
      
      if (nodeTime <= previewTime) {
        const nearestNode = sortedHistory
          .filter(h => new Date(h.created_at).getTime() <= previewTime)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
        
        if (nearestNode?.created_at === historyRecord.created_at) {
          isHighlighted = true
          console.log(`Node ${historyRecord.created_at}: HIGHLIGHTED (preview nearest)`)
        }
      }
    }
    else if (props.asOf && historyRecord.created_at === props.asOf) {
      // Case 3: AsOf exact match - gets isCurrent
      isCurrent = true
      console.log(`Node ${historyRecord.created_at}: CURRENT (asOf exact)`)
    }
    else if (!props.previewTimestamp && !props.asOf) {
      // Case 4: Current mode - behave like as_of=now(), highlight latest chronological node
      const latestNode = sortedHistory[sortedHistory.length - 1]
      if (latestNode.created_at === historyRecord.created_at) {
        isHighlighted = true
        console.log(`Node ${historyRecord.created_at}: HIGHLIGHTED (current latest)`)
      }
    }
    
    return {
      ...historyRecord,
      position,
      isCurrent,
      isHighlighted,
      index
    }
  })
})

// Determine if we should show the '...' indicator (when timeline is cut off)
const showTimelineContinuation = computed(() => {
  if (!props.timelineCutoffTimestamp) return false
  
  // Check if there are any nodes that were filtered out from the original history
  const originalHistory = [...(props.recordHistory || [])]
  
  const cutoffTime = new Date(props.timelineCutoffTimestamp).getTime()
  const filteredOutNodes = originalHistory.filter(h => 
    new Date(h.created_at).getTime() > cutoffTime
  )
  
  return filteredOutNodes.length > 0
})

// Timeline tick marks based on time span
const timelineTicks = computed(() => {
  if (!props.recordHistory.length || props.recordHistory.length < 2) return []
  
  const sortedHistory = [...props.recordHistory].sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  )
  
  let startTime, endTime, totalSpan
  
  if (timelineMode.value === 'future') {
    // In future mode, timeline spans from oldest record to current time
    const oldestTime = new Date(sortedHistory[0].created_at).getTime()
    const currentTime = new Date().getTime()
    startTime = new Date(oldestTime)
    endTime = new Date(currentTime)
    totalSpan = endTime.getTime() - startTime.getTime()
    
    // Ensure minimum span for tick generation
    if (totalSpan <= 0) {
      totalSpan = 24 * 60 * 60 * 1000 // 24 hours minimum
      endTime = new Date(startTime.getTime() + totalSpan)
    }
  } else {
    // History mode: original behavior
    startTime = new Date(sortedHistory[0].created_at)
    endTime = new Date(sortedHistory[sortedHistory.length - 1].created_at)
    totalSpan = endTime.getTime() - startTime.getTime()
  }
  
  // Define time spans in milliseconds
  const MINUTE = 60 * 1000
  const HOUR = 60 * MINUTE
  const DAY = 24 * HOUR
  const MONTH = 30 * DAY
  const YEAR = 365 * DAY
  
  // Get actual timeline width from DOM element
  const actualTimelineWidth = timelineTrackRef.value?.clientWidth || 800
  // Timeline spans from 5% to 88% = 83% of the actual timeline width (matching node positioning)
  const usableTimelineWidth = actualTimelineWidth * 0.83
  const minTickSpacing = 50 // minimum 50px between ticks
  const maxTicks = Math.floor(usableTimelineWidth / minTickSpacing)
  
  // Define possible intervals in order from smallest to largest
  const intervals = [
    { span: MINUTE, format: (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { span: 5 * MINUTE, format: (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { span: 10 * MINUTE, format: (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { span: 15 * MINUTE, format: (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { span: 30 * MINUTE, format: (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { span: HOUR, format: (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { span: 2 * HOUR, format: (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { span: 3 * HOUR, format: (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { span: 6 * HOUR, format: (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { span: 12 * HOUR, format: (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    { span: DAY, format: (date) => date.toLocaleDateString([], { month: 'short', day: 'numeric' }) },
    { span: 2 * DAY, format: (date) => date.toLocaleDateString([], { month: 'short', day: 'numeric' }) },
    { span: 3 * DAY, format: (date) => date.toLocaleDateString([], { month: 'short', day: 'numeric' }) },
    { span: 7 * DAY, format: (date) => date.toLocaleDateString([], { month: 'short', day: 'numeric' }) },
    { span: 14 * DAY, format: (date) => date.toLocaleDateString([], { month: 'short', day: 'numeric' }) },
    { span: MONTH, format: (date) => date.toLocaleDateString([], { month: 'short', year: 'numeric' }) },
    { span: 2 * MONTH, format: (date) => date.toLocaleDateString([], { month: 'short', year: 'numeric' }) },
    { span: 3 * MONTH, format: (date) => date.toLocaleDateString([], { month: 'short', year: 'numeric' }) },
    { span: 6 * MONTH, format: (date) => date.toLocaleDateString([], { month: 'short', year: 'numeric' }) },
    { span: YEAR, format: (date) => date.getFullYear().toString() },
    { span: 2 * YEAR, format: (date) => date.getFullYear().toString() },
    { span: 5 * YEAR, format: (date) => date.getFullYear().toString() },
    { span: 10 * YEAR, format: (date) => date.getFullYear().toString() }
  ]
  
  // Find the best interval that gives us <= maxTicks
  let bestInterval = intervals[intervals.length - 1] // default to largest interval
  for (const interval of intervals) {
    const estimatedTicks = Math.ceil(totalSpan / interval.span)
    if (estimatedTicks <= maxTicks) {
      bestInterval = interval
      break
    }
  }
  
  const tickInterval = bestInterval.span
  const tickFormat = bestInterval.format
  
  // Generate tick marks - start from proper time boundaries
  let currentTick = new Date(startTime)
  let ticks = []
  
  // Align to appropriate time boundary based on interval
  if (tickInterval >= YEAR) {
    // Year-based intervals - align to January 1st
    currentTick.setMonth(0, 1)
    currentTick.setHours(0, 0, 0, 0)
    currentTick.setFullYear(currentTick.getFullYear() + 1)
  } else if (tickInterval >= MONTH) {
    // Month-based intervals - align to 1st of month
    currentTick.setDate(1)
    currentTick.setHours(0, 0, 0, 0)
    currentTick.setMonth(currentTick.getMonth() + 1)
  } else if (tickInterval >= DAY) {
    // Day-based intervals - align to midnight
    currentTick.setHours(0, 0, 0, 0)
    currentTick.setTime(currentTick.getTime() + DAY)
  } else if (tickInterval >= HOUR) {
    // Hour-based intervals - align to top of hour
    currentTick.setMinutes(0, 0, 0)
    currentTick.setTime(currentTick.getTime() + HOUR)
  } else {
    // Minute-based intervals - align to top of minute
    currentTick.setSeconds(0, 0)
    currentTick.setTime(currentTick.getTime() + MINUTE)
  }
  
  // Generate ticks without arbitrary cap - let density control handle it
  while (currentTick.getTime() <= endTime.getTime()) {
    const timeRatio = (currentTick.getTime() - startTime.getTime()) / totalSpan
    const position = 5 + (timeRatio * 83)  // Match timeline node positioning (83% range)
    
    // Only add tick if it's within the timeline range (don't go beyond 88%)
    if (position <= 88) {
      ticks.push({
        date: new Date(currentTick),
        position,
        label: tickFormat(currentTick)
      })
    }
    
    // Move to next tick based on interval
    if (tickInterval >= YEAR) {
      currentTick.setFullYear(currentTick.getFullYear() + (tickInterval / YEAR))
    } else if (tickInterval >= MONTH) {
      currentTick.setMonth(currentTick.getMonth() + (tickInterval / MONTH))
    } else {
      // For sub-month intervals, use millisecond addition
      currentTick.setTime(currentTick.getTime() + tickInterval)
    }
    
    // Safety break to prevent infinite loops
    if (ticks.length > 100) break
  }
  
  return ticks
})

// Methods
const formatTimestamp = (timestamp) => {
  try {
    return new Date(timestamp).toLocaleString()
  } catch {
    return timestamp
  }
}

// Calculate timestamp from mouse position on timeline
const calculateTimestampFromPosition = (mouseX, timelineElement) => {
  if (!props.recordHistory.length || props.recordHistory.length < 2) return null
  
  const rect = timelineElement.getBoundingClientRect()
  const relativeX = mouseX - rect.left
  const percentage = (relativeX / rect.width) * 100
  
  // Clamp percentage to extended timeline bounds (5% to 92% to match extended baseline)
  const clampedPercentage = Math.max(5, Math.min(92, percentage))
  
  // Convert percentage to timestamp - need different logic for future vs history mode
  const sortedHistory = [...props.recordHistory].sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  )
  
  let startTime, endTime, totalSpan
  
  if (timelineMode.value === 'future') {
    // In future mode, timeline spans from oldest record to current time
    const oldestTime = new Date(sortedHistory[0].created_at).getTime()
    const currentTime = new Date().getTime()
    startTime = oldestTime
    endTime = currentTime
    totalSpan = endTime - startTime
    
    // Ensure minimum span
    if (totalSpan <= 0) {
      totalSpan = 24 * 60 * 60 * 1000 // 24 hours minimum
      endTime = startTime + totalSpan
    }
  } else {
    // History mode: original behavior
    startTime = new Date(sortedHistory[0].created_at).getTime()
    endTime = new Date(sortedHistory[sortedHistory.length - 1].created_at).getTime()
    totalSpan = endTime - startTime
  }
  
  // Convert from visual percentage (5-88%) to time ratio (0-100%)
  const timeRatio = (clampedPercentage - 5) / 83
  const timestamp = new Date(startTime + (totalSpan * timeRatio))
  
  return {
    timestamp: timestamp.toISOString(),
    position: clampedPercentage,
    x: relativeX
  }
}

// Handle timeline track mouse move for cursor
const handleTimelineMouseMove = (event) => {
  // Don't show cursor if hovering over a timeline node or other timeline elements
  if (event.target.closest('.timeline-node') || 
      event.target.closest('.load-more-history-inline') || 
      event.target.closest('.go-to-latest-inline') ||
      event.target.closest('.timeline-continuation-inline') ||
      event.target.closest('.timeline-tick')) {
    timelineCursor.value.visible = false
    return
  }
  
  // Only show cursor if hovering directly over the timeline track
  if (event.target.classList.contains('timeline-track') || 
      event.target === timelineTrackRef.value) {
    const result = calculateTimestampFromPosition(event.clientX, event.target)
    if (result) {
      timelineCursor.value = {
        visible: true,
        position: result.position,
        timestamp: result.timestamp,
        x: result.x
      }
    }
  } else {
    timelineCursor.value.visible = false
  }
}

// Handle timeline track mouse leave
const handleTimelineMouseLeave = () => {
  timelineCursor.value.visible = false
}

// Handle timeline track click for preview at timestamp
const handleTimelineTrackClick = async (event) => {
  const result = calculateTimestampFromPosition(event.clientX, event.target)
  if (!result) return
  
  emit('timeline-track-click', result.timestamp)
}

// Handle single click with delayed execution to allow double-click to cancel
const handleTimelineClick = (historyRecord) => {
  // Clear any existing timeout
  if (clickTimeout) {
    clearTimeout(clickTimeout)
  }
  
  // Set a timeout to execute the preview after 200ms
  // This gives time for a potential double-click to cancel it
  clickTimeout = setTimeout(() => {
    emit('preview-record', historyRecord)
    clickTimeout = null
  }, 200)
}

// Timeline navigation - set cutoff to selected timestamp (double click)
const goToHistoryRecord = (historyRecord) => {
  // Cancel any pending preview timeout
  if (clickTimeout) {
    clearTimeout(clickTimeout)
    clickTimeout = null
  }
  
  emit('go-to-history-record', historyRecord)
}

// Load more history versions
const loadMoreHistory = () => {
  emit('load-more-history')
}

// Navigate to the latest version of the record
const goToLatestVersion = () => {
  emit('go-to-latest-version')
}

// Clear timeline cutoff
const clearTimelineCutoff = () => {
  emit('clear-timeline-cutoff')
}

// Toggle timeline mode between history and future
const toggleTimelineMode = () => {
  timelineMode.value = timelineMode.value === 'history' ? 'future' : 'history'
}

// Navigate to previous version
const goBackward = async () => {
  if (!canGoBackward.value) return
  
  const sortedHistory = [...props.recordHistory].sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  )
  
  // If we're currently on "Current" (no preview timestamp), go to the latest/most recent node
  if (!props.previewTimestamp && sortedHistory.length > 0) {
    const latestRecord = sortedHistory[sortedHistory.length - 1]
    emit('preview-record', latestRecord)
    return
  }
  
  const previousIndex = currentHistoryIndex.value - 1
  
  // If we can navigate to a previous record in current history
  if (previousIndex >= 0) {
    const previousRecord = sortedHistory[previousIndex]
    emit('preview-record', previousRecord)
  }
  // If we're at the beginning of current history but there's more history to load
  else if (props.historyHasMore) {
    // Load more history and automatically navigate to the oldest currently loaded record
    // This will trigger the "..." load more, and after it completes, we'll navigate to the oldest record
    emit('load-more-history')
    
    // Navigate to the oldest currently loaded record (which will be the "next backward" step after loading)
    if (sortedHistory.length > 0) {
      const oldestCurrentRecord = sortedHistory[0]
      emit('preview-record', oldestCurrentRecord)
    }
  }
}

// Navigate to next version
const goForward = () => {
  if (!canGoForward.value) return
  
  const sortedHistory = [...props.recordHistory].sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  )
  
  const nextIndex = currentHistoryIndex.value + 1
  const nextRecord = sortedHistory[nextIndex]
  
  if (nextRecord) {
    // Go to the next node in history
    emit('preview-record', nextRecord)
  } else {
    // We're on the latest node - go to "Current" (clear preview)
    emit('go-to-latest-version')
  }
}
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;

.section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid theme.$gray_2;

    h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: theme.$gray_6;
    }
    
    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      
      // Timeline Navigation Buttons in header styling
      .timeline-nav-btn-header {
        padding: 2px 8px !important;
        height: 20px;
        border-radius: 10px;
        background: theme.$gray_1 !important;
        border: 1px solid theme.$gray_3 !important;
        color: theme.$gray_5 !important;
        font-size: 12px;
        font-weight: 500;
        min-height: unset !important;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        
        &:hover:not(:disabled) {
          background: theme.$orange_tint !important;
          border-color: theme.$orange_2 !important;
          color: theme.$orange_2 !important;
          transform: scale(1.05);
        }
        
        &:disabled {
          background: theme.$gray_1 !important;
          border-color: theme.$gray_2 !important;
          color: theme.$gray_4 !important;
          cursor: not-allowed;
          opacity: 0.6;
        }
      }

      // Timeline Mode Toggle Button styling
      .timeline-mode-toggle-btn {
        padding: 2px 8px !important;
        height: 20px;
        border-radius: 10px;
        background: theme.$gray_1 !important;
        border: 1px solid theme.$gray_3 !important;
        color: theme.$gray_5 !important;
        font-size: 12px;
        font-weight: 500;
        min-height: unset !important;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        
        &:hover {
          background: theme.$purple_tint !important;
          border-color: theme.$purple_2 !important;
          color: theme.$purple_2 !important;
          transform: scale(1.05);
        }
        
        span {
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
      }
    }
  }
}

// Timeline styling
.timeline-container {
  margin: 16px 0;
  padding: 20px 0;
}

.timeline-track {
  position: relative;
  height: 60px;
  cursor: crosshair;

  // Timeline baseline - extend beyond last node for click interaction (75px from right)
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 10px;
    right: 75px; // Extended beyond last node but stops before ... indicator for better click interaction
    height: 2px;
    background: theme.$gray_3;
    transform: translateY(-50%);
  }
}

// Timeline cursor styling for click-anywhere functionality
.timeline-cursor {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 5;
  pointer-events: none;
  
  .timeline-cursor-line {
    width: 2px;
    height: 40px;
    background: theme.$orange_2;
    border-radius: 1px;
    opacity: 0.8;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .timeline-cursor-tooltip {
    position: absolute;
    top: -35px;
    left: 50%;
    transform: translateX(-50%);
    background: theme.$orange_2;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    
    // Arrow pointing down
    &::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-top: 4px solid theme.$orange_2;
    }
  }
}

// Active timepoint marker styling for selected timestamp
.active-timepoint {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 4;
  pointer-events: none;
  
  .active-timepoint-line {
    width: 2px;
    height: 30px;
    background: theme.$purple_2;
    border-radius: 1px;
    opacity: 0.8;
    box-shadow: 0 1px 4px rgba(102, 76, 204, 0.2);
  }
}

// Timeline tick marks styling
.timeline-tick {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  
  .timeline-tick-mark {
    width: 1px;
    height: 8px;
    background: theme.$gray_4;
    opacity: 0.6;
    transition: all 0.2s ease;
  }
  
  &:hover {
    .timeline-tick-mark {
      opacity: 1;
      background: theme.$gray_5;
      height: 12px;
    }
  }
}

.timeline-node {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;

  &.clickable {
    cursor: pointer;
    
    &:hover {
      .timeline-dot {
        transform: scale(1.2);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }
      
      .timeline-label {
        opacity: 1;
      }
    }
  }

  .timeline-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: theme.$gray_4;
    border: 2px solid white;
    transition: all 0.2s ease;
    margin: 0 auto;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  &.is-current .timeline-dot {
    background: theme.$purple_2;
    border-color: theme.$purple_2;
    width: 16px;
    height: 16px;
    box-shadow: 0 2px 6px rgba(102, 76, 204, 0.3);
  }
  
  // Highlighted nodes (nearest lower date without big label)
  &.is-highlighted .timeline-dot {
    background: theme.$purple_1;
    border-color: theme.$purple_1;
    width: 14px;
    height: 14px;
    box-shadow: 0 2px 4px rgba(102, 76, 204, 0.2);
  }

  .timeline-label {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 8px;
    font-size: 11px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    z-index: 10;

    .timeline-date {
      display: block;
      font-weight: 500;
    }

    .timeline-current-indicator {
      display: block;
      color: theme.$purple_1;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
  }

  &.is-current .timeline-label {
    opacity: 1;
    top: 25px; // Below the timeline for current version
    color: theme.$white;
    background: theme.$purple_2;

    // Arrow pointing up for labels below timeline
    &::after {
      content: '';
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-bottom: 4px solid theme.$purple_2;
    }

    .timeline-current-indicator {
      color: white;
    }
  }

  // Show labels on hover for non-current nodes
  &:not(.is-current):hover {
    z-index: 1000 !important; // Much higher than any other element
    
    .timeline-label {
      opacity: 1;
      z-index: 1000 !important;
      top: -45px; // Position above the timeline instead of below
      color: theme.$purple_2;
      background: transparent;
      
      // Arrow pointing down for labels above timeline
      &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 4px solid theme.$purple_2;
      }
    }
  }
}

// Inline load more history button styling
.load-more-history-inline {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;

  .load-more-btn-inline {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: theme.$gray_1 !important;
    border: 1px solid theme.$gray_3 !important;
    color: theme.$gray_5 !important;
    font-size: 14px;
    font-weight: 400;
    padding: 0 !important;
    min-height: unset !important;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    
    &:hover {
      background: theme.$purple_tint !important;
      border-color: theme.$purple_2 !important;
      color: theme.$purple_2 !important;
      transform: scale(1.1);
    }
    
    &:disabled {
      color: theme.$gray_4 !important;
      background-color: theme.$gray_1 !important;
      border-color: theme.$gray_3 !important;
      cursor: not-allowed;
    }
    
    span {
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      animation: none;
    }
    
    // Rotating animation for loading state
    &:disabled span:first-child {
      animation: spin 1s linear infinite;
    }
  }
}

// Timeline continuation indicator styling (between timeline and Current button)
.timeline-continuation-inline {
  position: absolute;
  right: 65px; // Position with more spacing from Current button to avoid overlap
  top: 50%;
  transform: translateY(-50%);
  z-index: 4;

  .timeline-continuation-btn-inline {
    width: 24px;
    height: 20px;
    border-radius: 10px;
    background: theme.$gray_1 !important;
    border: 1px solid theme.$gray_3 !important;
    color: theme.$gray_5 !important;
    font-size: 12px;
    font-weight: 400;
    padding: 0 !important;
    min-height: unset !important;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    
    &:hover {
      background: theme.$orange_tint !important;
      border-color: theme.$orange_2 !important;
      color: theme.$orange_2 !important;
      transform: scale(1.05);
    }
    
    span {
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      letter-spacing: 0.5px;
    }
  }
}


// Timeline Mode Toggle Button styling (positioned left of Current button)
.timeline-mode-toggle-inline {
  position: absolute;
  right: 75px; // Position between timeline and Current button
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;

  .timeline-mode-toggle-btn-inline {
    padding: 2px 8px !important;
    height: 20px;
    border-radius: 10px;
    background: theme.$gray_1 !important;
    border: 1px solid theme.$gray_3 !important;
    color: theme.$gray_5 !important;
    font-size: 12px;
    font-weight: 500;
    min-height: unset !important;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    
    &:hover {
      background: theme.$purple_tint !important;
      border-color: theme.$purple_2 !important;
      color: theme.$purple_2 !important;
      transform: scale(1.05);
    }
    
    span {
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      font-family: monospace; // Use monospace for better symbol alignment
      vertical-align: middle;
      margin-top: -1px; // Fine-tune vertical positioning for angle brackets
    }
  }
}

// Go to latest version button styling (right side)
.go-to-latest-inline {
  position: absolute;
  right: 10px; // Give proper space from the right edge
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;

  .go-to-latest-btn-inline {
    padding: 2px 8px !important;
    height: 20px;
    border-radius: 10px;
    background: theme.$purple_tint !important;
    border: 1px solid theme.$purple_2 !important;
    color: theme.$purple_2 !important;
    font-size: 10px;
    font-weight: 500;
    min-height: unset !important;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    
    &:hover {
      background: theme.$purple_2 !important;
      border-color: theme.$purple_2 !important;
      color: white !important;
      transform: scale(1.05);
    }
    
    &.is-current {
      background: theme.$purple_3 !important;
      border-color: theme.$purple_3 !important;
      color: white !important;
      transform: scale(1.05);
      
      &:hover {
        background: theme.$purple_2 !important;
        border-color: theme.$purple_2 !important;
      }
    }
    
    span {
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>