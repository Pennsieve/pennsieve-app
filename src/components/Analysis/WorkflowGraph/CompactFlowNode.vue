<script setup>
// A workflow graph node in its compact state: one line, the same size for
// every node. The type shows as the strip on the left (the same colours as
// the detailed cards), which pulses while the step runs; an ended step has
// its mark on the right (✓, ✕, –) as on the detailed cards; a runtime other
// than standard has its mark or a small tag. The page's actions for the node (end
// a session, configure, remove) go in the default slot, shown on hover.
import RuntimeMark from "./RuntimeMark.vue";
import { computed } from "vue";
import { statusLabel, statusMarkOf } from "../RunMonitor/runHelpers";
import { COMPACT_BOX } from "./graphDensity";

const props = defineProps({
  // source | processor | target
  kind: { type: String, default: "processor" },
  label: { type: String, default: "" },
  // A run status (NOT_STARTED, STARTED, SUCCEEDED, FAILED…), or none in the
  // builder and when configuring.
  status: { type: String, default: "" },
  // standard, gpu, lambda: only a non-standard one is shown.
  runtime: { type: String, default: "" },
  // Required settings still missing (configuring a run).
  unmet: { type: Number, default: 0 },
  // Extra line for the tooltip, e.g. "12 files" or "Public dataset".
  detail: { type: String, default: "" },
  // Editing actions (configure, remove) show on hover; ones the user is
  // waiting on (open a waiting notebook) stay visible.
  actionsOnHover: { type: Boolean, default: true },
  // A colour for the strip instead of the kind's: an app step's domain
  // (appDomains.js), so a graph shows the domains it touches.
  accent: { type: String, default: "" },
});

// Source and target: the detailed cards' colours. Processor: the theme's
// orange_2, so the user's own code stands out (the detailed processor card
// has no type colour, only status).
const KIND_COLOR = { source: "#6366f1", processor: "#E0912A", target: "#64748b" };
const KIND_LABEL = { source: "Source", processor: "Processor", target: "Target" };

const stripColor = computed(() => props.accent || KIND_COLOR[props.kind] || KIND_COLOR.processor);
const showRuntime = computed(() => props.runtime && props.runtime !== "standard");
// Lambda and GPU have a mark (RuntimeMark); others (interactive) a word.
const hasMark = computed(() => ["lambda", "gpu"].includes(props.runtime));
const mark = computed(() => statusMarkOf(props.status));
const tooltip = computed(() =>
  [
    `${KIND_LABEL[props.kind] || "Node"}: ${props.label}`,
    props.detail,
    props.status ? statusLabel(props.status) : "",
    showRuntime.value ? `Runs on ${props.runtime}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
);
</script>

<template>
  <div
    class="cfn"
    :class="[`cfn--${kind}`, { 'cfn--running': status === 'STARTED', 'cfn--failed': status === 'FAILED', 'cfn--actions-shown': !actionsOnHover }]"
    :style="{
      '--cfn-strip': stripColor,
      width: `${COMPACT_BOX.width}px`,
      height: `${COMPACT_BOX.height}px`,
    }"
    :title="tooltip"
  >
    <span v-if="unmet > 0" class="cfn__unmet">{{ unmet }}</span>
    <span class="cfn__label">{{ label }}</span>
    <RuntimeMark v-if="hasMark" :runtime="runtime" compact />
    <span v-else-if="showRuntime" class="cfn__runtime">{{ runtime }}</span>
    <span class="cfn__actions" @click.stop>
      <slot />
    </span>
    <span
      v-if="mark"
      class="cfn__mark"
      :class="`cfn__mark--${mark.kind}`"
      :aria-label="statusLabel(status)"
    >{{ mark.glyph }}</span>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.cfn {
  position: relative;
  // In front of the node's connector handles, which then show as half
  // circles on its edges (still grabbable to connect, in the builder).
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 0 12px 0 16px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_6;
  overflow: hidden;

  // The type strip.
  &::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 4px;
    background: var(--cfn-strip);
  }
}
// The detailed cards' tints (RunDetail .data-source-node, .data-target-node).
.cfn--source {
  background: #eef2ff;
}
.cfn--target {
  background: #f1f5f9;
}
.cfn__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cfn__runtime {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 3px;
  background: theme.$gray_0;
  color: theme.$gray_5;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}
.cfn__actions {
  display: none;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;

  &:not(:empty) {
    .cfn:hover &,
    .cfn--actions-shown & {
      display: flex;
    }
  }
}
// Running: the strip pulses; failed: a red border too (as detailed).
.cfn--running::before {
  animation: cfn-pulse 1.6s ease-in-out infinite;
}
.cfn--failed {
  border-color: theme.$status_red;
}
.cfn__mark {
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}
.cfn__mark--done { color: theme.$status_green; }
.cfn__mark--failed { color: theme.$status_red; }
.cfn__mark--canceled { color: theme.$gray_4; }
.cfn__unmet {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  background: theme.$red_2;
  color: theme.$white;
  font-size: 9px;
  line-height: 14px;
  text-align: center;
}
@keyframes cfn-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}
</style>
