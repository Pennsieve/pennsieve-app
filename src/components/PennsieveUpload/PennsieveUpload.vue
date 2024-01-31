<!--
User drops files on dropzone ->
File-manifest is created locally in mem.

User click upload ->
Manifest is created ->
(optional) User verifies manifest is okay ->
Files are uploaded

User drops folder on dropzone ->
Message currently not supported.

User started upload and re-opens window ->
User cannot add files, but can track progress

Upload completed ->
User notified -> User can initiate new upload
with same manifest. Manifest is used for entire session.

User archives manifest -> remove activeManifest from memory

-->
<template>
  <div
    class="bf-upload"
  >
    <el-dialog
      :modelValue="dialogVisible"
      @update:modelValue="dialogVisible = $event"
      :show-close="true"
      @close="onClose"
    >
      <template #header>
        <bf-dialog-header
          :title="dialogTitle"
        />

      </template>

      <div v-bind="getRootProps()">
        <input v-bind="getInputProps()">
        <div
          :class="[ isInDropZone ? 'bf-drop-info-content hover condensed' : 'bf-drop-info-content condensed' ]"
          @dragenter.self="onDragEnter"
          @dragover.prevent="onDragEnter"
          @dragleave.self="onDragLeave"
        >
          <h3>
            Drag and drop files here or
            <a
              href="#"
              @click.prevent="triggerInputFile"
            >
              choose your files
            </a>.
          </h3>
        </div>
      </div>

      <input
        ref="inputFile"
        class="visuallyhidden"
        type="file"
        multiple="multiple"
      >

      <div

        v-if="isUploading || uploadComplete"
        v-for="[key, value] in uploadMap" :key="key">

        <PsUploadFile :upload-object="value"/>

      </div>
      <div v-else class="manifest-file-wrapper">
        <div v-for="item in uploadFiles" class="manifest-file-wrapper">

          <PsManifestFile :file="item"/>

        </div>
      </div>


      <template #footer>
        <bf-button
          class="secondary"
          @click="cancelQueue"
        >
          Cancel
        </bf-button>
        <bf-button
          @click="startUpload"
        >
          Start Upload
        </bf-button>

      </template>


    </el-dialog>

  </div>


</template>

<script lang=ts setup>

import {reactive, computed, ref, defineEmits} from 'vue'
import { useStore } from 'vuex'
import BfButton from '../shared/bf-button/BfButton.vue';
import BfDialogHeader from "../shared/bf-dialog-header/BfDialogHeader.vue";
import {FileRejectReason, useDropzone} from "vue3-dropzone";
import {pathOr} from "ramda";
import PsUploadFile from './PsUploadFile.vue'
import PsManifestFile from "./PsManifestFile.vue";


const store = useStore()

defineExpose({
  onDrop
})

const emit = defineEmits([
  'update:dialogVisible'
])

const props = defineProps({
  file: Object,
  dialogVisible: Boolean
})

const uploadFiles = computed(() => store.getters['uploadModule/getManifestFiles']())
const uploadMap = computed( () => store.getters['uploadModule/getUploadMap']())
const isUploading = computed( () => store.getters['uploadModule/getIsUploading']())
const uploadComplete = computed( () => store.getters['uploadModule/getUploadComplete']())

const dialogTitle = computed( () => {
  return 'Add Files to Upload'
})

function hasItems(list) {
  return list && list.length > 0
}

function cancelQueue() {
  onClose()
}

function onDrop(acceptedFiles: File[], rejectReasons: FileRejectReason[]) {
  console.log('on-drop in pennsieve-upload')
  isInDropZone.value = false
  store.dispatch('uploadModule/addManifestFiles', acceptedFiles)

}

function startUpload() {
  console.log('Starting Upload')

  store.dispatch('uploadModule/getManifestNodeId').then(
    () => store.dispatch('uploadModule/syncManifest')
  ).then(
    () => store.dispatch('uploadModule/UploadFiles')
  )

}

function onClose() {
  console.log('close')
  emit('update:dialogVisible', false)
}

function triggerInputFile() {
  this.$refs.inputFile.click()
}

let isInDropZone = ref(false)
function onDragEnter() {isInDropZone.value = true}
function onDragLeave() { isInDropZone.value = false}


const options = reactive({
  multiple: true,
  onDrop,
})

const {
  getRootProps,
  getInputProps,
  isFocused,
  isDragReject,
  open
} = useDropzone(options)

</script>

<style scoped lang="scss">
@import '../../assets/_variables.scss';

.manifest-file-wrapper {
  max-height: 400px;
  overflow: scroll;

  &:first-child {
    border-top: 1px solid $gray_2;
  }
}

.bf-drop-info-content {
    align-items: center;
    border-style: dashed;
    border-color: red;
    border-image-source: url('/src/assets/images/dotted-border.svg');
    border-image-slice: 8%;
    border-image-repeat: repeat;
    display: flex;
    flex-direction: column;
    flex: 1;
    justify-content: center;
    padding: 20px;
    position: relative;
    text-align: center;

    &.hover {
      border: 2px solid $green_1;
    }

    //&:after {
    //  border: 4px solid $green_2;
    //
    //  content: '';
    //  height: calc(100% - 4px);
    //  left: -2px;
    //  pointer-events: none;
    //  position: absolute;
    //  opacity: 0;
    //  transition: opacity .2s ease-out;
    //  top: -2px;
    //  width: calc(100% - 4px);
    //}
    //&.is-dragging {
    //  .icon-upload-extra {
    //    opacity: 1;
    //    transform: translateX(0);
    //    &.outside {
    //      transition-delay: .1s;
    //      transition-duration: .3s
    //    }
    //  }
    //}
    //&.is-dragging:after {
    //  opacity: 1;
    //}
    &.condensed {
      color: $gray_4;
      flex: none;
      padding: 13px;
      margin-bottom: 10px;



      .dropzone-content {
        align-items: center;
        display: flex;
        flex-direction: row;

      }

      h3 {
        margin: 0;
        font-weight: 300;

        a {
          color: $purple_2;
          text-decoration: underline;
          cursor: pointer;
        }
      }

      .icon-upload {
        display: inline-flex;
        height: 20px;
        margin: 0 5px 0 0;
        width: 20px;
      }

      .icon-upload-extra {
        display: none;
      }

      .upload-icons-wrap {
        margin: 0;
      }
    }
}

.bf-upload .bf-dialog .bf-dialog-wrap {
  height: 590px;
  margin: -295px 0 0 -350px;
  width: 700px;
}
</style>
