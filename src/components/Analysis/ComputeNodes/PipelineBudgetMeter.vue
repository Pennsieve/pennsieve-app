<template>
  <!--
    Renders nothing when the node imposes no limits. That is not an edge case:
    every customer-owned node is unconfigured, because pipeline compute runs in
    the owner's own cloud account and capping is opt-in. Showing a row of
    "unlimited" bars there would be noise on the majority of nodes.
  -->
  <div v-if="show" class="pipeline-budget" :class="[`level-${level}`, { expanded }]">
    <button
      type="button"
      class="collapsed-row"
      :aria-expanded="expanded"
      :aria-label="ariaLabel"
      @click="expanded = !expanded"
    >
      <span class="meter" :class="`level-${level}`" aria-hidden="true">
        <span class="meter-fill" :style="{ width: worstPct + '%' }" />
      </span>
      <span class="caption">
        <template v-if="loading && !budget">Checking pipeline budget…</template>
        <template v-else-if="!budget">Budget unavailable</template>
        <template v-else-if="tightest">
          <strong>{{ tightestSummary }}</strong>
          <span class="suffix"> · {{ tightest.label }}</span>
        </template>
      </span>

      <span v-if="blocked" class="pill pill-over">{{ blockedPill }}</span>
      <span v-else-if="level === 'near'" class="pill pill-near">Near limit</span>

      <svg class="chevron" :class="{ flipped: expanded }" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none" />
      </svg>
    </button>

    <div v-if="expanded" class="expanded">
      <!--
        The reason comes from the backend, which words it per axis. Shown
        verbatim rather than reconstructed, so the message a user sees matches
        the one the gate produced.
      -->
      <p v-if="blocked && reason" class="blocked-reason">{{ reason }}</p>

      <div v-for="axis in spendAxes" :key="axis.key" class="axis">
        <div class="axis-head">
          <span class="axis-label">
            {{ axis.label }}
            <span class="axis-source" :title="sourceTitle(axis.source)">{{ sourceShort(axis.source) }}</span>
          </span>
          <span class="axis-numbers">
            <!--
              An explicit $0 cap means runs are switched off here, not that an
              allowance was consumed. "$0.00 of $0.00" reads as nonsense.
            -->
            <template v-if="axis.disabled">Disabled</template>
            <template v-else>
              <strong>${{ fmtUsd(axis.spentUsd) }}</strong> / ${{ fmtUsd(axis.limitUsd) }}
            </template>
          </span>
        </div>
        <span class="meter" :class="`level-${axisLevel(axis)}`" aria-hidden="true">
          <span class="meter-fill" :style="{ width: pct(axis.utilization) + '%' }" />
        </span>
        <p v-if="!axis.disabled" class="axis-foot">
          ${{ fmtUsd(axis.remainingUsd) }} left · resets {{ fmtReset(axis.resetsAt) }}
        </p>
      </div>

      <div v-for="axis in concurrencyAxes" :key="axis.key" class="axis">
        <div class="axis-head">
          <span class="axis-label">
            {{ axis.label }}
            <span class="axis-source" :title="sourceTitle(axis.source)">{{ sourceShort(axis.source) }}</span>
          </span>
          <span class="axis-numbers">
            <template v-if="axis.disabled">Disabled</template>
            <template v-else><strong>{{ axis.active }}</strong> / {{ axis.limit }}</template>
          </span>
        </div>
        <span class="meter" :class="`level-${axisLevel(axis)}`" aria-hidden="true">
          <span class="meter-fill" :style="{ width: pct(axis.utilization) + '%' }" />
        </span>
        <!--
          No reset time here on purpose: a concurrency limit clears when a run
          finishes, not on a clock, so a timestamp would be a lie.
        -->
        <p v-if="!axis.disabled" class="axis-foot">
          {{ axis.remaining }} slot{{ axis.remaining === 1 ? '' : 's' }} free
        </p>
      </div>

      <p v-if="perRunUsd !== null" class="per-run">
        Any single run is capped at <strong>${{ fmtUsd(perRunUsd) }}</strong>.
      </p>

      <!--
        The remedy depends on which axis blocked, and the four cases imply
        genuinely different actions. Getting this wrong sends someone to
        register a compute node when they just need to wait 30 seconds.
      -->
      <p v-if="blocked" class="remedy">{{ remedy }}</p>

      <a v-if="manageHref && blocked && isNodeSpendBlock" class="manage" :href="manageHref">
        Register your own compute node
      </a>

      <p v-if="error" class="fetch-error">Couldn’t refresh budget — showing last known figures.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// PipelineBudgetMeter shows how much pipeline spend and run capacity is left on
