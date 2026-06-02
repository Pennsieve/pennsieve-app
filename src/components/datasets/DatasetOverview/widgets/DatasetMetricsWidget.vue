<template>
  <slot :widgetName="widgetName" :childIcons="[]" />
  <div class="dataset-metrics">
    <div class="stat-row">
      <span class="stat-label">Files</span>
      <span class="stat-value">{{ formatNum(fileCount) }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Storage</span>
      <span class="stat-value">{{ storageDisplay }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Records</span>
      <span class="stat-value">{{ formatNum(recordCount) }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Contributors</span>
      <span class="stat-value">{{ formatNum(contributorCount) }}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">License</span>
      <span class="stat-value text">{{ datasetLicense || '—' }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from 'vuex'
import { pathOr } from 'ramda'
import { getLicenseAbbr } from '@/utils/license-util'

defineOptions({ inheritAttrs: false })

defineProps({
  widgetName: { type: String, default: 'At a glance' },
  widgetID: { type: String, default: '' },
  hideHeader: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
})

const store = useStore()

const dataset = computed(() => store.state.dataset || {})

const fileCount = computed(() => {
  const counts = pathOr({}, ['packageTypeCounts'], dataset.value)
  return Object.values(counts).filter(Number.isFinite).reduce((s, n) => s + n, 0)
})

const recordCount = computed(() => store.getters?.totalRecordsCount || 0)

const contributorCount = computed(() => {
  const list = store.state?.datasetContributors
  return Array.isArray(list) ? list.length : 0
})

// Show the short abbreviation (e.g. "CC-BY-4.0") instead of the full
// license name, which is often too long for the narrow widget column.
// Falls back to the raw value if no abbreviation is registered.
const datasetLicense = computed(() => {
  const raw = pathOr('', ['content', 'license'], dataset.value)
  return getLicenseAbbr(raw) || raw
})

const storageBytes = computed(() => pathOr(0, ['content', 'storage'], dataset.value))

const storageDisplay = computed(() => formatBytes(storageBytes.value))

// Mirror the formatting in mixins/bf-storage-metrics so the value
// reads consistently with the rest of the app.
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${Math.round(n * 100) / 100} ${units[i]}`
}

function formatNum(n) {
  if (n === null || n === undefined) return '—'
  if (typeof n === 'number') return n.toLocaleString('en')
  return String(n)
}
</script>

<style scoped lang="scss">
.dataset-metrics {
  padding: 4px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 4px 0;
}

.stat-row + .stat-row {
  border-top: 1px solid var(--dash-widget-border-soft, #f5f6f7);
}

.stat-label {
  font-size: 13px;
  color: var(--dash-text-medium, #555);
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--dash-text-dark, #1c1c1c);
  letter-spacing: -0.2px;
}

.stat-value.text {
  font-size: 14px;
  font-weight: 500;
}
</style>
