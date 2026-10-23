<script setup>
// A workflow graph node in its compact state: one line, the same size for
// every node. The type shows as the strip on the left (the same colours as
// the detailed cards), the status as the dot on the right, and a runtime
// other than standard as a small tag. The page's actions for the node (end
// a session, configure, remove) go in the default slot, shown on hover.
import { computed } from "vue";
import { statusBorderColor, statusLabel } from "../RunMonitor/runHelpers";
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
});

// Source and target: the detailed cards' colours. Processor: the theme's
// orange_1, so the user's own code stands out (the detailed processor card
// has no type colour, only status).
const KIND_COLOR = { source: "#6366f1", processor: "#F9A23A", target: "#64748b" };
const KIND_LABEL = { source: "Source", processor: "Processor", target: "Target" };

const stripColor = computed(() => KIND_COLOR[props.kind] || KIND_COLOR.processor);
const showRuntime = computed(() => props.runtime && props.runtime !== "standard");
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
    :class="[`cfn--${kind}`, { 'cfn--running': status === 'STARTED', 'cfn--actions-shown': !actionsOnHover }]"
    :style="{
      '--cfn-strip': stripColor,
      '--cfn-status': status ? statusBorderColor(status) : 'transparent',
      width: `${COMPACT_BOX.width}px`,
      height: `${COMPACT_BOX.height}px`,
    }"
    :title="tooltip"
  >
    <span v-if="unmet > 0" class="cfn__unmet">{{ unmet }}</span>
    <span class="cfn__label">{{ label }}</span>
    <span v-if="showRuntime" class="cfn__runtime">{{ runtime }}</span>
    <span class="cfn__actions" @click.stop>
      <slot />
    </span>
    <span v-if="status" class="cfn__dot" :aria-label="statusLabel(status)" />
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
.cfn--source {
  background: #eef0fe; // the detailed source card's tint
}
.cfn--target {
  background: theme.$gray_1;
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
.cfn__dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--cfn-status);
}
.cfn--running .cfn__dot {
  animation: cfn-pulse 1.4s ease-in-out infinite;
}
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
    opacity: 0.35;
  }
}
</style>
