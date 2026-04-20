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
  <div class="bf-upload">
    <el-dialog
      :modelValue="dialogVisible"
      :show-close="true"
      :close-on-click-modal="false"
      @close="onClose"
    >
      <template #header>
        <bf-dialog-header :title="dialogTitle" />
      </template>

      <div v-if="!isUploading" v-bind="getRootProps()">
        <input v-bind="getInputProps()" />
        <div
          :class="[
            isInDropZone
              ? 'bf-drop-info-content hover condensed'
              : 'bf-drop-info-content condensed',
          ]"
          @dragenter.self="onDragEnter"
          @dragover.prevent="onDragEnter"
          @dragleave.self="onDragLeave"
        >
          <div class="upload-icons-wrap">
            <IconPDF class="file-icon" />
            <img
              class="file-icon"
              :src="fileIcon('Image', 'Image')"
              alt="Image Icon"
            />
            <IconUpload class="file-icon upload" />
            <IconTimeseries class="file-icon time-series" />

            <img
              class="file-icon microscope"
              :src="fileIcon('Microscope', 'Slide')"
              alt="Microscopy Icon"
            />
          </div>
          <h3>
            Drag and drop files here or
            <a href="#"> choose your files </a>.
          </h3>
        </div>
      </div>

      <!--
        Scrollable file area. Groups files by the dropped subfolder path
        so a 500-file folder drop renders as a handful of collapsible-
        looking folder rows instead of a flat wall. The fixed
        max-height keeps the conflict picker + footer buttons below
        always on-screen regardless of batch size.
      -->
      <div
        v-if="(isUploading || uploadComplete) && activeUploadEntries.length > 0"
        class="file-list-scroll"
      >
        <div
          v-for="[folder, entries] in uploadGroups"
          :key="folder || '__root__'"
          class="folder-group"
        >
          <div v-if="folder" class="folder-header">
            <IconCollection :height="14" :width="14" />
            <span class="folder-name">{{ folder }}</span>
            <span class="folder-count">{{ entries.length }}</span>
          </div>
          <div
            v-for="[key, value] in entries"
            :key="key"
            class="manifest-file-wrapper"
            :class="{ 'file-indented': !!folder }"
          >
            <PsUploadFile :upload-object="value" :file-key="key" />
          </div>
        </div>
      </div>
      <div
        v-else-if="uploadFiles.length > 0"
        class="file-list-scroll"
      >
        <div
          v-for="[folder, items] in manifestGroups"
          :key="folder || '__root__'"
          class="folder-group"
        >
          <div v-if="folder" class="folder-header">
            <IconCollection :height="14" :width="14" />
            <span class="folder-name">{{ folder }}</span>
            <span class="folder-count">{{ items.length }}</span>
          </div>
          <div
            v-for="item in items"
            :key="item.path || item.name"
            class="manifest-file-wrapper"
            :class="{ 'file-indented': !!folder }"
          >
            <PsManifestFile :file="item" />
          </div>
        </div>
      </div>

      <!--
        On-conflict picker: controls how the server resolves name
        collisions against existing packages in the target folder.
        "Keep both" (default) mirrors the legacy auto-rename behaviour;
        "Replace" soft-deletes the predecessor and records provenance
        (see upload-service-v2 feature_onconflict_replace).
      -->
      <div
        v-if="!isUploading && !uploadComplete && uploadFiles.length > 0"
        class="conflict-picker"
      >
        <div class="conflict-picker-label">
          If a file name already exists:
        </div>
        <label class="conflict-option">
          <input
            type="radio"
            value="keepBoth"
            :checked="onConflict === 'keepBoth'"
            @change="setOnConflict('keepBoth')"
          />
          <span>Keep both (auto-rename new file)</span>
        </label>
        <label class="conflict-option">
          <input
            type="radio"
            value="replace"
            :checked="onConflict === 'replace'"
            @change="setOnConflict('replace')"
          />
          <span>Replace existing file</span>
        </label>
      </div>

      <template #footer>
        <bf-button
          v-if="!isUploading && !uploadComplete"
          class="secondary"
          @click="cancelQueue"
        >
          Reset
        </bf-button>
        <bf-button
          v-if="!isUploading && !uploadComplete"
          @click="startUpload"
        >
          Start Upload
        </bf-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { reactive, computed, ref } from "vue";
