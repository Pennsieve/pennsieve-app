<script setup>
// A workflow's graph in miniature (graphThumbnail.js): coloured boxes and
// the lines between them, scaled to fit and centred.
import { computed } from "vue";
import { thumbnailLayout, KIND_COLOR, KIND_FILL } from "./graphThumbnail";

const props = defineProps({
  dag: { type: Array, default: () => [] },
  // Width over height of the box it fills: graphs run top to bottom, so the
  // gallery's is portrait.
  aspect: { type: Number, default: 0.8 },
});

const PAD = 24;
const layout = computed(() => thumbnailLayout(props.dag));
const viewBox = computed(() => {
  const l = layout.value;
  if (!l) return "0 0 1 1";
  // Padded to the box's shape, so a small or lopsided graph sits in the
  // middle at the same scale as its neighbours would allow.
  let w = l.width + PAD * 2;
  let h = Math.max(l.height + PAD * 2, 220);
  if (w / h < props.aspect) w = h * props.aspect;
  else h = w / props.aspect;
  return `${(l.width - w) / 2} ${(l.height - h) / 2} ${w} ${h}`;
});
const path = (points) => points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
</script>

<template>
  <svg class="wt" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet" role="img" aria-label="The workflow's steps">
    <template v-if="layout">
      <path v-for="e in layout.edges" :key="e.id" :d="path(e.points)" class="wt__edge" />
      <g v-for="n in layout.nodes" :key="n.id">
        <rect :x="n.x" :y="n.y" :width="n.w" :height="n.h" rx="6" :fill="KIND_FILL[n.kind]" class="wt__box" />
        <rect :x="n.x" :y="n.y" width="8" :height="n.h" rx="3" :fill="KIND_COLOR[n.kind]" />
      </g>
    </template>
  </svg>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.wt {
  display: block;
  width: 100%;
  height: 100%;
}
.wt__edge {
  fill: none;
  stroke: theme.$gray_3;
  stroke-width: 3;
}
.wt__box {
  stroke: theme.$gray_3;
  stroke-width: 2;
}
</style>
