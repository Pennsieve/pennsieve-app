<script setup>
/*
  A link on the builder's canvas: the usual curve with the check's label
  (three quarters along, toward its input), and, when the link is selected
  or hovered, a × at its middle that removes it. The builder provides the removal (removeLink) and
  whether the graph can be edited. Either end can also be dragged to another
  connection point (the canvas's edges-updatable), which moves the link.
*/
import { computed, inject, ref } from "vue";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@vue-flow/core";

const props = defineProps({
  id: { type: String, required: true },
  sourceX: { type: Number, required: true },
  sourceY: { type: Number, required: true },
  targetX: { type: Number, required: true },
  targetY: { type: Number, required: true },
  sourcePosition: { type: String, required: true },
  targetPosition: { type: String, required: true },
  selected: { type: Boolean, default: false },
  style: { type: Object, default: undefined },
  markerEnd: { type: String, default: undefined },
  interactionWidth: { type: Number, default: 24 },
  // The check's verdict on the link (revalidateEdges), drawn at its middle.
  label: { type: [String, Object], default: undefined },
  labelStyle: { type: Object, default: undefined },
  labelShowBg: { type: Boolean, default: undefined },
  labelBgStyle: { type: Object, default: undefined },
  labelBgPadding: { type: Array, default: undefined },
  labelBgBorderRadius: { type: Number, default: undefined },
});

const removeLink = inject("removeLink", null);
const linksEditable = inject("linksEditable", () => false);

const path = computed(() => getBezierPath(props));

// The check's label sits along the curve, toward the input it feeds, not at
// its middle: links into different inputs of a step part there, so their
// labels don't overlap (two links between the same steps cross mid-way).
const LABEL_AT = 0.75;
const labelPoint = computed(() => pointOnCurve(path.value[0], LABEL_AT) || [path.value[1], path.value[2]]);

// A point on a path "M x,y C x1,y1 x2,y2 x,y" (Vue Flow's bezier) at t.
function pointOnCurve(d, t) {
  const n = String(d).match(/-?\d+(\.\d+)?(e-?\d+)?/g)?.map(Number);
  if (!n || n.length < 8) return null;
  const [x0, y0, x1, y1, x2, y2, x3, y3] = n;
  const u = 1 - t;
  const at = (a, b, c, e) => u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * e;
  return [at(x0, x1, x2, x3), at(y0, y1, y2, y3)];
}
const hovered = ref(false);
const showRemove = computed(() => !!removeLink && linksEditable() && (props.selected || hovered.value));
</script>

<template>
  <g @mouseenter="hovered = true" @mouseleave="hovered = false">
    <BaseEdge
      :id="id"
      :path="path[0]"
      :style="style"
      :marker-end="markerEnd"
      :interaction-width="interactionWidth"
      :label="label"
      :label-x="labelPoint[0]"
      :label-y="labelPoint[1]"
      :label-style="labelStyle"
      :label-show-bg="labelShowBg"
      :label-bg-style="labelBgStyle"
      :label-bg-padding="labelBgPadding"
      :label-bg-border-radius="labelBgBorderRadius"
    />
  </g>
  <EdgeLabelRenderer>
    <button
      v-if="showRemove"
      type="button"
      class="link-remove nodrag nopan"
      title="Remove this link"
      aria-label="Remove this link"
      :style="{ transform: `translate(-50%, -50%) translate(${path[1]}px, ${path[2]}px)` }"
      @mouseenter="hovered = true"
      @mouseleave="hovered = false"
      @click.stop="removeLink(id)"
    >
      &times;
    </button>
  </EdgeLabelRenderer>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.link-remove {
  position: absolute;
  z-index: 10;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid theme.$gray_3;
  border-radius: 50%;
  background: theme.$white;
  font-size: 14px;
  line-height: 1;
  color: theme.$gray_5;
  cursor: pointer;
  pointer-events: all;

  &:hover {
    border-color: theme.$red_1;
    color: theme.$red_1;
  }
}
</style>
