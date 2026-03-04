import { ref, watch, onBeforeUnmount, toValue } from 'vue'
import { useStore } from 'vuex'
import { useDuckDBStore } from '@/stores/duckdbStore'
import { useGetToken } from '@/composables/useGetToken'

const METRICS_TABLE = 'workflow_metrics'
const METRICS_FILE_ID = 'metrics_export'
const NUM_BINS = 10

/**
 * Generic composable for loading and querying workflow metrics.
 *
 * @param {Object} options
 * @param {import('vue').Ref<string>} options.filterColumn - e.g. 'sourceUrl', 'workflowUuid'
 * @param {import('vue').Ref<string>} options.filterValue  - the value to match
 * @param {string} options.viewerId - unique ID for DuckDB connection tracking
 */
export function useMetricsExport({ filterColumn, filterValue, viewerId = 'metrics_viewer' }) {
  const store = useStore()
  const duckdb = useDuckDBStore()

  const isLoading = ref(false)
  const error = ref(null)
  const durationBins = ref([])
  const costBins = ref([])
  const totalRuns = ref(0)
  const medianDuration = ref(null)
  const medianCost = ref(null)

  let connectionId = null

  const escapeSqlString = (val) => String(val).replace(/'/g, "''")

  const fetchExportUrl = async () => {
    const token = await useGetToken()
    const api2Url = store.state.config.api2Url
    const orgId = store.state.activeOrganization?.organization?.id
    const resp = await fetch(
      `${api2Url}/compute/workflows/metrics/export?organization_id=${encodeURIComponent(orgId)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    if (!resp.ok) {
      throw new Error(`Failed to fetch metrics export (${resp.status})`)
    }
    const data = await resp.json()
    return data.url
  }

  const loadParquet = async () => {
    const parquetUrl = await fetchExportUrl()
    await duckdb.loadFile(
      parquetUrl,
      'parquet',
      METRICS_TABLE,
      {},
      viewerId,
      METRICS_FILE_ID
    )
  }

  const buildHistogramQuery = (metricColumn, col, val) => {
    const safeVal = escapeSqlString(val)
    return `
      WITH filtered AS (
        SELECT ${metricColumn} AS val FROM ${METRICS_TABLE}
        WHERE "${col}" = '${safeVal}' AND ${metricColumn} IS NOT NULL
      ),
      stats AS (
        SELECT
          MIN(val) AS mn,
          MAX(val) AS mx,
          COUNT(*) AS total,
          MEDIAN(val) AS med
        FROM filtered
      ),
      bins AS (
        SELECT
          LEAST(FLOOR((val - mn) / ((mx - mn + 0.001) / ${NUM_BINS})), ${NUM_BINS} - 1) + 1 AS bucket,
          COUNT(*) AS count
        FROM filtered, stats
        WHERE total > 0
        GROUP BY bucket
        ORDER BY bucket
      )
      SELECT
        mn + (bucket - 1) * ((mx - mn) / ${NUM_BINS}.0) AS binStart,
        mn + bucket * ((mx - mn) / ${NUM_BINS}.0) AS binEnd,
        count,
        total,
        med,
        mn,
        mx
      FROM bins, stats
    `
  }

  const runPipeline = async () => {
    const col = toValue(filterColumn)
    const val = toValue(filterValue)
    if (!col || !val) return

    isLoading.value = true
    error.value = null
    durationBins.value = []
    costBins.value = []
    totalRuns.value = 0
    medianDuration.value = null
    medianCost.value = null

    try {
      // Ensure parquet is loaded (cached after first call)
      await loadParquet()

      // Create a connection for querying
      if (!connectionId) {
        const conn = await duckdb.createConnection(viewerId)
        connectionId = conn.connectionId


      }

      // Duration histogram
      const durationQuery = buildHistogramQuery('executionTimeSec', col, val)
      const durationRows = await duckdb.executeQuery(durationQuery, connectionId)

      if (durationRows.length > 0) {
        durationBins.value = durationRows.map((r) => ({
          binStart: Number(r.binStart),
          binEnd: Number(r.binEnd),
          count: Number(r.count),
        }))
        totalRuns.value = Number(durationRows[0].total)
        medianDuration.value = Number(durationRows[0].med)
      }

      // Cost histogram
      const costQuery = buildHistogramQuery('totalEstimatedCost', col, val)
      const costRows = await duckdb.executeQuery(costQuery, connectionId)

      if (costRows.length > 0) {
        costBins.value = costRows.map((r) => ({
          binStart: Number(r.binStart),
          binEnd: Number(r.binEnd),
          count: Number(r.count),
        }))
        medianCost.value = Number(costRows[0].med)
        // Use cost total if duration had no rows
        if (totalRuns.value === 0) {
          totalRuns.value = Number(costRows[0].total)
        }
      }
    } catch (err) {
      console.error('Metrics pipeline error:', err)
      error.value = err.message || 'Failed to load metrics'
    } finally {
      isLoading.value = false
    }
  }

  const refresh = async () => {
    // Force re-fetch by unloading the cached file first
    if (duckdb.isFileLoaded(METRICS_FILE_ID)) {
      await duckdb.unloadFile(METRICS_FILE_ID)
    }
    await runPipeline()
  }

  // Watch filterValue — trigger pipeline when non-empty
  watch(
    () => toValue(filterValue),
    (val) => {
      if (val) runPipeline()
    },
    { immediate: true }
  )

  // Clean up DuckDB connection on unmount
  onBeforeUnmount(async () => {
    if (connectionId) {
      try {
        await duckdb.closeConnection(connectionId)
      } catch (e) {
        console.warn('Failed to close metrics connection:', e)
      }
      connectionId = null
    }
  })

  return {
    isLoading,
    error,
    durationBins,
    costBins,
    totalRuns,
    medianDuration,
    medianCost,
    refresh,
  }
}
