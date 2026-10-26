<script setup>
/*
  A step's ports on one side of a detailed card, one column per connection
  point (stepPoints), so each name sits over (or under) its point. The main
  point reads "all inputs" / "all outputs".
*/
import { shortMediaType } from "../WorkflowBuilder/appManifestInfo";

const props = defineProps({
  points: { type: Array, required: true },
  side: { type: String, default: "in" }, // "in" (top) or "out" (bottom)
});

const all = () => (props.side === "in" ? "all inputs" : "all outputs");
const title = (p) =>
  p.port
    ? [p.name, (p.port.mediaTypes || []).map(shortMediaType).join(", "), p.port.description].filter(Boolean).join(" · ")
    : props.side === "in"
      ? "All inputs: each step linked here is given whole, at the root of the input folder"
      : "All outputs together";
</script>

<template>
  <div
    class="port-chips"
    :class="`port-chips--${side}`"
    :style="{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }"
  >
    <span
      v-for="p in points"
      :key="p.name || '*'"
      class="port-chip"
      :class="{ 'port-chip--all': !p.port }"
      :title="title(p)"
    >{{ p.port ? p.name : all() }}</span>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.port-chips {
  display: grid;
  justify-items: center;
  min-width: 0;
  font-size: 10px;
}
.port-chips--in {
  margin-bottom: 6px;
}
.port-chips--out {
  margin-top: 8px;
}
.port-chip {
  max-width: 100%;
  padding: 0 5px;
  overflow: hidden;
  border-radius: 3px;
  // White on an app card's orange, as in the builder.
  background: theme.$white;
  color: theme.$gray_5;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.port-chip--all {
  border: 1px dashed theme.$gray_3;
  background: none;
  color: theme.$gray_4;
}
</style>
