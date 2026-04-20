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

      <p class="upload-text">
        <b>Note:</b> Files can take up to a minute of processing after upload
        completes. You can check import status of files in the
        <!-- Can remove the native event modifier on the click event below, all native events to custom elements are now captured by default. 
        This is deprecated since Vue3 and can be removed. -->
        <router-link :to="{ name: 'upload-manifests' }" @click.native="onClose">
          upload manifest tracker.</router-link
        >
      </p>


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

      <div v-if="isUploading || uploadComplete">
        <div
          v-for="[key, value] in activeUploadEntries"
          :key="key"
          class="manifest-file-wrapper"
        >
          <PsUploadFile :upload-object="value" :file-key="key" />
        </div>
      </div>
      <div v-else>
        <div v-for="item in uploadFiles" class="manifest-file-wrapper">
          <PsManifestFile :file="item" />
        </div>
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

    <UploadConflictDialog
      v-model:dialogVisible="conflictDialogVisible"
      :conflicts="conflictList"
      :target="conflictTarget"
      @resolve="onConflictResolved"
    />
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
import { fileIcon } from "../../mixins/file-icon/file-icon.js";
import UploadConflictDialog from "./UploadConflictDialog/UploadConflictDialog.vue";
import {
  getUploadConflictPref,
  setUploadConflictPref,
} from "@/composables/useUploadConflictPref";
import { useGetToken } from "@/composables/useGetToken";

const store = useStore();

// Conflict-dialog state. Populated by startUpload when detectConflicts
// returns any, cleared when the dialog resolves or the upload proceeds.
const conflictDialogVisible = ref(false);
const conflictList = ref([]);
const conflictTarget = ref(null);

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

async function startUpload() {
  // Pre-flight conflict check. Collisions are detected at the immediate
  // upload destination level only (see uploadModule.detectConflicts).
  // The resolved strategy is committed to uploadModule state so the
  // finalize batcher sends it to the server in the body.
  let result = { conflicts: [], target: null };
  try {
    result = await store.dispatch("uploadModule/detectConflicts");
  } catch {
    // Detection is best-effort; server still enforces its own behavior.
    result = { conflicts: [], target: null };
  }

  const conflicts = (result && result.conflicts) || [];

  if (conflicts.length === 0) {
    store.commit("uploadModule/SET_ON_CONFLICT", "keepBoth");
    proceedWithUpload();
    return;
  }

  const pref = getUploadConflictPref();
  if (pref === "replace" || pref === "keepBoth") {
    store.commit("uploadModule/SET_ON_CONFLICT", pref);
    proceedWithUpload();
    return;
  }

  // pref === 'ask' (default) — surface the dialog and let
  // onConflictResolved drive the next step.
  conflictList.value = conflicts;
  conflictTarget.value = result && result.target;
  conflictDialogVisible.value = true;
}

async function onConflictResolved({ strategy, remember }) {
  if (strategy === "cancel") {
    // User bailed — leave state as-is, keep the upload dialog open so
    // they can decide to reset or close.
    conflictList.value = [];
    conflictTarget.value = null;
    return;
  }
  if (remember && strategy !== "replaceFolder") {
    // Don't persist the folder-replace shortcut as a default — it's a
    // one-off decision about a specific folder, not a general
    // conflict-resolution preference.
    setUploadConflictPref(strategy);
  }

  if (strategy === "replaceFolder") {
    // Whole-folder replacement: delete the target folder via the
    // existing pennsieve-api endpoint and wait for it to complete before
    // uploading. Scala's PackageManager.delete cascades state=DELETING
    // to all descendants and schedules one DeletePackageJob for the
    // whole subtree — the jobs service handles the async S3 cleanup.
    const target = conflictTarget.value;
    conflictList.value = [];
    conflictTarget.value = null;
    try {
      await deleteFolderForReplace(target);
    } catch (err) {
      console.error("Replace-folder failed; falling back to per-file replace:", err);
      store.commit("uploadModule/SET_ON_CONFLICT", "replace");
      proceedWithUpload();
      return;
    }
    // Folder is in DELETING state now — its children carry the
    // __DELETED__ prefix, so the new uploads can't collide with them.
    store.commit("uploadModule/SET_ON_CONFLICT", "keepBoth");
    proceedWithUpload();
    return;
  }

  store.commit("uploadModule/SET_ON_CONFLICT", strategy);
  conflictList.value = [];
  conflictTarget.value = null;
  proceedWithUpload();
}

async function deleteFolderForReplace(target) {
  if (!target || !target.nodeId || target.packageType !== "Collection") {
    throw new Error("deleteFolderForReplace: target is not a folder");
  }
  const token = await useGetToken();
  const apiUrl = store.state.config.apiUrl;
  const url = `${apiUrl}/packages/${target.nodeId}?api_key=${token}`;
  const resp = await fetch(url, { method: "DELETE" });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`DELETE /packages/${target.nodeId} failed (${resp.status}): ${text}`);
  }
}

function proceedWithUpload() {
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

.upload-text {
  margin: 0 0 16px 0;
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

.manifest-file-wrapper {
  max-height: 400px;
  overflow: scroll;

  &:first-child {
    border-top: 1px solid theme.$gray_2;
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