import { useStore } from "vuex";
import BfButton from "../shared/bf-button/BfButton.vue";
import BfDialogHeader from "../shared/bf-dialog-header/BfDialogHeader.vue";
import { FileRejectReason, useDropzone } from "vue3-dropzone";
import PsUploadFile from "./PsUploadFile.vue";
import PsManifestFile from "./PsManifestFile.vue";
import IconPDF from "../icons/IconPDF.vue";
import IconTimeseries from "../icons/IconTimeseries.vue";
import IconUpload from "../icons/IconUpload.vue";
import IconCollection from "../icons/IconCollection.vue";
import { fileIcon } from "../../mixins/file-icon/file-icon.js";

const store = useStore();

defineExpose({
  onDrop,
});

const emit = defineEmits(["update:dialogVisible"]);

const props = defineProps({
  file: Object,
  dialogVisible: Boolean,
});

const uploadFiles = computed(() =>
  store.getters["uploadModule/getManifestFiles"]()
);
const uploadMap = computed(() => store.getters["uploadModule/getUploadMap"]());

// Entries from the *current* upload batch only. Finalized entries from a
// previous batch stay in uploadFileMap so their placeholder rows can
// remain in the DatasetFiles table until the Pusher-driven silent
// refresh confirms them — but they shouldn't appear in this dialog when
// the user starts a new drop. "finalized" = "user's work done for that
// file"; the dialog is for work-in-progress.
const activeUploadEntries = computed(() => {
  const out = [];
  for (const entry of uploadMap.value) {
    if (entry[1].status !== "finalized") out.push(entry);
  }
  return out;
});

// Group pre-sync manifest files by their dropped subfolder path. Root-
// level files (webkitRelativePath === "" or just filename) go into the
// "" key and render without a folder header.
const manifestGroups = computed(() => {
  const groups = new Map();
  for (const f of uploadFiles.value) {
    const path = (f.path || f.name) as string;
    const lastSlash = path.lastIndexOf("/");
    const folder = lastSlash >= 0 ? path.slice(0, lastSlash) : "";
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(f);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === "") return -1;
    if (b === "") return 1;
    return a.localeCompare(b);
  });
});

// Same grouping for in-flight uploads. target_path on the uploadFileMap
// entry is the full path from dataset root (destination + subfolder);
// strip the destination prefix so the dialog shows just the user-
// relative structure of their drop.
const uploadGroups = computed(() => {
  const destPath =
    (store.getters["uploadModule/getUploadDestination"]()?.path as string) ||
    "";
  const groups = new Map();
  for (const [key, value] of activeUploadEntries.value) {
    const fullPath = (value.config && value.config.target_path) || "";
    let rel = fullPath;
    if (destPath && rel.startsWith(destPath)) {
      rel = rel.slice(destPath.length).replace(/^\//, "");
    }
    if (!groups.has(rel)) groups.set(rel, []);
    groups.get(rel).push([key, value]);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === "") return -1;
    if (b === "") return 1;
    return a.localeCompare(b);
  });
});
const isUploading = computed(() =>
  store.getters["uploadModule/getIsUploading"]()
);
const uploadComplete = computed(() =>
  store.getters["uploadModule/getUploadComplete"]()
);
const totalFilesInBatch = computed(() =>
  store.getters["uploadModule/getTotalFilesInBatch"]()
);
const cancelBtnText = computed(() => (isUploading.value ? "Hide" : "Reset"));

const onConflict = computed(() =>
  store.getters["uploadModule/getOnConflict"]()
);
function setOnConflict(value: "keepBoth" | "replace") {
  store.dispatch("uploadModule/setOnConflict", value);
}

const allFilesComplete = computed(() => {
  const map = uploadMap.value;
  if (map.size === 0) return false;
  for (const [, value] of map) {
    // See BfUploadInfo.vue allFilesComplete — both "processing" and
    // "finalized" mean the user's work is done; the server is catching up.
    if (value.status !== "processing" && value.status !== "finalized") {
      return false;
    }
  }
  return true;
});