// a compute node. Pure presentation — the parent wires it up from
// pipelineBudgetStore, matching how ChatQuotaHeader is fed.
//
// Distinct from the LLM quota meter on purpose. The two families have different
// defaults (LLM axes fall back to a small platform cap; pipeline axes are
// unlimited unless an operator configures them), so merging them into one meter
// would imply limits that don't exist.
const props = defineProps({
  // The budget endpoint's 200 body. null while loading or after a failure.
  budget: { type: Object, default: null },
  // Only capped axes, already filtered by the store — an unlimited axis is
  // absent rather than present-with-nulls, so this template never decides
  // whether to draw a bar.
  spendAxes: { type: Array, default: () => [] },
  concurrencyAxes: { type: Array, default: () => [] },
  // 'unknown' | 'unenforced' | 'ok' | 'near' | 'over'
  level: { type: String, default: 'unknown' },
  perRunUsd: { type: Number, default: null },
  loading: { type: Boolean, default: false },
  error: { type: Object, default: null },
  // Deep link to compute-node registration. Only shown when a *node* spend cap
  // is the blocker — a dedicated node does not help a user who is merely at
  // their own concurrency limit.
  manageHref: { type: String, default: '' },
})

const expanded = ref(false)

const hasAxes = computed(() => props.spendAxes.length > 0 || props.concurrencyAxes.length > 0)

// Render while loading so the meter doesn't pop in, but stay hidden entirely
// for an unenforced node.
const show = computed(() => {
  if (props.level === 'unenforced') return false
  return props.loading || hasAxes.value || Boolean(props.error)
})

const blocked = computed(() => props.budget?.allowed === false)
const reason = computed(() => props.budget?.reason || '')
const axisKey = computed(() => props.budget?.blockedAxis || '')

const isConcurrencyBlock = computed(() => axisKey.value.endsWith('concurrency'))
const isNodeSpendBlock = computed(() => axisKey.value.startsWith('node-') && !isConcurrencyBlock.value)

const blockedPill = computed(() => (isConcurrencyBlock.value ? 'At run limit' : 'Budget reached'))

// The four remedies. Node spend → the pot is shared and empty, so waiting or
// bringing your own node. User spend → your slice is spent; an owner can raise
// it. Concurrency → purely transient.
const remedy = computed(() => {
  if (!blocked.value) return ''
  if (isConcurrencyBlock.value) {
    return 'Wait for one of the running pipelines to finish, then try again.'
  }
  if (isNodeSpendBlock.value) {
    return 'This node’s shared budget is spent. Wait for the reset, or register your own compute node for sustained work.'
  }
  return 'Your allowance on this node is spent. Wait for the reset, or ask the node owner to raise your limit.'
})

// The axis closest to its ceiling — what a submission will actually hit first,
// and so what belongs in the collapsed row.
const tightest = computed(() => {
  const all = [...props.spendAxes, ...props.concurrencyAxes]
  if (!all.length) return null
  return all.reduce((worst, a) => (a.utilization > worst.utilization ? a : worst), all[0])
})

const tightestSummary = computed(() => {
  const a = tightest.value
  if (!a) return ''
  if (a.disabled) return 'Disabled'
  return a.limitUsd !== undefined
    ? `$${fmtUsd(a.remainingUsd)} left`
    : `${a.remaining} of ${a.limit} runs free`
})

const worstPct = computed(() => pct(tightest.value?.utilization ?? 0))

