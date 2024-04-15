<template>
  <div class="bf-drop-info">
    <div v-bind="getRootProps()">
      <input v-bind="getInputProps()" />
      <div
        :class="[
          isInDropZone ? 'bf-drop-info-content hover' : 'bf-drop-info-content',
        ]"
        @dragenter.self="onDragEnter"
        @dragleave.self="onDragLeave"
      >
        <img
          src="/src/assets/images/illustrations/illo-drag-and-drop.svg"
          alt="Illustration of file system"
          height="225"
          width="339"
          class="no-pointer"
        />
        <h2 class="no-pointer">Drag and drop files here</h2>
        <p class="no-pointer">
          Uploading through the browser is limited to 100 files within a single
          folder. If you’re uploading large amounts of data, please use the
          Pennsieve API.
        </p>

        <span class="no-pointer circle one" />
        <span class="no-pointer circle two" />
        <span class="no-pointer circle three" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive } from "vue";
import { pathOr } from "ramda";
import { useDropzone } from "vue3-dropzone";
import type { FileRejectReason } from "vue3-dropzone";
import EventBus from "../../../../utils/event-bus";
import { useStore } from "vuex";

const store = useStore();

const emit = defineEmits(["update:showDropInfo"]);

const props = defineProps({
  file: Object,
});

let isInDropZone = ref(false);
function onDragEnter() {
  isInDropZone.value = true;
}
function onDragLeave() {
  isInDropZone.value = false;
}
function onDrop(acceptedFiles: File[], rejectReasons: FileRejectReason[]) {
  emit("update:showDropInfo", false);
  const destinationId = pathOr("", ["file", "content", "id"], props);
  console.log("props.file in OnDrop from BfDropInfo.vue", props.file);
  store.dispatch("uploadModule/setUploadDestination", props.file);

  EventBus.$emit("add-to-upload-queue", acceptedFiles);
}

const options = reactive({
  multiple: true,
  onDrop,
});

const { getRootProps, getInputProps, isFocused, isDragReject, open } =
  useDropzone(options);
</script>

<style scoped lang="scss">
@import "../../../../assets/_variables.scss";

.no-pointer {
  pointer-events: none;
}
.bf-drop-info {
  height: 100%;
  left: 0;
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 3000;

  &:after {
    background: rgba(0, 0, 0, 0.5);
    content: "";
    height: 150vh;
    left: 0;
    position: fixed;
    top: 0;
    width: 150vw;
    z-index: 1;
  }
}
.bf-drop-info-content {
  background: $purple_1;
  border-radius: 5px;
  box-shadow: 0 2px 15px 0 rgba(0, 0, 0, 0.25),
    0 28px 41px 0 rgba(33, 43, 54, 0.2);
  box-sizing: border-box;
  color: $white;
  height: 440px;
  margin: 15vh auto 50px;
  overflow: hidden;
  padding: 16px;
  position: relative;
  text-align: center;
  width: 540px;
  z-index: 2;

  &.hover {
    box-shadow: 0 2px 15px 0 $purple_2;
  }
}
img,
h2,
p {
  position: relative;
  z-index: 1;
}
img {
  margin-bottom: 16px;
}
h2 {
  color: #fff;
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px;
}
p {
  margin: 0 auto;
  max-width: 460px;
}
.circle {
  background: $purple_2;
  border-radius: 50%;
  display: block;
  height: 193px;
  pointer-events: none;
  position: absolute;
  width: 193px;
  z-index: 0;
  &.one {
    left: -42px;
    top: -42px;
  }
  &.two {
    bottom: -107px;
    right: -83px;
  }
  &.three {
    bottom: 30px;
    height: 56px;
    left: 25px;
    width: 56px;
  }
}
</style>
