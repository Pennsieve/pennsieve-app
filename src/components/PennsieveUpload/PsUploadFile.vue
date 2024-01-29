<template>
  <div class="bf-upload-package">
    <div class=" bf-upload-package-wrap">
      <div class="file-name">
        {{ uploadObject.file.name }}
      </div>

      <bf-progress-bar
        class="bf-progress-bar"
        :loaded="uploadObject.progress.loaded"
        :total="uploadObject.progress.total"
      />

    </div>



  </div>
</template>

<script lang=ts setup>

import { reactive } from 'vue'
import {computed} from "vue/dist/vue";
import bfProgressBar from "../shared/bf-progress-bar/bf-progress-bar.vue"



const props = defineProps({
  uploadObject: Object,
})

// const uploadFile = computed(() => props.file.value)


</script>



<style scoped lang="scss">
@import '../../assets/_variables.scss';

.bf-upload-package {
  border: 1px solid $gray_2;
  border-top: none;
  &:first-child {
    border-top: 1px solid $gray_2;
  }
  .overflow &:last-child {
    border-bottom: none;
    border-top: none;
  }
  .overflow &:first-child {
    border-top: none;
  }
  &.is-uploading {
    .package-info {
      flex: 1;
    }
  }
  .svg-icon {
    height: 24px;
    width: 24px;
  }
  &.is-uploaded {
    background: #EFF1F3;
  }
  .path-info, .package-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap
  }
}

.bf-progress-bar {
  background: transparent;
  height: 100%;
  left: 0;
  pointer-events: none;
  position: absolute;
  top: 0;
  width: 100%;
  z-index: -1;
  .bar {
    background: #F0F0F0;
  }
}

.bf-upload-package-wrap {
  align-items: center;
  display: flex;
  flex-direction: row;
  padding: 13px 10px 13px 20px;
  position: relative;
  z-index: 1;
}

</style>