const ariaLabel = computed(() => {
  if (blocked.value) return `Pipeline budget: ${blockedPill.value}. ${reason.value}`
  return `Pipeline budget: ${tightestSummary.value}. Select to expand.`
})

const pct = (u) => Math.max(0, Math.min(100, Math.round((u || 0) * 100)))

const axisLevel = (axis) => {
  if (axis.utilization >= 1) return 'over'
  if (axis.utilization >= 0.8) return 'near'
  return 'ok'
}

// Money here can be fractions of a cent — pipeline runs are frequently under
// $0.01 — so fixed 2dp would render most real values as "$0.00".
const fmtUsd = (n) => {
  if (typeof n !== 'number') return '0.00'
  if (n >= 1) return n.toFixed(2)
  if (n === 0) return '0.00'
  return n.toFixed(4)
}

const fmtReset = (iso) => {
  if (!iso) return 'soon'
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return 'soon'
  const mins = Math.round((then.getTime() - Date.now()) / 60000)
  if (mins <= 1) return 'in a moment'
  if (mins < 60) return `in ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `in ${hours} h`
  return `in ${Math.round(hours / 24)} d`
}

// Which policy row supplied a limit. Useful for an owner verifying an override
// took effect, and harmless detail for everyone else.
const sourceShort = (s) =>
  ({ user: 'override', 'node-default': 'default', node: 'node', unlimited: '' }[s] || '')
const sourceTitle = (s) =>
  ({
    user: 'Set specifically for you on this node',
    'node-default': 'The node’s default for each user',
    node: 'A limit on the whole node, shared by all users',
  }[s] || '')

defineExpose({ expanded })
</script>

<style scoped lang="scss">
@use '../../../styles/theme';

.pipeline-budget {
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: #fff;
  font-size: 12px;
}

.collapsed-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  background: none;
  border: 0;
  cursor: pointer;
  text-align: left;
  color: theme.$gray_6;

  &:focus-visible {
    outline: 2px solid theme.$purple_3;
    outline-offset: -2px;
  }
}

.meter {
  flex: 0 0 64px;
  height: 4px;
  border-radius: 2px;
  background: theme.$gray_2;
  overflow: hidden;

  &.level-near .meter-fill { background: theme.$orange_1; }
  &.level-over .meter-fill { background: theme.$red_2; }
}

.meter-fill {
  display: block;
  height: 100%;
  background: theme.$purple_3;
  transition: width 160ms ease-out;
}

.caption {
  flex: 1 1 auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .suffix { color: theme.$gray_4; }
}

.pill {
  flex: 0 0 auto;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
}

.pill-near {
  background: rgba(theme.$orange_1, 0.14);
  color: theme.$gray_6;
}

.pill-over {
  background: rgba(theme.$red_2, 0.1);
  color: theme.$red_2;
}

.chevron {
  flex: 0 0 auto;
  transition: transform 120ms ease-out;

  &.flipped { transform: rotate(180deg); }
}

.expanded {
  padding: 4px 8px 8px;
  border-top: 1px solid theme.$gray_1;
}

.axis { margin-top: 8px; }

.axis-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 3px;
}

.axis-label { color: theme.$gray_5; }

.axis-source {
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 6px;
  background: theme.$gray_1;
  color: theme.$gray_4;
  font-size: 10px;
}

.axis-numbers { color: theme.$gray_6; }

.axis .meter { flex-basis: auto; width: 100%; }

.axis-foot {
  margin: 3px 0 0;
  color: theme.$gray_4;
  font-size: 11px;
}

.blocked-reason,
.remedy {
  margin: 8px 0 0;
  color: theme.$gray_6;
  line-height: 1.4;
}

.per-run {
  margin: 8px 0 0;
  color: theme.$gray_4;
}

.manage {
  display: inline-block;
  margin-top: 8px;
  color: theme.$purple_3;
  font-weight: 600;
}

.fetch-error {
  margin: 8px 0 0;
  padding: 4px 6px;
  border: 1px solid rgba(theme.$red_2, 0.2);
  border-radius: 3px;
  background: rgba(theme.$red_2, 0.06);
  color: theme.$gray_6;
  font-size: 11px;
}
</style>
