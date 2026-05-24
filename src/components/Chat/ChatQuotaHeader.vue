<template>
  <div
    v-if="show"
    class="quota-header"
    :class="[`level-${level}`, { expanded }]"
  >
    <!-- Collapsed row — always visible. -->
    <button
      type="button"
      class="collapsed-row"
      :aria-expanded="expanded"
      :aria-label="ariaLabel"
      @click="toggle"
    >
      <span class="meter" :class="`level-${level}`" aria-hidden="true">
        <span class="meter-fill" :style="{ width: dailyPct + '%' }" />
      </span>
      <span class="caption">
        <template v-if="loading && !quota">Checking your LLM quota…</template>
        <template v-else-if="!quota">Quota unavailable</template>
        <template v-else>
          <strong>${{ fmt(quota.dailySpentUsd) }}</strong>
          <span class="sep">/</span>
          ${{ fmt(quota.dailyCostUsd) }} today
        </template>
      </span>
      <span v-if="level === 'over'" class="pill pill-over">Limit reached</span>
      <span v-else-if="level === 'near'" class="pill pill-near">Near limit</span>
      <svg
        class="chevron"
        :class="{ flipped: expanded }"
        width="10"
        height="10"
        viewBox="0 0 10 10"
        aria-hidden="true"
      >
        <path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none" />
      </svg>
    </button>

    <!-- Expanded panel — three axes + source attribution + manage link. -->
    <div v-if="expanded && quota" class="expanded">
      <div class="axis">
        <div class="axis-head">
          <span class="axis-label">Daily</span>
          <span class="axis-numbers">
            <strong>${{ fmt(quota.dailySpentUsd) }}</strong> / ${{ fmt(quota.dailyCostUsd) }}
          </span>
        </div>
        <span class="meter" aria-hidden="true">
          <span class="meter-fill" :class="`level-${dailyLevel}`" :style="{ width: dailyPct + '%' }" />
        </span>
        <span class="axis-source">{{ sourceLabel(quota.dailySource) }}</span>
      </div>

      <div class="axis">
        <div class="axis-head">
          <span class="axis-label">Monthly</span>
          <span class="axis-numbers">
            <strong>${{ fmt(quota.monthlySpentUsd) }}</strong> / ${{ fmt(quota.monthlyCostUsd) }}
          </span>
        </div>
        <span class="meter" aria-hidden="true">
          <span class="meter-fill" :class="`level-${monthlyLevel}`" :style="{ width: monthlyPct + '%' }" />
        </span>
        <span class="axis-source">{{ sourceLabel(quota.monthlySource) }}</span>
      </div>

      <div class="axis flat">
        <div class="axis-head">
          <span class="axis-label">Per workflow</span>
          <span class="axis-numbers">max ${{ fmt(quota.perWorkflowUsd) }}</span>
        </div>
        <span class="axis-source">{{ sourceLabel(quota.perWorkflowSource) }}</span>
      </div>

      <div class="footnote">
        Daily resets at 00:00 UTC.
        <a v-if="manageHref" :href="manageHref" class="manage-link">Manage quotas →</a>
      </div>
      <div v-if="error" class="error-note">Couldn't refresh: {{ error.message }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

// ChatQuotaHeader surfaces the user's per-(user, compute-node) LLM cost
// quota at the top of the chat panel. Collapsed by default — auto-expands
// once when the user hits the "over" warning level so they understand why
// the next turn was blocked. Pure presentation; the parent panel wires up
// the data via useChatQuota.
const props = defineProps({
  // The quota state returned by /effective. null while loading or after a
  // fetch error; the component renders a "Checking your LLM quota…" caption
  // in that case.
  quota: { type: Object, default: null },
  // True while a fetch is in flight. Only used to distinguish "still
  // loading" from "no quota state available" in the collapsed caption.
  loading: { type: Boolean, default: false },
  // { message: string } when the most recent fetch failed. Surfaced in the
  // expanded panel as a subtle note; doesn't block the meter rendering with
  // the previous quota state.
  error: { type: Object, default: null },
  // Optional deep-link target shown only to compute-node owners (parent
  // gates visibility based on the user's ownership of the active node).
  manageHref: { type: String, default: '' },
})

const expanded = ref(false)
const autoExpandedOnce = ref(false)

const toggle = () => {
  expanded.value = !expanded.value
}

const fmt = (n) => {
  if (typeof n !== 'number') return '0.00'
  // 2 decimal places for the common case (whole dollars look weirder than
  // $1.00 when sitting next to $0.42). Cap at 4 to keep the bar from going
  // wide on micro-amounts.
  if (n >= 1) return n.toFixed(2)
  return n.toFixed(Math.min(4, Math.max(2, Math.ceil(-Math.log10(Math.max(n, 1e-6))) + 2)))
}