const dialogTitle = computed(() => {
  if (allFilesComplete.value || isUploading.value) {
    const fileWord = totalFilesInBatch.value === 1 ? "File" : "Files";
    return `Uploading ${totalFilesInBatch.value} ${fileWord}`;
  }
  return "Add Files to Upload";
});

function cancelQueue() {
  if (isUploading.value) {
    onClose();
  } else {
    store.dispatch("uploadModule/resetUpload");
  }
}

function onDrop(acceptedFiles: File[]) {
  isInDropZone.value = false;
  store.dispatch("uploadModule/addManifestFiles", acceptedFiles);
}

function startUpload() {
  store
    .dispatch("uploadModule/getManifestNodeId")
    .then(() => store.dispatch("uploadModule/syncManifest"))
    .then(() => store.dispatch("uploadModule/UploadFiles"));

  onClose();
}

function onClose() {
  emit("update:dialogVisible", false);
}

let isInDropZone = ref(false);
function onDragEnter() {
  isInDropZone.value = true;
}
function onDragLeave() {
  isInDropZone.value = false;
}

const options = reactive({
  multiple: true,
  onDrop,
});

const { getRootProps, getInputProps, isFocused, isDragReject, open } =
  useDropzone(options);
</script>

<style scoped lang="scss">
@use "../../styles/theme";
@use "../../styles/element/dialog";

.clear-action-wrapper {
  display: flex;
  align-items: end;
  flex-direction: column;

  .clear-action {
    color: theme.$purple_3;
    cursor: pointer;
    margin-right: 4px;
  }
}

.file-icon {
  width: 24px;
  height: 24px;
  color: red;

  &.microscope {
    color: theme.$purple_2;
  }

  &.time-series {
    color: theme.$purple_1;
  }

  &.upload {
    color: theme.$purple_2;
  }
}

// The inherited per-wrapper scroll made every row individually
// scrollable — a mistake since rows are short. Scroll is now on the
// outer file-list-scroll container so the conflict-picker and footer
// stay pinned below the list.
.file-list-scroll {
  border: 1px solid theme.$gray_2;
  margin-bottom: 16px;
  max-height: 260px;
  overflow-y: auto;
}
.folder-group {
  & + & {
    border-top: 1px solid theme.$gray_2;
  }
}
.folder-header {
  align-items: center;
  background: theme.$gray_1;
  color: theme.$gray_6;
  display: flex;
  font-size: 12px;
  font-weight: 500;
  gap: 8px;
  padding: 6px 12px;
  position: sticky;
  top: 0;
  z-index: 1;
}
.folder-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.folder-count {
  color: theme.$gray_4;
  font-size: 11px;
}
.manifest-file-wrapper {
  &.file-indented {
    padding-left: 20px;
  }
}

// Last row of each folder group has no bottom border — the next group's
// top border (or the outer scroll container's bottom edge for the final
// group) provides the separation.
.folder-group .manifest-file-wrapper:last-child {
  :deep(.manifest-file),
  :deep(.upload-file) {
    border-bottom: none;
  }
}

.conflict-picker {
  border-top: 1px solid theme.$gray_2;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 16px;
  padding-top: 16px;
}
.conflict-picker-label {
  color: theme.$gray_6;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
}
.conflict-option {
  align-items: center;
  color: theme.$gray_5;
  cursor: pointer;
  display: flex;
  font-size: 13px;
  gap: 8px;

  input[type="radio"] {
    // accent-color tints the native radio fill + focus ring (Chrome/
    // Firefox/Safari 15+). Cheaper than a fully custom radio control and
    // keeps keyboard/focus a11y behaviour intact.
    accent-color: theme.$purple_2;
    cursor: pointer;
    margin: 0;
  }
}

.bf-drop-info-content {
  align-items: center;
  border-style: dashed;
  border-color: red;
  border-image-source: url("/src/assets/images/dotted-border.svg");
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
    border: 2px solid theme.$green_1;
  }

  &.condensed {
    color: theme.$gray_4;
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
        color: theme.$purple_2;
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
