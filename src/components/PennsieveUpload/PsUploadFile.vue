<template>
  <div>
    <div class="upload-file">
      {{uploadObject.file.name}}
      <div class="right">
        <div class="status">
          {{uploadObject.status}}
        </div>

        <div class="storage-value"> {{storageStr}} </div>
      </div>
    </div>
    <div class="file-status">
      <bf-progress-bar
        :loaded="uploadObject.progress.loaded"
        :total="uploadObject.progress.total"
      />
    </div>

  </div>
</template>

<script lang=ts setup>

import { reactive, computed } from 'vue'
import BfProgressBar from "../shared/bf-progress-bar/bf-progress-bar.vue";
import { formatMetric } from "../../mixins/bf-storage-metrics/storageMetrics.js"

const storageStr = computed(() => {
  return formatMetric(props.uploadObject.file.size)
})


const props = defineProps({
  uploadObject: Object,
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

  .right {
    display: flex;
    align-items: center;

    .status {
      margin-right: 8px;
      color: theme.$purple_3
    }
  }

  .svg-icon {
    vertical-align: bottom;
    color: theme.$gray_4;
    padding: 0 0 0 16px;
  }

  .storage-value {
    font-size: 12px;
  }
}

.file-status {
  align-items: center;
  display: flex;
  flex-direction: row;
}

</style>
