<script setup>
import { computed, toRef } from 'vue'
import { useMetricsExport } from '@/composables/useMetricsExport'
import { useMetricsCounters } from '@/composables/useMetricsCounters'
import SparkHistogram from './SparkHistogram.vue'

const props = defineProps({
  filterColumn: {
    type: String,
    required: true,
  },
  filterValue: {
    type: String,
    required: true,
  },
  vertical: {
    type: Boolean,
    default: false,
  },
  hideHeader: {
    type: Boolean,
    default: false,
  },
})

// Histograms: loaded in background from parquet/DuckDB
const {
  isLoading: histogramLoading,
  error: histogramError,
  durationBins,
  costBins,
  totalRuns: histogramTotalRuns,
  medianDuration,
  medianCost,
  refresh,
} = useMetricsExport({
  filterColumn: toRef(props, 'filterColumn'),
  filterValue: toRef(props, 'filterValue'),
  viewerId: `metrics_${props.filterColumn}`,
})

// Counters: instant summary from DynamoDB
const { counters, isLoading: countersLoading, error: countersError, fetchCounters } = useMetricsCounters({
  scope: toRef(props, 'filterColumn'),
  id: toRef(props, 'filterValue'),
})

const counterTotalRuns = computed(() => counters.value?.allTime?.totalRuns ?? 0)
const displayTotalRuns = computed(() => counterTotalRuns.value || histogramTotalRuns.value)
const avgDuration = computed(() => {
  const c = counters.value?.allTime
  if (c && c.totalRuns) return c.totalDurationSec / c.totalRuns
  return medianDuration.value
})
const avgCost = computed(() => {
  const c = counters.value?.allTime
  if (c && c.totalRuns) return c.totalCost / c.totalRuns
  return medianCost.value
})
const hasData = computed(() => counterTotalRuns.value > 0 || durationBins.value.length > 0 || costBins.value.length > 0)

const formatDuration = (v) => {
  if (v == null) return '--'
  if (v < 1) return `${(v * 1000).toFixed(0)}ms`
  if (v < 60) return `${v.toFixed(1)}s`
  if (v < 3600) return `${(v / 60).toFixed(1)}m`
  return `${(v / 3600).toFixed(1)}h`
}

const formatCost = (v) => {
  if (v == null) return '--'
  if (v < 0.01) return `$${v.toFixed(4)}`
  if (v < 1) return `$${v.toFixed(3)}`
  return `$${v.toFixed(2)}`
}
</script>

<template>
  <div class="metrics-dashboard" :class="{ vertical, 'hide-header': hideHeader }">
    <div v-if="!hideHeader" class="metrics-header">
      <span class="metrics-title">Metrics</span>
    </div>

    <!-- Loading (both sources still loading) -->
    <div v-if="countersLoading && histogramLoading" class="metrics-state">
      <span>Loading metrics...</span>
    </div>

    <!-- Empty (neither source has data) -->
    <div v-else-if="!hasData && !countersLoading && !histogramLoading" class="metrics-state">
      <span>No metrics data available</span>
    </div>

    <!-- Data -->
    <div v-else class="metrics-panels">
      <!-- Summary card (from counters — loads instantly) -->
      <div class="metrics-panel summary-panel">
        <div class="summary-stat">
          <span class="stat-value">{{ displayTotalRuns }}</span>
          <span class="stat-label">Total Runs</span>
        </div>
        <div class="summary-divider" />
        <div class="summary-stat">
          <span class="stat-value">{{ formatDuration(avgDuration) }}</span>
          <span class="stat-label">Avg Duration</span>
        </div>
        <div class="summary-divider" />
        <div class="summary-stat">
          <span class="stat-value">{{ formatCost(avgCost) }}</span>
          <span class="stat-label">Avg Cost</span>
        </div>
      </div>

      <!-- Duration histogram (from parquet/DuckDB — loads in background) -->
      <div class="metrics-panel chart-panel">
        <div v-if="histogramLoading" class="histogram-loading">Loading distribution...</div>
        <div v-else-if="histogramError" class="histogram-error">{{ histogramError }}</div>
        <SparkHistogram
          v-else
          :bins="durationBins"
          label="Duration Distribution"
          color="#7C3AED"
          :width="280"
          :height="100"
          :format-fn="formatDuration"
        />
      </div>

      <!-- Cost histogram -->
      <div class="metrics-panel chart-panel">
        <div v-if="histogramLoading" class="histogram-loading">Loading distribution...</div>
        <div v-else-if="histogramError" class="histogram-error">{{ histogramError }}</div>
        <SparkHistogram
          v-else
          :bins="costBins"
          label="Cost Distribution"
          color="#2563EB"
          :width="280"
          :height="100"
          :format-fn="formatCost"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";

.metrics-dashboard {
  background: theme.$white;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;

  &.hide-header {
    border: none;
    border-radius: 0;
  }
}

.metrics-header {
  padding: 8px 12px;
  border-bottom: 1px solid theme.$gray_3;
}

.metrics-title {
  font-weight: 600;
  font-size: 13px;
  color: theme.$black;
}


.metrics-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px 12px;
  color: theme.$gray_4;
  font-size: 12px;
}

.metrics-error {
  color: theme.$status_red;
}

.metrics-retry {
  background: none;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  color: theme.$purple_3;
  cursor: pointer;

  &:hover {
    background: theme.$gray_1;
  }
}

.metrics-panels {
  display: flex;

  .vertical & {
    flex-direction: column;
  }
}

.metrics-panel {
  border-right: 1px solid theme.$gray_3;
  padding: 10px 12px;

  &:last-child {
    border-right: none;
  }

  .vertical & {
    border-right: none;
    border-bottom: 1px solid theme.$gray_3;

    &:last-child {
      border-bottom: none;
    }
  }
}

.summary-panel {
  flex: 0 0 140px;
  display: flex;
  flex-direction: column;
  justify-content: center;

  .vertical & {
    flex: none;
    flex-direction: row;
    justify-content: space-evenly;
  }
}

.chart-panel {
  flex: 1;
  min-width: 0;

  :deep(.spark-histogram) {
    width: 100%;
  }

  :deep(svg) {
    width: 100%;
    height: auto;
  }
}

.summary-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0;
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: theme.$black;
  line-height: 1.2;
}

.stat-label {
  font-size: 9px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: theme.$gray_4;
  margin-top: 1px;
}

.summary-divider {
  height: 1px;
  background: theme.$gray_2;
  margin: 0 8px;

  .vertical & {
    height: auto;
    width: 1px;
    margin: 4px 0;
  }
}

.histogram-loading,
.histogram-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  font-size: 11px;
  color: theme.$gray_4;
}

.histogram-error {
  color: theme.$status_red;
}
</style>
