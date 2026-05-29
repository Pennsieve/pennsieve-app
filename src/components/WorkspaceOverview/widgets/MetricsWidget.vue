<template>
  <slot :widgetName="widgetName" :childIcons="[]" />
  <div class="metrics-widget">
    <div v-for="metric in metrics" :key="metric.label" class="stat-row">
      <span class="stat-label">{{ metric.label }}</span>
      <span class="stat-value">{{ resolve(metric) }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useStore } from 'vuex'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  // Each metric is one of:
  //   { label: 'Datasets', storePath: 'datasetModule.datasetTotalCount' }
  //   { label: 'Members',  storePath: 'orgMembers', length: true }
  //   { label: 'Foo',      bindedKey: 'fooValue' }   // legacy globalData
  metrics: { type: Array, default: () => [] },
  widgetName: { type: String, default: 'At a glance' },
  widgetID: { type: String, default: '' },
  hideHeader: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
})

const store = useStore()
// Fallback: legacy globalData binding via the dashboard's inject.
const gv = inject('dashboard:globalVars', null)

// Reactive evaluator. Reads from Vuex directly when `storePath` is given —
// avoids the dashboard library's globalData sync pipeline (which collapses
// rapid sequential dispatches and can show a stale intermediate value).
const readStorePath = (path) => {
  if (!path) return undefined
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), store.state)
}

const cache = computed(() =>
  props.metrics.map((m) => {
    if (m.storePath) {
      const v = readStorePath(m.storePath)
      return m.length ? (Array.isArray(v) ? v.length : 0) : v
    }
    if (m.bindedKey) {
      return gv?.getValue?.(m.bindedKey)
    }
    return m.value
  })
)

const resolve = (metric) => {
  const idx = props.metrics.indexOf(metric)
  const v = cache.value[idx]
  if (v === null || v === undefined) return '—'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return v
}
</script>

<style scoped lang="scss">
.metrics-widget {
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
</style>
