<script setup>
/*
  Where a step runs, when that isn't the default (an ECS task): a λ for a
  Lambda function, a chip for a GPU. Nothing for standard. Beside the LLM
  mark in a card's title row, in the builder and on a run's graph.
*/
import { computed } from "vue";

const props = defineProps({
  runtime: { type: String, default: "" },
  compact: { type: Boolean, default: false },
  // A title instead of the kind's own (e.g. the GPU a session runs on).
  label: { type: String, default: "" },
});

const TITLES = { lambda: "Runs as a Lambda function", gpu: "Runs on a GPU" };
const kind = computed(() => (TITLES[props.runtime] ? props.runtime : ""));
</script>

<template>
  <span
    v-if="kind"
    class="runtime-mark"
    :class="{ 'runtime-mark--compact': compact }"
    :title="label || TITLES[kind]"
    :aria-label="label || TITLES[kind]"
  >
    <span v-if="kind === 'lambda'" class="runtime-mark__lambda" aria-hidden="true">λ</span>
    <svg v-else viewBox="0 0 16 16" aria-hidden="true">
      <rect x="4" y="4" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M6 1.5v2M10 1.5v2M6 12.5v2M10 12.5v2M1.5 6h2M1.5 10h2M12.5 6h2M12.5 10h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  </span>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.runtime-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: theme.$gray_5;

  svg {
    width: 100%;
    height: 100%;
  }
}
.runtime-mark__lambda {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}
.runtime-mark--compact {
  width: 13px;
  height: 13px;
  margin-right: 4px;

  .runtime-mark__lambda {
    font-size: 13px;
  }
}
</style>
