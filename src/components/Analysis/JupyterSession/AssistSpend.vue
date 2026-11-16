<script setup>
// The notebook's AI spend, in its toolbar: what the run has spent of its AI
// budget, as the node's LLM governor prices it, and a thin bar of how full.
// Hovering says more: the last request's tokens and cost, and the node's
// budget for the period. Shown only when the session has an assistant and the
// governor gave figures.
import { computed } from "vue";
import AssistIcon from "./AssistIcon.vue";
import { runSpend, usageLine } from "./assistHelpers";

const props = defineProps({
  budget: { type: Object, default: null },
  // The last request's { usage, budget } (its tokens and cost).
  last: { type: Object, default: null },
  compact: { type: Boolean, default: false },
  // Tokens this notebook's requests used: shown when there are no dollar
  // figures.
  tokens: { type: Number, default: 0 },
});

const spend = computed(() => runSpend(props.budget));
const usedUpText = computed(() =>
  spend.value?.scope === "run" ? "AI budget used up (this run)" : `AI budget used up ${spend.value?.when || ""}`.trim()
);
const tokenText = computed(() => (props.tokens >= 1000 ? `${(props.tokens / 1000).toFixed(1)}k tokens` : `${props.tokens} tokens`));
const title = computed(() => {
  const s = spend.value;
  const lines = [
    !s
      ? `AI in this notebook: ${tokenText.value} (no cost figures from the node)`
      : s.scope === "run"
      ? `AI this run: ${s.text}`
      : `AI on this compute node: ${s.text} (this run has no AI budget of its own)`,
  ];
  const b = props.budget;
  if (s?.scope === "run" && b?.periodBudgetUsd) lines.push(`This node's ${b.period || "period"} budget: $${(b.periodUsedUsd || 0).toFixed(2)} of $${b.periodBudgetUsd.toFixed(2)}`);
  if (props.tokens) lines.push(`Tokens in this notebook: ${tokenText.value}`);
  const last = props.last && usageLine(props.last.usage, props.last.budget);
  if (last) lines.push(`Last request: ${last}`);
  lines.push("As the node's LLM governor counts it.");
  return lines.join("\n");
});
</script>

<template>
  <span v-if="spend" class="nb-spend" :class="{ 'is-high': spend.fraction >= 0.8 }" :title="title">
    <AssistIcon :size="12" />
    <!-- Short in the toolbar; the hover says whose budget and for when. -->
    <template v-if="!compact">{{ spend.fraction >= 1 ? usedUpText : spend.short }}</template>
    <span class="nb-spend__bar" aria-hidden="true"><span :style="{ width: `${Math.round(spend.fraction * 100)}%` }" /></span>
  </span>
  <span v-else-if="tokens" class="nb-spend" :title="title">
    <AssistIcon :size="12" />
    <template v-if="!compact">{{ tokenText }}</template>
  </span>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.nb-spend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 0;
  background: theme.$white;
  font-size: 12px;
  color: theme.$purple_3;
  white-space: nowrap;
}
.nb-spend__bar {
  display: inline-block;
  width: 40px;
  height: 4px;
  background: theme.$gray_2;
  overflow: hidden;

  span {
    display: block;
    height: 100%;
    background: theme.$purple_3;
  }
}
.nb-spend.is-high {
  border-color: theme.$orange_2;
  color: theme.$orange_2;

  .nb-spend__bar span {
    background: theme.$orange_2;
  }
}
</style>
