<script setup>
// A compute node's tier (deploymentMode: Basic, Secure, Compliant) as a small
// pill: a shield in the tier's colour and its name, on a light tint of that
// colour, with a one-line tooltip (computeNodeHelpers.js MODES). The repo's
// icon set has locks but no shield, so the shield is drawn here.
import { computed } from "vue";
import { deploymentMode } from "./computeNodeHelpers";

const props = defineProps({
  // The node (or anything with deploymentMode).
  node: { type: Object, default: null },
  // Or the tier itself.
  mode: { type: String, default: "" },
  // Without the tooltip (inside a select option, say).
  plain: { type: Boolean, default: false },
});
const tier = computed(() => deploymentMode(props.mode ? { deploymentMode: props.mode } : props.node));
const style = computed(() => ({ "--tier": tier.value.color, "--tier-bg": tier.value.background }));
</script>

<template>
  <el-tooltip :content="tier.tooltip" :disabled="plain" placement="top" :show-after="300">
    <span class="tier-badge" :class="`tier-badge--${tier.key}`" :style="style" :aria-label="`${tier.label} tier: ${tier.tooltip}`">
      <svg class="tier-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          class="tier-shield"
          :class="{ 'tier-shield--filled': tier.icon === 'shield-filled' }"
          d="M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6l7-3z"
        />
        <path v-if="tier.icon === 'shield-check'" class="tier-check" d="M8.8 12.2l2.3 2.3 4.3-4.6" />
      </svg>
      {{ tier.label }}
    </span>
  </el-tooltip>
</template>

<style scoped lang="scss">
/* Compact (22px), as the capability chips, in the tier's own colours. */
.tier-badge {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  height: 22px;
  padding: 0 8px 0 6px;
  border-radius: 3px;
  background: var(--tier-bg);
  color: var(--tier);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}
.tier-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}
.tier-shield {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linejoin: round;
}
.tier-shield--filled {
  fill: currentColor;
  fill-opacity: 0.25;
}
.tier-check {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
