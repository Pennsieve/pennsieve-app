<script setup>

import { ref} from "vue";

import IconDocument from "@/components/icons/IconDocument.vue";
import ModelsList from "@/components/datasets/records/ModelsList/ModelsList.vue";
import IconInfo from "@/components/icons/IconInfo.vue";
import IconArrowRight from "@/components/icons/IconArrowRight.vue";
import ModelDetails from "@/components/datasets/records/GraphBrowser/ModelDetails.vue";

const props = defineProps(['modelId', 'panelVisible'])

const modelsListVisible = ref(false)
const modelListSelected = ref(true)
const modelInfoSelected = ref(false)

const emit = defineEmits(['togglePanelVisibility', 'focusNode'])

const mouseHoverInfo = ref(false)
const mouseHoverList = ref(false)

function mouseLeave(event) {

  const evtId = event.currentTarget.id
  if (!props.panelVisible) {
    mouseHoverInfo.value = false
    mouseHoverList.value = false
    return
  }

  switch(evtId) {
    case 'infoPanel':
      mouseHoverList.value = false
      break
    case 'propPanel':
      mouseHoverInfo.value = false
      break
  }

}

function mouseOver(event) {

  const evtId = event.currentTarget.id

  if (!props.panelVisible) {
    mouseHoverInfo.value = false
    mouseHoverList.value = false
    return
  }

  switch(evtId) {
    case 'infoPanel':
      if (modelListSelected.value) {
        mouseHoverList.value = true
      }
      break
    case 'propPanel':
      if (modelInfoSelected.value) {
        mouseHoverInfo.value = true
      }
      break
  }

}

function focusNode(event) {
  emit('focusNode', event)
}

function toggleModelsList(event) {
  const evtId = event.currentTarget.id

  switch (evtId) {
    case 'infoPanel':
      if (modelListSelected.value) {
        modelsListVisible.value = false
        modelListSelected.value = false
        emit('togglePanelVisibility')
      } else if (modelInfoSelected.value) {
        modelListSelected.value = true
        modelInfoSelected.value = false
        mouseHoverList.value = true
      } else {
        modelListSelected.value = true
        mouseHoverList.value = true
        emit('togglePanelVisibility')
      }
      break
    case 'propPanel':
      if (modelInfoSelected.value) {
        modelsListVisible.value = false
        modelInfoSelected.value = false
        emit('togglePanelVisibility')
      } else if (modelListSelected.value) {
        modelInfoSelected.value = true
        modelListSelected.value = false
        mouseHoverInfo.value = true

      } else {
        modelInfoSelected.value = true
        mouseHoverInfo.value = true
        emit('togglePanelVisibility')
      }
      break
  }


}


</script>

<template>
  <div
    class="models-list-wrap"
    :class="{ 'visible': modelsListVisible }"
  >
    <button
      id="propPanel"
      :class="{ 'selected': modelInfoSelected, 'btn-toggle':true, 'first':true }"
      @click="toggleModelsList"
      @mouseenter="mouseOver"
      @mouseleave="mouseLeave"
    >
      <IconInfo
        v-if="!mouseHoverInfo"
        :width="24"
        :height="24"
        color="#808fad"
      />
      <IconArrowRight
        v-else
        :width="14"
        :height="14"
        color="#808fad"
      />
    </button>
    <button
      id="infoPanel"
      :class="{ 'selected': modelListSelected, 'btn-toggle':true, 'second':true }"
      @click="toggleModelsList"
      @mouseenter="mouseOver"
      @mouseleave="mouseLeave"
    >
      <IconDocument
        v-if="!mouseHoverList"
        :width="24"
        :height="24"
        color="#808fad"
      />
      <IconArrowRight
        v-else
        :width="14"
        :height="14"
        color="#808fad"
      />

    </button>
    <div
      ref="modelsList"
      class="models-list-scroll"
    >
      <models-list
        v-if="modelListSelected"
        :show-heading="false"
        :is-link="false"
        :scrolling-list="true"
        @click="focusNode"
      />


      <modelDetails v-if="modelInfoSelected"
                    :model-id="modelId"/>



    </div>





  </div>
</template>

<style lang="scss" scoped>
@import '../../../../assets/_variables.scss';

.models-list-wrap {
  border-top: 1px solid $gray_2;
  border-left: 1px solid $gray_2;
  border-bottom: 1px solid $gray_2;
  border-radius: 4px 0px 0 4px;
  height: calc(100% - 94px);
  position: absolute;
  right: 0;
  top: 0;
  transform: translate3d(100%, 72px, 0);
  transition: transform .3s ease-out;
  width: 300px;
  will-change: transform;
  z-index: 3;
  &.visible {
    transform: translate3d(0, 72px, 0);

  }
}
.models-list-scroll {
  height: 100%;
  overflow: hidden;
  background: $gray_1;
  border-radius: 4px 0px 0 4px;
}

.btn-toggle {
  align-items: center;
  background: $gray_1;
  border: 1px solid $gray_2;
  border-radius: 4px 0 0 4px;
  display: flex;
  height: 48px;
  left: -35px;
  justify-content: center;
  position: absolute;
  top: 8px;
  width: 35px;

  &.first {
    top: 33px;
  }

  &.second {
    top: 85px;
  }

  &.selected {
    &:after {

      background: $gray_1;
      content: '';
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