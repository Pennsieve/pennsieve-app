<template>
  <div>
    <div class="upload-file">
      {{uploadObject.file.name}}
      <div class="right">
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
@import '../../assets/_variables.scss';

.upload-file {
  border-left: 1px solid $gray_2;
  border-right: 1px solid $gray_2;
  border-bottom:  1px solid $gray_2;
  padding: 16px 16px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  position: relative;

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
}

.file-status {
  align-items: center;
  display: flex;
  flex-direction: row;
}

//.bf-progress-bar {
//  background: transparent;
//  height: 100%;
//  left: 0;
//  pointer-events: none;
//  position: absolute;
//  top: 0;
//  width: 100%;
//  z-index: -1;
//  .bar {
//    background: #F0F0F0;
//  }
//}

//
//.bf-upload-package {
//  border: 1px solid $gray_2;
//  border-top: none;
//  &:first-child {
//    border-top: 1px solid $gray_2;
//  }
//  .overflow &:last-child {
//    border-bottom: none;
//    border-top: none;
//  }
//  .overflow &:first-child {
//    border-top: none;
//  }
//  &.is-uploading {
//    .package-info {
//      flex: 1;
//    }
//  }
//  .svg-icon {
//    height: 24px;
//    width: 24px;
//  }
//  &.is-uploaded {
//    background: #EFF1F3;
//  }
//  .path-info, .package-name {
//    flex: 1;
//    overflow: hidden;
//    text-overflow: ellipsis;
//    white-space: nowrap
//  }
//}
//

//
//.bf-upload-package-wrap {
//  align-items: center;
//  display: flex;
//  flex-direction: row;
//  padding: 13px 10px 13px 20px;
//  position: relative;
//  z-index: 1;
//}

</style>
