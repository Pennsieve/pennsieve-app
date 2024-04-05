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
      :close-on-click-modal="false"
      @close="onClose"
    >
      <template #header>
        <bf-dialog-header
          :title="dialogTitle"
        />

      </template>

      <p class="upload-text"><b>Note:</b> Files can take up to a minute of processing after upload completes. You can check import status of files in the
        <!-- Can remove the native event modifier on the click event below, all native events to custom elements are now captured by default. 
        This is deprecated since Vue3 and can be removed. -->
        <router-link :to="{ name: 'upload-manifests'}"
        @click.native="onClose"> upload manifest tracker.</router-link></p>

      <div class="clear-action-wrapper"> <div class="clear-action" @click="clearQueue">Clear</div> </div>

      <div v-if="!isUploading" v-bind="getRootProps()">

        <input v-bind="getInputProps()">
        <div
          :class="[ isInDropZone ? 'bf-drop-info-content hover condensed' : 'bf-drop-info-content condensed' ]"
          @dragenter.self="onDragEnter"
          @dragover.prevent="onDragEnter"
          @dragleave.self="onDragLeave"
        >
          <div class="upload-icons-wrap">
            <IconPDF class="file-icon"/>
            <img
              class="file-icon"

              :src="fileIcon('Image', 'Image')"
              alt="Image Icon"
            >
            <IconUpload class="file-icon upload"/>
            <IconTimeseries class="file-icon time-series"/>

            <img
              class="file-icon microscope"
              :src="fileIcon('Microscope', 'Slide')"
              alt="Microscopy Icon"
            >

          </div>
          <h3>
            Drag and drop files here or
            <a
              href="#"
              @click.prevent.stop="triggerInputFile"
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
        @change="modifyManifestFiles"
      >

      <div
        v-if="isUploading || uploadComplete">
        <div
          v-for="[key, value] in uploadMap" :key="key" class="manifest-file-wrapper">
          <PsUploadFile :upload-object="value"/>

        </div>
      </div>
      <div v-else>
        <div v-for="item in uploadFiles" class="manifest-file-wrapper">

          <PsManifestFile :file="item"/>

        </div>
      </div>


      <template #footer>
        <bf-button
          class="secondary"
          @click="cancelQueue"
        >
          {{cancelBtnText}}
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

import {reactive, computed, ref} from 'vue'
import { useStore } from 'vuex'
import BfButton from '../shared/bf-button/BfButton.vue';
import BfDialogHeader from "../shared/bf-dialog-header/BfDialogHeader.vue";
import {FileRejectReason, useDropzone} from "vue3-dropzone";
import PsUploadFile from './PsUploadFile.vue'
import PsManifestFile from "./PsManifestFile.vue";
import IconPDF from "../icons/IconPDF.vue";
import IconTimeseries from "../icons/IconTimeseries.vue";
import IconUpload from "../icons/IconUpload.vue";
import { fileIcon } from '../../mixins/file-icon/file-icon.js';
import { fromEvent } from 'file-selector';


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
const cancelBtnText = computed(() => isUploading.value?  "Hide" : "Reset" )
const dialogTitle = computed( () => {
  return 'Add Files to Upload'
})

function hasItems(list) {
  return list && list.length > 0
}

function clearQueue() {
  store.dispatch('uploadModule/resetUpload')
}

function cancelQueue() {
  if (isUploading.value) {
    onClose()
  } else {
    store.dispatch('uploadModule/resetUpload')
  }
}

function onDrop(acceptedFiles: File[]) {
  isInDropZone.value = false
  store.dispatch('uploadModule/addManifestFiles', acceptedFiles)
}

async function modifyManifestFiles(evt) {
  let filesWithPath = await fromEvent(evt);
  store.dispatch('uploadModule/addManifestFiles', filesWithPath)
}

function startUpload() {
  store.dispatch('uploadModule/getManifestNodeId').then(
    () => store.dispatch('uploadModule/syncManifest')
  ).then(
    () => store.dispatch('uploadModule/UploadFiles')
  )

  onClose()
}

function onClose() {
  emit('update:dialogVisible', false)
}

let inputFile = ref<HTMLInputElement | null>(null)
function triggerInputFile() {
  inputFile.value?.click();
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

.clear-action-wrapper {
  display: flex;
  align-items: end;
  flex-direction: column;

  .clear-action {
    color: $purple_3;
    cursor: pointer;
    margin-right: 4px;
  }
}

.upload-text {
  margin: 0 0 16px 0;
}

.file-icon {
  width: 24px;
  height: 24px;
  color:red;

  &.microscope {
    color: $purple_2
  }

  &.time-series {
    color: $purple_1;
  }

  &.upload {
    color: $purple_2
  }
}

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
