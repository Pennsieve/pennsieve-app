<template>
  <div>
    <div class="upload-file">
      <div class="file-name">{{uploadObject?.file.name}}</div>
      <div class="right">
        <div :class="['status', statusClass]">
          {{statusText}}
        </div>

        <div class="storage-value"> {{storageStr}} </div>
      </div>
    </div>
    <div class="file-status">
      <bf-progress-bar
        :loaded="uploadObject?.progress.loaded"
        :total="uploadObject?.progress.total"
        :complete="uploadObject?.status === 'processing'"
      />
    </div>

  </div>
</template>

<script lang=ts setup>

import { computed } from 'vue'
import BfProgressBar from "../shared/bf-progress-bar/bf-progress-bar.vue";
import { formatMetric } from "../../mixins/bf-storage-metrics/storageMetrics.js"

const props = defineProps({
  uploadObject: Object,
})

const storageStr = computed(() => {
  return formatMetric(props.uploadObject?.file.size)
})

const statusText = computed(() => {
  const status = props.uploadObject?.status
  switch (status) {
    case 'waiting':
      return 'Waiting'
    case 'uploading':
      return 'Uploading'
    case 'processing':
      return 'Uploading...'
    default:
      return status
  }
})

const statusClass = computed(() => {
  return props.uploadObject?.status === 'processing' ? 'complete' : ''
})



</script>



<style scoped lang="scss">
@use '../../styles/theme';

.upload-file {
  border-left: 1px solid theme.$gray_2;
  border-right: 1px solid theme.$gray_2;
  border-bottom:  1px solid theme.$gray_2;
  padding: 16px 16px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  position: relative;

  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 16px;
  }

  .right {
    display: flex;
    align-items: center;
    flex-shrink: 0;

    .status {
      margin-right: 8px;
      color: theme.$purple_3;
      min-width: 80px;
      text-align: right;

      &.complete {
        color: theme.$green_1;
      }
    }
  }

  .svg-icon {
    vertical-align: bottom;
    color: theme.$gray_4;
    padding: 0 0 0 16px;
  }

  .storage-value {
    font-size: 12px;
    min-width: 60px;
    text-align: right;
  }
}

.file-status {
  align-items: center;
  display: flex;
  flex-direction: row;
}

</style>
