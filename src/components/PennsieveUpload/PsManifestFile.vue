<template>

  <div class="manifest-file">
    {{file.name}}
    <div class="right">
      <div class="storage-value"> {{storageStr}} </div>
      <CircleIcon class="remove-icon">
        <template #icon>
          <IconRemove
            :width="8"
            :height="8"
          />
        </template>
      </CircleIcon>

    </div>
  </div>

</template>

<script lang=ts setup>

import {computed, reactive} from 'vue'
import IconRemove from "../icons/IconRemove.vue";
import CircleIcon from "../shared/CircleIcon/CircleIcon.vue"
import { formatMetric } from "../../mixins/bf-storage-metrics/storageMetrics.js"

const storageStr = computed(() => {
  return formatMetric(props.file.size)
})

const props = defineProps({
  file: Object,
})

</script>



<style scoped lang="scss">
@import '../../assets/_variables.scss';

.manifest-file {
  border-left: 1px solid $gray_2;
  border-right: 1px solid $gray_2;
  border-bottom:  1px solid $gray_2;
  padding: 16px 16px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;

  .right {
    display: flex;
    align-items: center;
  }

  .svg-icon {
    vertical-align: bottom;
    color: $gray_4;
    padding: 0 0 0 16px;
  }

  .storage-value {
    font-size: 12px;
  }

  .remove-icon {
    margin-left: 8px;
    height:18px;
    width: 18px;
    cursor: pointer;

    &:hover {
      color: $purple_3;
    }
  }
}

</style>
