<script setup>
/*
  A link on the builder's canvas: the usual curve with the check's label,
  and, when the link is selected or hovered, a × at its middle (above the
  label) that removes it. The builder provides the removal (removeLink) and
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
      :label-x="path[1]"
      :label-y="path[2]"
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
      :style="{ transform: `translate(-50%, -50%) translate(${path[1]}px, ${path[2] - (label ? 22 : 0)}px)` }"
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
