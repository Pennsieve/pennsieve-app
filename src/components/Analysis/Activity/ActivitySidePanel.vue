<script setup>
import { ref, watch } from "vue";

import IconDocument from "@/components/icons/IconDocument.vue";
import WorkflowsList from "@/components/Analysis/Activity/WorkflowsList.vue";
import IconInfo from "@/components/icons/IconInfo.vue";
import IconArrowRight from "@/components/icons/IconArrowRight.vue";
import ProcessorDetails from "./ProcessorDetails.vue";

/* 
Props
*/
const props = defineProps(["edges", "panelVisible", "selectedProcessor"]);

/* 
Local State
*/
const workflowsListVisible = ref(false);
const workflowsListSelected = ref(true);
const processorInfoSelected = ref(false);
const mouseHoverInfo = ref(false);
const mouseHoverList = ref(false);

/* 
Emits
*/
const emit = defineEmits([
  "openDeleteLinkedPropDialog",
  "togglePanelVisibility",
]);

/*
Watch
*/
watch(
  () => props.selectedProcessor,
  (newVal, oldVal) => {
    console.log("workflowsListVisible", workflowsListVisible.value);
    console.log("workflowsListSelected", workflowsListSelected.value);
    workflowsListVisible.value = true;
    workflowsListSelected.value = false;
    processorInfoSelected.value = true;
  }
);

/*
Side Panel Actions 
*/

function mouseLeave(event) {
  const evtId = event.currentTarget.id;
  if (!props.panelVisible) {
    mouseHoverInfo.value = false;
    mouseHoverList.value = false;
    return;
  }

  switch (evtId) {
    case "workflowsList":
      mouseHoverList.value = false;
      break;
    case "processorInfo":
      mouseHoverInfo.value = false;
      break;
  }
}

function mouseOver(event) {
  const evtId = event.currentTarget.id;

  if (!props.panelVisible) {
    mouseHoverInfo.value = false;
    mouseHoverList.value = false;
    return;
  }

  switch (evtId) {
    case "workflowsList":
      if (workflowsListSelected.value) {
        mouseHoverList.value = true;
      }
      break;
    case "proccessorInfo":
      if (processorInfoSelected.value) {
        mouseHoverInfo.value = true;
      }
      break;
  }
}

function toggleModelsList(event) {
  console.log("toggleModelsList ran");
  const evtId = event.currentTarget.id;

  switch (evtId) {
    case "workflowsList":
      if (workflowsListSelected.value) {
        workflowsListVisible.value = false;
        workflowsListSelected.value = false;
        emit("togglePanelVisibility");
      } else if (processorInfoSelected.value) {
        workflowsListSelected.value = true;
        processorInfoSelected.value = false;
        mouseHoverList.value = true;
      } else {
        workflowsListSelected.value = true;
        mouseHoverList.value = true;
        emit("togglePanelVisibility");
      }
      break;
    case "processorInfo":
      if (processorInfoSelected.value) {
        workflowsListVisible.value = false;
        processorInfoSelected.value = false;
        emit("togglePanelVisibility");
      } else if (workflowsListSelected.value) {
        processorInfoSelected.value = true;
        workflowsListSelected.value = false;
        mouseHoverInfo.value = true;
      } else {
        processorInfoSelected.value = true;
        mouseHoverInfo.value = true;
        emit("togglePanelVisibility");
      }
      break;
  }
}
</script>

<template>
  <div class="workflows-list-wrap" :class="{ visible: workflowsListVisible }">
    <button
      id="processorInfo"
      :class="{
        selected: processorInfoSelected,
        'btn-toggle': true,
        second: true,
      }"
      @click="toggleModelsList"
      @mouseenter="mouseOver"
      @mouseleave="mouseLeave"
    >
      <IconInfo v-if="!mouseHoverInfo" :width="24" :height="24" />
      <IconArrowRight v-else :width="14" :height="14" />
    </button>
    <button
      id="workflowsList"
      :class="{
        selected: workflowsListSelected,
        'btn-toggle': true,
        first: true,
      }"
      @click="toggleModelsList"
      @mouseenter="mouseOver"
      @mouseleave="mouseLeave"
    >
      <IconDocument v-if="!mouseHoverList" :width="24" :height="24" />
      <IconArrowRight v-else :width="14" :height="14" />
    </button>
    <div ref="workflowsList" class="workflows-list-scroll">
      <workflows-list v-show="workflowsListSelected" :scrolling-list="true" />

      <processor-details
        v-show="processorInfoSelected"
        :selected-processor="selectedProcessor"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@import "../../../assets/_variables.scss";

.workflows-list-wrap {
  border-top: 1px solid $gray_2;
  border-left: 1px solid $gray_2;
  border-bottom: 1px solid $gray_2;
  border-radius: 4px 0 0 4px;
  height: calc(100% - 94px);
  position: absolute;
  right: 0;
  top: 0;
  transform: translate3d(100%, 72px, 0);
  transition: transform 0.3s ease-out;
  width: 500px;
  will-change: transform;
  z-index: 3;
  &.visible {
    transform: translate3d(0, 72px, 0);
  }
}
.workflows-list-scroll {
  height: 100%;
  overflow: hidden;
  background: $gray_1;
  border-radius: 4px 0px 0 4px;
}

.btn-toggle {
  align-items: center;
  border: 1px solid $gray_2;
  border-radius: 4px 0 0 4px;
  display: flex;
  height: 48px;
  left: -35px;
  justify-content: center;
  position: absolute;
  top: 8px;
  width: 35px;
  color: $purple_1;
  fill: $purple_1;
  background: $gray_1;

  &.first {
    top: 33px;
  }

  &.second {
    top: 85px;
  }

  &.selected {
    background: linear-gradient(to left, $gray_1, $white);

    &:after {
      background: $gray_1;
      content: "";
      height: 100%;
      pointer-events: none;
      position: absolute;
      top: 0;
      right: -5px;
      width: 5px;
    }
  }
}
</style>