const NEAR = 0.8
const OVER = 1.0
const axisLevel = (spent, cap) => {
  if (!cap || cap <= 0) return 'ok'
  const u = spent / cap
  if (u >= OVER) return 'over'
  if (u >= NEAR) return 'near'
  return 'ok'
}
const dailyLevel = computed(() =>
  props.quota ? axisLevel(props.quota.dailySpentUsd, props.quota.dailyCostUsd) : 'ok',
)
const monthlyLevel = computed(() =>
  props.quota ? axisLevel(props.quota.monthlySpentUsd, props.quota.monthlyCostUsd) : 'ok',
)
// Overall level is the worse of the two — drives the header tint + auto-open.
const level = computed(() => {
  const lv = [dailyLevel.value, monthlyLevel.value]
  if (lv.includes('over')) return 'over'
  if (lv.includes('near')) return 'near'
  return 'ok'
})

// Auto-expand once on hitting the "over" state so users see exactly which
// axis tripped without having to click the chevron. Only auto-opens once
// per session — if the user closes the panel after being warned, we don't
// nag them by reopening on the next render.
watch(level, (lv) => {
  if (lv === 'over' && !autoExpandedOnce.value) {
    expanded.value = true
    autoExpandedOnce.value = true
  }
})

const dailyPct = computed(() => {
  if (!props.quota) return 0
  const u = props.quota.dailyCostUsd
    ? props.quota.dailySpentUsd / props.quota.dailyCostUsd
    : 0
  return Math.min(100, Math.max(0, Math.round(u * 100)))
})
const monthlyPct = computed(() => {
  if (!props.quota) return 0
  const u = props.quota.monthlyCostUsd
    ? props.quota.monthlySpentUsd / props.quota.monthlyCostUsd
    : 0
  return Math.min(100, Math.max(0, Math.round(u * 100)))
})

const sourceLabel = (src) => {
  switch (src) {
    case 'user':
      return 'Custom limit set for you'
    case 'node-default':
      return 'Set by the compute node owner'
    case 'platform-safety':
      return 'Pennsieve default (no custom limit set)'
    default:
      return ''
  }
}

const show = computed(() => props.loading || !!props.quota || !!props.error)
const ariaLabel = computed(() => {
  if (!props.quota) return 'LLM quota'
  return `LLM quota — $${fmt(props.quota.dailySpentUsd)} of $${fmt(props.quota.dailyCostUsd)} used today`
})
</script>

<style scoped lang="scss">
@use 'sass:color';
@use '../../styles/theme';

.quota-header {
  border-bottom: 1px solid #ececec;
  font-size: 12px;
  background: #fafbfc;

  &.level-near {
    background: color.mix(#fff3d6, #fafbfc, 60%);
  }
  &.level-over {
    background: color.mix(#fde0e0, #fafbfc, 55%);
  }
}

.collapsed-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 16px;
  background: transparent;
  border: 0;
  cursor: pointer;
  text-align: left;
  color: #444;

  &:hover {
    background: rgba(0, 0, 0, 0.02);
  }
  &:focus-visible {
    outline: 2px solid theme.$purple_3;
    outline-offset: -2px;
  }
}

.caption {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  strong {
    color: #222;
    font-weight: 600;
  }
  .sep {
    color: #aaa;
    margin: 0 3px;
  }
}

.meter {
  display: inline-block;
  position: relative;
  width: 120px;
  height: 6px;
  border-radius: 3px;
  background: #e6e8eb;
  overflow: hidden;
  flex-shrink: 0;
}
.meter-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: theme.$purple_3;
  border-radius: 3px;
  transition: width 0.25s ease;

  &.level-near {
    background: #d99416;
  }
  &.level-over {
    background: #c64545;
  }
}
.collapsed-row .meter.level-near .meter-fill {
  background: #d99416;
}
.collapsed-row .meter.level-over .meter-fill {
  background: #c64545;
}

.pill {
  display: inline-flex;
  align-items: center;
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}
.pill-near {
  background: #fff3d6;
  color: #8a5a0c;
}
.pill-over {
  background: #fde0e0;
  color: #8a2222;
}

.chevron {
  flex-shrink: 0;
  color: #888;
  transition: transform 0.15s ease;
  &.flipped {
    transform: rotate(180deg);
  }
}

.expanded {
  padding: 8px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid #eee;
}

.axis {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .meter {
    width: 100%;
  }

  &.flat .meter {
    display: none;
  }
}

.axis-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.axis-label {
  font-weight: 600;
  color: #444;
}

.axis-numbers {
  color: #666;
  font-variant-numeric: tabular-nums;
  strong {
    color: #222;
    font-weight: 600;
  }
}

.axis-source {
  color: #888;
  font-size: 11px;
}

.footnote {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2px;
  color: #888;
}

.manage-link {
  color: theme.$purple_3;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
}

.error-note {
  color: #8a2222;
  font-size: 11px;
}
</style>
