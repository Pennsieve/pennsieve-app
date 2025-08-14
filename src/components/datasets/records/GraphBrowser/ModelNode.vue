<script setup>
import {Position, Handle, useVueFlow} from '@vue-flow/core'

import {computed, ref} from "vue";
import IconNavExpand from "@/components/icons/IconNavExpand.vue";
import IconAddTemplate from "@/components/icons/IconAddTemplate.vue";
import {NodeToolbar} from "@vue-flow/node-toolbar";
import ModelTooltip from "@/components/datasets/explore/ModelTooltip/ModelTooltip.vue";

const props = defineProps(['data'])

let showInfo = ref(false)
const { findNode } = useVueFlow()

const isSelected = computed( () => {

  const node = findNode(props.data.id)
  return node.selected
})


</script>

<template>
  <div class="model-node">
    <Handle id="source-a" type="source" :position="Position.Top" />
    <Handle id="source-b" type="source" :position="Position.Top" :style="{'top': '5px', 'left': '45px', 'opacity': 0}"/>


    <div class="label">{{ data.label }} </div>
    <div v-if="showInfo" class="info">

        <IconAddTemplate/>

    </div>
    <Handle id="target-a" type="target" :position="Position.Bottom" />
    <Handle id="target-b" type="target" :position="Position.Bottom" :style="{'top': '5px', 'left': '45px', 'opacity': 0}"/>

  </div>
</template>

<style lang="scss" scoped>
@import '../../../../assets/_variables.scss';

.model-node {
  border: 1px solid $purple_tint;
  background: $white;
  border-radius: 0 0 2px 2px;
  min-width: 200px;



}

.label {
  font-size: 10pt;
  background: $purple_tint;
  padding: 4px;
  text-align: center;
}

.info {
  min-height: 60px;
  padding: 8px;

  .item {
    display: flex;
    flex-direction: row;
  }

  .prop-label {
    font-size: 8pt;
  }
}

</style>