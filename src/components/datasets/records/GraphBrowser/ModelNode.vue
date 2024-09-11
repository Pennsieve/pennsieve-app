<script setup>
import { Position, Handle } from '@vue-flow/core'

import {ref} from "vue";

const props = defineProps(['data'])

let showInfo = ref(false)


</script>

<template>
  <div class="model-node">
    <Handle type="source" :position="Position.Top" />
    <div class="label">{{ data.label }} </div>
    <div v-if="showInfo" class="info">

      <div class="item">
        <div class="propLabel"> <b>id:</b></div>
        <div>{{ data.id }}</div>
      </div>

    </div>
    <Handle type="target" :position="Position.Bottom" />
  </div>
</template>

<style lang="scss" scoped>
@import '../../../../assets/_variables.scss';

.model-node {
  border: 1px solid $purple_tint;
  background: $white;
  border-radius: 0 0 2px 2px;
  min-width: 180px;

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