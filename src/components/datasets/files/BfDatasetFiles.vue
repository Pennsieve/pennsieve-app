<template>
  <bf-stage
    class="bf-stage-file"
    slot="stage"
    element-loading-background="transparent"
    @drop="onDrop"
    @dragover.prevent
    @dragenter="onDragEnter"
  >
    <template #actions>
      <stage-actions v-if="trashMode">
        <template #left>
          <button class="trash-back-btn" @click="exitTrashMode">
            <IconArrowLeft :height="12" :width="12" />
            Back to Files
          </button>
          <breadcrumb-navigation
            v-if="trashAncestors.length > 0"
            is-light-background
            :ancestors="trashAncestors"
            :file="trashFile"
            :file-id="trashFile?.content?.id"
            @navigate-breadcrumb="onTrashBreadcrumbNavigate"
          />
        </template>
        <template #right>
          <bf-button
            v-if="selectedTrashFiles.length > 0"
            class="mr-8"
            @click="restoreTrashFiles"
          >
            Restore {{ selectedTrashFiles.length }} file{{ selectedTrashFiles.length !== 1 ? 's' : '' }}
          </bf-button>
          <span class="trash-icon-indicator">
            <IconTrash :height="18" :width="18" />
          </span>
        </template>
      </stage-actions>
      <stage-actions v-else>
        <template #left>
          <breadcrumb-navigation
            :ancestors="ancestors"
            :file="file"
            :file-id="$route.params.fileId"
            @navigate-breadcrumb="handleNavigateBreadcrumb"
          />
        </template>
        <template #right>
          <bf-button
            v-if="getPermission('editor')"
            class="flex"
            :disabled="datasetLocked"
            data-cy="createNewFolder"
            @click="openPackageDialog"
          >
            <template #prefix>
              <IconPlus class="mr-8" :height="20" :width="20" />
            </template>
            New Folder
          </bf-button>

          <bf-button
            class="flex"
            @click="showUpload"
          >
            <template #prefix>
              <IconUpload class="mr-8" :height="20" :width="20" />
            </template>
            Upload
          </bf-button>

          <el-dropdown trigger="click" @command="handleActionCommand">
            <button class="more-btn" title="More actions">
              <span class="more-dots">···</span>
            </button>
            <template #dropdown>
              <el-dropdown-menu class="file-actions-menu">
                <el-dropdown-item command="manifest">
                  <IconAnnotation :height="16" :width="16" />
                  <span>Generate Manifest</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <button class="trash-icon-btn" @click="enterTrashMode" title="Trash">
            <IconTrash :height="20" :width="20" />
          </button>
        </template>
      </stage-actions>
    </template>

    <div class="file-meta-wrapper">
      <div class="table-column">
        <div v-show="selectedFiles.length > 0 && !trashMode" class="selection-bar">
          <span class="selection-count">{{ selectedFiles.length }} selected</span>
          <div class="selection-actions">
            <button
              v-if="selectedFiles.length === 1"
              class="selection-action-btn"
              :disabled="datasetLocked"
              @click="startInlineRename"
            >
              <IconPencil :height="14" :width="14" />
              Rename
            </button>
            <button class="selection-action-btn" :disabled="datasetLocked" @click="showDeleteDialog">
              <IconTrash :height="14" :width="14" />
              Delete
            </button>
            <button class="selection-action-btn" :disabled="datasetLocked" @click="showMove">
              <IconMoveFile :height="14" :width="14" />
              Move
            </button>
            <button class="selection-action-btn" @click="downloadSelected">
              <IconUpload :height="14" :width="14" />
              Download
            </button>
            <button
              v-if="selectedFiles.length === 1"
              class="selection-action-btn"
              @click="copySelectedFileUrl"
            >
              <IconCopyDocument :height="14" :width="14" />
              Copy Link
            </button>
          </div>
          <button class="selection-action-btn selection-clear" @click="resetSelectedFiles">
            Clear
          </button>
        </div>
        <div v-show="selectedTrashFiles.length > 0 && trashMode" class="selection-bar">
          <span class="selection-count">{{ selectedTrashFiles.length }} selected</span>
          <div class="selection-actions">
            <button class="selection-action-btn" @click="restoreTrashFiles">
              <IconMoveFile :height="14" :width="14" />
              Restore
            </button>
          </div>
          <button class="selection-action-btn selection-clear" @click="selectedTrashFiles = []">
            Clear
          </button>
        </div>
        <div class="table-container" ref="tableContainer" @scroll="handleScroll" v-if="!trashMode">
        <files-table
          ref="filesTable"
          :data="files"
          :multiple-selected="multipleSelected"
          :table-loading="filesLoading"
          :is-package-attachment-active="isPackageAttachmentActive"
          :renaming-file-id="renamingFileId"
          @rename-submit="submitInlineRename"
          @rename-cancel="cancelInlineRename"
          @move="showMove"
          @delete="showDeleteDialog"
          @process="processFile"
          @copy-url="getPresignedUrl"
          @selection-change="setSelectedFiles"
          @click-file-label="onClickLabel"
          @select-for-attachment="onSelectForAttachment"
        />
        <div class="loading-spinner-container" v-if="filesLoading && !lastPage">
          <!-- <el-spinner class="loading-spinner" /> -->
        </div>
      </div>
        <div class="table-container" v-if="trashMode">
          <div v-if="trashFiles.length === 0 && !filesLoading" class="trash-empty">
            <IconTrash :height="32" :width="32" />
            <p>Trash is empty</p>
          </div>
          <files-table
            v-else
            ref="trashTable"
            :data="trashFiles"
            :multiple-selected="selectedTrashFiles.length > 1"
            :table-loading="filesLoading"
            @selection-change="setSelectedTrashFiles"
            @click-file-label="onTrashFileClick"
          />
        </div>
      </div>
      <file-metadata-info
        v-if="!trashMode"
        :selectedFiles="selectedFiles"
        :ancestors="ancestors"
        :folder="file"
      />
    </div>

    <bf-package-dialog
      ref="packageDialog"
      :parent-folder="file"
      :files="files"
      :dialog-visible="packageDialogVisible"
      @file-renamed="onFileRenamed"
      @folder-created="onFolderCreated"
      @close="onClosePackageDialog"
    />

    <deleted-files
      :open.sync="deletedDialogOpen"
      @close-deleted-dialog="closeDeletedDialog"
    />

    <bf-move-dialog
      ref="moveDialog"
      v-model:dialog-visible="moveDialogVisible"
      v-model:move-conflict="moveConflict"
      :selected-files="selectedFiles"
      @rename-conflicts="onRenameConflicts"
      @completeMove="moveItems"
      @close="onCloseMoveDialog"
    />

    <RenameFileDialog
      v-model:dialog-visible="renameDialogVisible"
      :files="files"
      :file="selectedFileForAction"
      @file-renamed="onFileRenamed"
      @close="onCloseRenameFileDialog"
    />

    <bf-delete-dialog
      ref="deleteDialog"
      :dialog-visible="deleteDialogVisible"
      :selected-files="selectedFiles"
      @file-delete="onDelete"
      @close="onCloseDeleteDialog"
    />

    <bf-drop-info
      v-if="showDropInfo"
      v-model:show-drop-info="showDropInfo"
      :file="file"
    />

    <bf-upload-info v-if="showUploadInfo" />
  </bf-stage>
</template>

<script>
import { mapGetters, mapActions, mapState } from "vuex";
import {
  assocPath,
  head,
  pathOr,
  propOr,
  find,
  pathEq,
  findIndex,
  pluck,
} from "ramda";

import BfRafter from "../../shared/bf-rafter/BfRafter.vue";
import BfButton from "../../shared/bf-button/BfButton.vue";
import BfPackageDialog from "./bf-package-dialog/BfPackageDialog.vue";
import BfDeleteDialog from "./bf-delete-dialog/BfDeleteDialog.vue";
import BfMoveDialog from "./bf-move-dialog/BfMoveDialog.vue";
import BreadcrumbNavigation from "./BreadcrumbNavigation/BreadcrumbNavigation.vue";
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";
import BfDropInfo from "./bf-drop-info/BfDropInfo.vue";
import BfUploadInfo from "./bf-upload-info/BfUploadInfo.vue";
import FilesTable from "../../FilesTable/FilesTable.vue";
import BfUploadMenu from "./bf-upload-menu/BfUploadMenu.vue";
import DeletedFiles from "../../DeletedFiles/DeletedFiles.vue";
import Sorter from "../../../mixins/sorter/index";
import Request from "../../../mixins/request/index";
import EventBus from "../../../utils/event-bus";
import GetFileProperty from "../../../mixins/get-file-property";
import FileMetadataInfo from "./Metadata/FileMetadataInfo.vue";
import LockedBanner from "../LockedBanner/LockedBanner.vue";
import { useMetadataStore } from "../../../stores/metadataStore.js";
import IconPlus from "../../icons/IconPlus.vue";
import IconTrash from "../../icons/IconTrash.vue";
import IconMoveFile from "../../icons/IconMoveFile.vue";
import IconArrowDown from "../../icons/IconArrowDown.vue";
import IconArrowLeft from "../../icons/IconArrowLeft.vue";
import IconPencil from "../../icons/IconPencil.vue";
import IconCopyDocument from "../../icons/IconCopyDocument.vue";
import StageActions from "../../shared/StageActions/StageActions.vue";
import RenameFileDialog from "./RenameFileDialog.vue";
import { copyText } from "vue3-clipboard";
import IconUpload from "../../icons/IconUpload.vue";

import PsButtonDropdown from "@/components/shared/ps-button-dropdown/PsButtonDropdown.vue";
import IconAnnotation from "@/components/icons/IconAnnotation.vue";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";

export default {
  name: "BfDatasetFiles",

  components: {
    IconAnnotation,
    IconUpload,
    RenameFileDialog,
    StageActions,
    IconTrash,
    IconMoveFile,
    IconArrowDown,
    IconArrowLeft,
    IconPencil,
    IconCopyDocument,
    IconPlus,
    BfRafter,
    BfButton,
    BfEmptyPageState,
    BfPackageDialog,
    BfDeleteDialog,
    BfMoveDialog,
    BfDropInfo,
    BfUploadInfo,
    BreadcrumbNavigation,
    BfUploadMenu,
    FilesTable,
    LockedBanner,
    DeletedFiles,
    FileMetadataInfo,
    PsButtonDropdown,
  },

  props: {
    fileId: {
      type: String,
      default: "",
    },
    datasetId: {
      type: String,
      default: "",
    },
  },

  mixins: [Sorter, Request, GetFileProperty],

  data: function () {
    return {
      quickActionsVisible: true,
      file: {
        content: {
          name: "",
        },
      },
      ancestors: [],
      files: [],
      sortedFiles: [],
      selectedFiles: [],
      moveConflict: {},
      showDropInfo: false,
      sortDirection: "asc",
      singleFile: {},
      deletedDialogOpen: false,
      trashMode: false,
      trashFiles: [],
      trashAncestors: [],
      trashFile: { content: { name: '' } },
      selectedTrashFiles: [],
      limit: 500,
      offset: 0,
      allowFetch: true,
      filesLoading: false,
      lastPage: false,
      packageDialogVisible: false,
      deleteDialogVisible: false,
      renameDialogVisible: false,
      renamingFileId: null,
      moveDialogVisible: false,
      selectedFileForAction: {},
      pusherChannelName: "",
      pusherChannel: {},
    };
  },

  computed: {
    ...mapState(["activeOrganization"]),
    ...mapGetters([
      "config",
      "uploading",
      "dataset",
      "hasFeature",
      "filesProxyId",
      "getPermission",
      "datasetLocked",
    ]),
    ...mapGetters("uploadModule", ["getIsUploading", "getUploadComplete", "getUploadMap"]),

    ...mapGetters("datasetModule", [
      "getPusherChannel",
      "getManifestNotification",
    ]),

    showUploadInfo: function () {
      const hasFiles = this.getUploadMap().size > 0;
      return hasFiles && (this.getUploadComplete() || this.getIsUploading());
    },

    /**
     * Compute organization's ID
     * @returns {String}
     */
    organizationId: function () {
      return pathOr("", ["organization", "id"], this.activeOrganization);
    },
    /**
     * Item has files
     */
    hasFiles: function () {
      return this.files.length > 0;
    },

    filesUrl: function () {
      const baseUrl =
        this.$route.name === "dataset-files" ? "datasets" : "packages";
      const id =
        this.$route.name === "dataset-files"
          ? this.$route.params.datasetId
          : this.$route.params.fileId;
      return `${this.config.apiUrl}/${baseUrl}/${id}?includeAncestors=true&limit=${this.limit}&offset=${this.offset}`;
    },

    /**
     * Get move URL
     * @returns {String}
     */
    moveUrl: async function () {
      return useGetToken().then((token) => {
        return `${this.config.apiUrl}/data/move?api_key=${token}`;
      });
    },

    /**
     * Compute if multiple files are selected
     * @returns {Boolean}
     */
    multipleSelected: function () {
      return this.selectedFiles.length > 1;
    },

    /**
     * Compute if the user has explore feature flag
     * @returns {Boolean}
     */
    isExploreEnabled: function () {
      return this.hasFeature("concepts_feature");
    },
    /**
     * Check if package attachment is active
     * @returns {Boolean}
     */
    isPackageAttachmentActive: function () {
      const metadataStore = this.getMetadataStore();
      return !!metadataStore.activePackageAttachment;
    },
  },

  watch: {
    getManifestNotification: {
      handler(newValue, oldValue) {
        // Only show toast if we have a valid URL (prevents banner on mount with empty state)
        if (newValue && newValue.url) {
          EventBus.$emit("toast", {
            detail: {
              type: "warning",
              msg: `The manifest has been generated: <a href=${newValue.url} download>Download Manifest</a>`,
              duration: 0,
              showClose: true,
            },
          });
        }
      },
      deep: true,
    },

    "$store.state.uploadModule.uploadComplete": function () {
      setTimeout(() => {
        this.resetUpload();
      }, 120000);
    },

    "$route.query.pkgId": {
      handler: function (val, old) {
        if (val !== old) {
          this.scrollToFile(val);
        }
      },
    },
    getPusherChannel: {
      handler(channel) {
        function isEmpty(obj) {
          for (const prop in obj) {
            if (Object.hasOwn(obj, prop)) {
              return false;
            }
          }
          return true;
        }

        if (!isEmpty(channel)) {
          channel.bind(
            "upload-event",
            function (data) {
              let curFolderId = this.file.content.intId;
              for (let x in data) {
                this.updateFileStatus({
                  key: data[x].upload_id.String,
                  status: "complete",
                });
              }

              for (let x in data) {
                if ((data[x].parent_id.Int64 = curFolderId)) {
                  this.fetchFiles(this.filesUrl);
                  break;
                }
              }
            }.bind(this)
          );
        }
      },
      immediate: true,
    },

    $route: "handleRouteChange",
  },

  mounted: function () {
    if (this.filesUrl && !this.files.length) {
      this.fetchFiles();
    }

    this.$el.addEventListener("dragenter", this.onDragEnter.bind(this));
    EventBus.$on("add-uploaded-file", this.onAddUploadedFile.bind(this));
    EventBus.$on("dismiss-upload-info", this.onDismissUploadInfo.bind(this));
    EventBus.$on("rename-file", this.showRenameFileDialog.bind(this));

    EventBus.$on(
      "update-uploaded-file-state",
      this.onUpdateUploadedFileState.bind(this)
    );
    EventBus.$on("openDeletedModal", (data) => {
      this.deletedDialogOpen = data;
      this.fetchDeleted();
    });
    EventBus.$on("refreshAfterDeleteModal", (data) => {
      var temp = data;
      this.fetchFiles(this.filesUrl);
    });
    EventBus.$on("refreshAfterRestore", () => {
      this.fetchFiles(this.filesUrl);
    });
  },

  beforeUnmount() {
    const pusherCh = this.getPusherChannel;
    pusherCh.unbind("upload-event");
  },

  unmounted: function () {
    this.$el.removeEventListener("dragenter", this.onDragEnter.bind(this));
    EventBus.$off("rename-file", this.showRenameFileDialog.bind(this));
    EventBus.$off("add-uploaded-file", this.onAddUploadedFile.bind(this));
    EventBus.$off("dismiss-upload-info", this.onDismissUploadInfo.bind(this));
    EventBus.$off(
      "update-uploaded-file-state",
      this.onUpdateUploadedFileState.bind(this)
    );
  },

  /**
   * Reset props before route change
   * @param {Object} to
   * @param {Object} from
   * @param {Function} next
   */
  beforeRouteUpdate(to, from, next) {
    this.resetSelectedFiles();

    next();
  },

  methods: {
    ...mapActions("uploadModule", [
      "resetUpload",
      "updateFileStatus",
      "setCurrentTargetPackage",
    ]),
    ...mapActions("datasetsModule", ["createDatasetManifest"]),

    ...mapActions("datasetsModule", ["createDatasetManifest"]),

    // Helper method to get metadataStore instance
    getMetadataStore() {
      return useMetadataStore();
    },

    generateManifest: function () {
      this.createDatasetManifest();

      EventBus.$emit("toast", {
        detail: {
          type: "success",
          msg: "Dataset manifest is being prepared.",
          duration: 1000,
        },
      });
    },

    toggleActionDropdown: function () {
      this.quickActionsVisible = !this.quickActionsVisible;
    },

    // Ignore drops to component outside the drop target and close drop-target
    onDrop: function (e) {
      e.preventDefault();
      e.stopPropagation();
      this.showDropInfo = false;
    },
    onCloseRenameFileDialog: function () {
      this.renameDialogVisible = false;
    },
    showRenameFileDialog: function () {
      this.selectedFileForAction = this.selectedFiles[0];
      this.renameDialogVisible = true;
    },
    startInlineRename: function () {
      if (this.selectedFiles.length === 1) {
        const file = this.selectedFiles[0];
        const fileId = file.content?.id || file.content?.nodeId;
        this.renamingFileId = fileId;
      }
    },

    cancelInlineRename: function () {
      this.renamingFileId = null;
    },

    submitInlineRename: async function (file, newName) {
      const currentName = file.content?.name;
      if (!newName || newName === currentName) {
        this.renamingFileId = null;
        return;
      }

      try {
        const token = await useGetToken();
        const id = file.content?.id;
        const url = `${this.config.apiUrl}/packages/${id}?api_key=${token}`;
        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName }),
        });

        if (response.ok) {
          const updated = await response.json();
          this.onFileRenamed(updated);
          EventBus.$emit("toast", {
            detail: { type: "success", msg: "File renamed" },
          });
        } else {
          const data = await response.json();
          EventBus.$emit("toast", {
            detail: { type: "error", msg: data.message || "Failed to rename" },
          });
        }
      } catch (err) {
        console.error("Rename failed:", err);
        EventBus.$emit("toast", {
          detail: { type: "error", msg: "Failed to rename file" },
        });
      } finally {
        this.renamingFileId = null;
      }
    },

    copySelectedFileUrl: function () {
      if (this.selectedFiles.length === 1) {
        this.getPresignedUrl(this.selectedFiles[0]);
      }
    },

    downloadSelected: function () {
      EventBus.$emit("trigger-download", this.selectedFiles);
    },

    handleActionCommand: function (command) {
      switch (command) {
        case 'upload':
          this.showUpload();
          break;
        case 'manifest':
          this.generateManifest();
          break;
      }
    },

    enterTrashMode: function () {
      this.trashMode = true;
      this.$store.commit('SET_CURRENT_FOLDER', { name: 'Trash', ancestors: [], isTrash: true });
      this.trashFiles = [];
      this.trashAncestors = [];
      this.trashFile = { content: { name: '' } };
      this.selectedTrashFiles = [];
      this.fetchTrashFiles();
    },

    exitTrashMode: function () {
      this.trashMode = false;
      this.trashFiles = [];
      this.selectedTrashFiles = [];
      this.$store.commit('SET_CURRENT_FOLDER', { name: '', ancestors: [], isTrash: false });
    },

    fetchTrashFiles: function (rootNodeId) {
      this.filesLoading = true;
      useGetToken()
        .then(token => {
          let url = `${this.config.api2Url}/datasets/trashcan?dataset_id=${this.$route.params.datasetId}&limit=100&offset=0`;
          if (rootNodeId) {
            url += `&root_node_id=${rootNodeId}`;
          }
          return fetch(url, {
            method: 'GET',
            headers: {
              accept: 'application/json',
              authorization: `Bearer ${token}`,
            },
          })
            .then(response => {
              if (response.ok) {
                return response.json().then(data => {
                  const packages = data.packages || [];
                  this.trashFiles = packages.map(file => ({
                    ...file,
                    content: {
                      packageType: file.type,
                      name: file.name.replace(`__DELETED__${file.node_id}_`, ''),
                      id: file.node_id,
                      createdAt: file.created_at,
                    },
                    storage: file.size || 0,
                    subtype: file.type === 'Collection' ? 'Folder' : '',
                  }));
                });
              }
            });
        })
        .catch(err => console.error('Failed to fetch trash:', err))
        .finally(() => {
          this.filesLoading = false;
        });
    },

    onTrashFileClick: function (file) {
      const packageType = pathOr('', ['content', 'packageType'], file);
      if (packageType === 'Collection') {
        const fileId = file.content?.id || file.node_id;
        const fileName = file.content?.name || file.name;
        if (fileId && fileName) {
          this.trashAncestors.push({
            content: { id: fileId, name: fileName }
          });
        }
        this.trashFile = file;
        this.fetchTrashFiles(fileId);
      }
    },

    onTrashBreadcrumbNavigate: function (id) {
      if (id) {
        const index = this.trashAncestors.findIndex(a => a.content.id === id);
        if (index >= 0) {
          this.trashFile = this.trashAncestors[index];
          this.trashAncestors.splice(index);
        }
        this.fetchTrashFiles(id);
      } else {
        this.trashAncestors = [];
        this.trashFile = { content: { name: '' } };
        this.fetchTrashFiles();
      }
    },

    setSelectedTrashFiles: function (selection) {
      this.selectedTrashFiles = selection;
    },

    restoreTrashFiles: function () {
      useGetToken()
        .then(token => {
          const nodeIds = this.selectedTrashFiles.map(item => item.node_id);
          return fetch(
            `${this.config.api2Url}/packages/restore?dataset_id=${this.$route.params.datasetId}`,
            {
              method: 'POST',
              headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ nodeIds }),
            }
          ).then(response => {
            if (response.ok) {
              return response.json().then(data => {
                const successItems = data.success || [];
                const failureItems = data.failures || [];
                if (failureItems.length > 0) {
                  EventBus.$emit('toast', {
                    detail: { msg: `Failed to restore ${failureItems.length} file(s)`, type: 'error' },
                  });
                }
                if (successItems.length > 0) {
                  EventBus.$emit('toast', {
                    detail: { msg: `${successItems.length} file(s) restored successfully`, type: 'success' },
                  });
                }
                this.selectedTrashFiles = [];
                this.fetchTrashFiles(this.trashFile?.content?.id || undefined);
              });
            }
          });
        })
        .catch(err => console.error('Failed to restore:', err));
    },

    showDeleteDialog: function () {
      this.selectedFileForAction = {};
      this.deleteDialogVisible = true;
    },
    onCloseDeleteDialog: function () {
      this.deleteDialogVisible = false;
    },
    onClosePackageDialog: function () {
      this.packageDialogVisible = false;
    },
    handleScroll: function (event) {
      const { clientHeight, scrollTop, scrollHeight } = event.currentTarget;

      const atBottomOfWindow = clientHeight === scrollHeight - scrollTop;
      if (
        atBottomOfWindow &&
        this.files.length >= this.limit &&
        this.allowFetch
      ) {
        this.allowFetch = false;
        this.offset = this.offset + this.limit;
        this.fetchFiles();
        event.currentTarget.scrollTop = scrollTop - 20;
      }
    },
    //Navigates to dataset trash bin modal
    NavToDeleted: function () {
      //CONSIDER DOING SOMETHING LIKE FETCHFILES()
      EventBus.$emit("openDeletedModal", true);
    },
    fetchDeleted: function () {
      EventBus.$emit("fetchDeleted", true);
    },

    closeDeletedDialog: function () {
      this.deletedDialogOpen = false;
    },

    /**
     * Set selected files
     * @param {Array} selection
     */
    setSelectedFiles: function (selection) {
      this.selectedFiles = selection;
    },

    /**
     * Reset selected files state
     */
    resetSelectedFiles: function () {
      this.selectedFiles = [];
      this.lastSelectedFile = {};
      // Clear the table's internal selection state
      this.$refs.filesTable?.clearAllSelected();
    },

    /**
     * Set subtype of file, defaulting to package type
     * @param {Object} file
     * @returns {String}
     */
    getSubType: function (file) {
      const subtype = this.getFilePropertyVal(file.properties, "subtype");

      let defaultType = "";
      const packageType = pathOr("", ["content", "packageType"], file);
      switch (packageType) {
        case "Collection":
          defaultType = "Folder";
          break;
        case "ExternalFile":
          defaultType = "External File";
          break;
        default:
          break;
      }

      return subtype ? subtype : defaultType;
    },

    /**
     * Send API request to get files for item
     */
    fetchFiles: function (url) {
      this.filesLoading = true;
      this.resetSelectedFiles();
      this.$store.commit('SET_CURRENT_FOLDER', { name: '', ancestors: [] });

      useGetToken()
        .then((token) => {
          const fullUrl = `${this.filesUrl}&api_key=${token}`;
          return useSendXhr(fullUrl).then((response) => {
            this.filesLoading = true;
            this.$store.dispatch(
              "uploadModule/setCurrentTargetPackage",
              response
            );
            this.file = response;

            const newFiles = response.children.map((file) => {
              if (!file.storage) {
                file.storage = 0;
              }
              file.icon =
                file.icon || this.getFilePropertyVal(file.properties, "icon");
              file.subtype = this.getSubType(file);
              return file;
            });
            if (newFiles.length < this.limit) {
              this.lastPage = true;
            }
            this.files =
              this.offset > 0 ? [...this.files, ...newFiles] : newFiles;
            this.sortedFiles = this.returnSort(
              "content.name",
              this.files,
              this.sortDirection
            );
            this.ancestors = response.ancestors;

            const isCollection = this.$route.name === 'collection-files';
            this.$store.commit('SET_CURRENT_FOLDER', {
              name: isCollection ? (response?.content?.name || '') : '',
              ancestors: response.ancestors || []
            });

            const pkgId = pathOr("", ["query", "pkgId"], this.$route);
            if (pkgId) {
              this.scrollToFile(pkgId);
            }
            this.allowFetch = true;
            this.filesLoading = false;
          });
        })
        .catch((response) => {
          this.handleXhrError(response);
        });
    },
    /**
     * Sort table by column
     * @param {String} path
     * @param {String} dir
     */
    sortColumn: function (path, dir = "") {
      this.sortedFiles = this.returnSort(path, this.files, dir);
    },

    /**
     * Handler for clicking file
     * @param {Object} file
     */
    onClickLabel: function (file) {
      // Normal file navigation logic
      this.files = [];
      this.offset = 0;
      const id = pathOr("", ["content", "id"], file);
      const packageType = pathOr("", ["content", "packageType"], file);
      if (id === "") {
        return;
      }

      if (packageType === "Collection") {
        this.navigateToFile(id);
      } else {
        this.$router.push({
          name: "file-record",
          params: { fileId: id },
        });
      }
    },

    /**
     * Handler for selecting file/folder for package attachment
     * @param {Object} file
     */
    onSelectForAttachment: function (file) {
      // Dispatch package selection event for the PackageAttachmentWidget
      const packageData = {
        id: pathOr("", ["content", "id"], file),
        name: pathOr("", ["content", "name"], file),
        type: pathOr("", ["content", "packageType"], file),
        path: pathOr("", ["content", "path"], file)
      };
      
      const event = new CustomEvent('package-selected', {
        detail: packageData
      });
      window.dispatchEvent(event);
    },

    /**
     * Handler for clicking the file's menu button
     * @param {Object} file
     */
    onClickMenu: function (file) {
      // Check if the file is selected, and add it if it is not
      if (this.selectedFiles.indexOf(file) < 0) {
        this.selectedFiles = [file];
        this.lastSelectedFile = file;
      }
    },

    /**
     * Handler for breadcrumb overflow navigation
     * @param {String} id
     */
    handleNavigateBreadcrumb: function (id = "") {
      this.files = [];
      this.offset = 0;
      if (id) {
        this.navigateToFile(id);
      } else {
        this.navigateToDataset();
      }
    },

    /**
     * Navigate to file
     * @param {String} id
     */
    navigateToFile: function (id) {
      this.$router.push({ name: "collection-files", params: { fileId: id } });
    },

    /**
     * Navigate to dataset route
     */
    navigateToDataset: function () {
      this.$router.push({ name: "dataset-files" });
    },

    /**
     * Handler for renaming file
     * @param {Object} updatedFile
     */
    onFileRenamed: function (updatedFile) {
      const id = pathOr("", ["content", "id"], updatedFile);
      const file = find(pathEq(["content", "id"], id), this.files);

      if (file) {
        file.content.name = updatedFile.content.name;
      }
      this.sortColumn(this.sortBy, this.sortDirection);
    },

    /**
     * Handler for creating folder
     * @param {Object} folder
     */
    onFolderCreated: function (folder) {
      this.files.push(folder);
      this.sortColumn(this.sortBy, this.sortDirection);
    },

    /**
     * Open the package dialog
     */
    openPackageDialog: function () {
      this.packageDialogVisible = true;
    },

    /**
     * Show customActions dialog
     */
    showCustomActionsDialog: function () {
      this.$refs.customActionsDialog.visible = true;
    },

    /**
     * Handler for delete XHR
     */
    onDelete: function (response) {
      const successItems = propOr([], "success", response);
      this.removeItems(successItems);
    },

    /**
     * Remove items from files list
     * @param {Object} items
     */
    removeItems: function (items) {
      // Remove all successfully deleted files
      for (let i = 0; i < items.length; i++) {
        const fileIndex = findIndex(
          pathEq(["content", "id"], items[i]),
          this.files
        );
        this.files.splice(fileIndex, 1);
      }
      // Resort files
      this.sortColumn(this.sortBy, this.sortDirection);
      this.resetSelectedFiles();
    },

    /**
     * Show move dialog
     */
    showMove: function () {
      const moveDialog = this.$refs.moveDialog;
      moveDialog.currentFolder = this.file;
      this.moveDialogVisible = true;
    },
    onCloseMoveDialog: function () {
      this.moveDialogVisible = false;
    },

    /**
     * Send XHR to move items
     * @param {String} destination}
     * @param {Array} items
     */
    moveItems: function (destination, items) {
      this.moveUrl.then((url) => {
        const things = items.map((item) => item.content.id);
        this.sendXhr(url, {
          method: "POST",
          body: {
            destination,
            things,
          },
        })
          .then((response) => {
            this.onMoveItems(response);
          })
          .catch((response) => {
            this.handleXhrError(response);
          });
      });
    },

    /**
     * Handler for move items endpoint request
     * @param {Object} response
     */
    onMoveItems: function (response) {
      // Remove successful items from the files list
      const successItems = propOr([], "success", response);
      this.removeItems(successItems);

      // Handle conflict items
      const failures = propOr([], "failures", response);
      const failureIds = pluck("id", failures);
      const failureItems = failureIds.map((id) => {
        return find(pathEq(["content", "id"], id), this.files);
      });

      // Show failure dialog
      if (failureItems.length > 0) {
        this.moveConflict = {
          display: failureItems,
          files: failures,
          destination: propOr(null, "destination", response),
        };
        this.moveDialogVisible = true;
      }
    },

    /**
     * Rename conflicts, and then attempt to move them again
     * @param {String} destination
     * @param {Array} files
     */
    onRenameConflicts: function (destination, files) {
      // Rename each file with proposed new name
      const promises = files.map((obj) => {
        const id = propOr("", "id", obj);
        return useGetToken().then((token) => {
          const url = `${this.config.apiUrl}/packages/${id}?api_key=${token}`;
          return this.sendXhr(url, {
            method: "PUT",
            body: {
              name: propOr("", "generatedName", obj),
            },
          });
        });
      });
      Promise.all(promises).then(() => {
        // Move files again, now with new name
        this.moveItems(destination, this.moveConflict.display);

        // Reset
        this.moveDialogVisible = false;
        this.moveConflict = {};
      });
    },

    /**
     * On drag enter, hide drop info
     * @param {Object} evt
     */
    onDragEnter: function (evt) {
      if (
        evt.dataTransfer.types &&
        this.datasetLocked === false &&
        this.getPermission("editor")
      ) {
        for (let i = 0; i < evt.dataTransfer.types.length; i++) {
          if (evt.dataTransfer.types[i] === "Files") {
            evt.dataTransfer.dropEffect = "copy";
            evt.preventDefault();
            this.showDropInfo = true;
            return true;
          }
        }
      }
      this.showDropInfo = false;
    },

    /**
     * Show upload
     */
    showUpload: function () {
      EventBus.$emit("open-uploader", true);

      // Update upload location
      this.$store.dispatch("updateUploadDestination", this.file);
    },

    /**
     * Update files list
     * @param {Object} evt
     */
    onAddUploadedFile: function (evt) {
      const { packageDTO, uploadDestination } = evt;
      const uploadId = propOr("", "id", uploadDestination);
      const datasetId = pathOr("", ["params", "datasetId"], this.$route);
      const fId = pathOr("", ["params", "fileId"], this.$route);

      const exists = this.checkExists(packageDTO);
      const isParent = this.checkIsParent(packageDTO);

      if (
        (uploadId === datasetId || uploadId === fId) &&
        exists === false &&
        isParent
      ) {
        this.files.push(packageDTO);
        // Resort files
        this.sortColumn(this.sortBy, this.sortDirection);
        this.resetSelectedFiles();
      }
    },

    /**
     * Check if the package already exists in the dataset list
     * Used for adding collections
     * @param {Object} item
     * @returns {Boolean}
     */
    checkExists: function (item) {
      const id = pathOr("", ["content", "id"], item);
      const idx = findIndex(pathEq(["content", "id"], id), this.files);
      return idx >= 0;
    },

    /**
     * Check if the package's parent is the current collection
     * @param {Object} item
     * @returns {Boolean}
     */
    checkIsParent: function (item) {
      const datasetId = pathOr("", ["content", "id"], this.dataset);
      const parentId = pathOr(datasetId, ["parent", "content", "id"], item);
      const currentId = pathOr(0, ["content", "id"], this.file);

      return parentId === currentId;
    },

    /**
     * Update uploaded file state
     * @param {Object} evt
     */
    onUpdateUploadedFileState: function (evt) {
      const { packageDTO } = evt;
      const pkgId = pathOr("", ["content", "id"], packageDTO);

      const idx = this.files.findIndex((file) => {
        const id = propOr("", "id", file.content);
        if (id === pkgId) {
          return file;
        }
      });

      if (idx >= 0) {
        this.$set(this.files, idx, packageDTO);

        // Resort files
        this.sortColumn(this.sortBy, this.sortDirection);
        this.resetSelectedFiles();
      }
    },

    /**
     * Scroll to file in list
     * @param {String} pkgId
     */
    scrollToFile: function (pkgId) {
      this.$nextTick(() => {
        const trimmedId = pkgId.replace(/:/g, "");
        const element = document.querySelectorAll(`.file-row-${trimmedId}`);

        if (element.length) {
          head(element).scrollIntoView();

          element.forEach((row) => {
            row.classList.add("highlight");

            setTimeout(() => {
              row.classList.remove("highlight");
            }, 500);
          });
        }
      });
    },

    /**
     * Handle dismiss upload info event
     */
    onDismissUploadInfo: function () {
      // this.showUploadInfo = false
      // this.$store.dispatch('updateTotalUploadSize', 0)
      // this.$store.dispatch('updateUploadCount', 0)
    },

    /**
     * Handle upload menu click event
     * @param {String} command
     */
    onUploadMenuClick: function (command) {
      const options = {
        file: this.showUpload,
        "external-file": this.openUploadExternalFileDialog,
      };

      const handler = options[command];
      if (typeof handler === "function") {
        handler();
      }
    },

    /**
     * Open upload external file modal
     */
    openUploadExternalFileDialog: function () {
      EventBus.$emit("open-external-file-modal");
    },

    /**
     * Process file and update the state of the file
     * @param {Object} file
     */
    processFile: function (file) {
      const packageId = pathOr("", ["content", "id"], file);

      useGetToken().then((token) => {
        const url = `${this.config.apiUrl}/packages/${packageId}/process?api_key=${token}`;
        this.sendXhr(url, {
          method: "PUT",
          header: {
            Authorization: `bearer ${token}`,
          },
        })
          .then(() => {
            // Update the file's state to show that it is processing
            const updatedFile = assocPath(
              ["content", "state"],
              "PROCESSING",
              file
            );
            this.onUpdateUploadedFileState({ packageDTO: updatedFile });
          })
          .catch(this.handleXhrError.bind(this));
      });
    },

    /**
     * Get a presigned URL and copy the URL to the clipboard
     * @param {Object} file
     */
    getPresignedUrl: function (file) {
      const packageId = pathOr("", ["content", "id"], file);

      // Get the files for the package
      useGetToken().then((token) => {
        const url = `${this.config.apiUrl}/packages/${packageId}?include=sources&includeAncestors=false&api_key=${token}`;
        this.sendXhr(url, {
          method: "GET",
          header: {
            Authorization: `bearer ${token}`,
          },
        })
          .then((response) => {
            const fId = pathOr(
              "",
              ["objects", "source", 0, "content", "id"],
              response
            );
            const url = `${this.config.apiUrl}/packages/${packageId}/files/${fId}?short=true&api_key=${token}`;
            this.sendXhr(url, {
              method: "GET",
              header: {
                Authorization: `bearer ${token}`,
              },
            })
              .then((response) => {
                copyText(
                  pathOr("", ["url"], response),
                  undefined,
                  (error, event) => {
                    if (error) {
                      const msg = "Unable to copy to clipboard";
                      EventBus.$emit("toast", {
                        detail: {
                          type: "error",
                          msg,
                        },
                      });
                    } else {
                      const msg = "Temporary link to file copied to clipboard";
                      EventBus.$emit("toast", {
                        detail: {
                          type: "success",
                          msg,
                        },
                      });
                    }
                  }
                );
              })

              .catch((response) => {
                this.handleXhrError(response);
              });
          })
          .catch((response) => {
            this.handleXhrError(response);
          });
      });
    },
    handleRouteChange: function (to, from) {
      const DATASET_FILES_ROUTES = [
        "dataset-files",
        "collection-files",
        "file-record",
        "dataset-files-wrapper",
      ];
      const routeChanged = to.name !== from.name;
      const fileIdChanged = to.params.fileId !== from.params.fileId;
      const isNavigatingWithinDatasetFiles =
        DATASET_FILES_ROUTES.includes(to.name) &&
        (routeChanged || fileIdChanged);

      if (isNavigatingWithinDatasetFiles) {
        this.fetchFiles();
      }
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/theme";
@use "../../../styles/spacing";
@use "../../../styles/element/dialog";

.bf-stage-file {
  height: 100%;
}
.loading-spinner-container {
  display: flex;
  justify-content: center;
}

.file-meta-wrapper {
  display: flex;
  flex-direction: row;
}

.table-container {
  flex: 1 1 auto;
  overflow-y: scroll;
  display: block;
  margin-top: 0;
}

.table-column {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.selection-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: theme.$gray_1;
  gap: 8px;

  .selection-count {
    font-size: 12px;
    font-weight: 600;
    color: theme.$gray_6;
    white-space: nowrap;
    margin-right: 8px;
  }

  .selection-actions {
    display: flex;
    align-items: center;
    gap: 0;
  }
}

.selection-action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: theme.$gray_5;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s ease, color 0.15s ease;
  white-space: nowrap;

  &:hover {
    background: white;
    color: theme.$purple_3;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.selection-clear {
    margin-left: auto;
    color: theme.$gray_4;
    &:hover {
      color: theme.$gray_6;
    }
  }
}

.actions-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 15px;
  margin-bottom: 15px;
  margin-right: 8px;
}

.actions-item {
  margin-left: 0px;
  color: theme.$gray_6;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  &:hover {
    color: theme.$purple_1;
  }
}

.plus-icon {
  margin: -10px 0px -8px 6px;
}

.trash-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 4px;
  color: theme.$purple_3;
  transition: color 0.15s ease, background 0.15s ease;

  &:hover {
    color: theme.$gray_6;
    background: theme.$gray_1;
  }
}

.trash-icon-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  color: theme.$gray_4;
}

.trash-back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  color: theme.$purple_3;
  font-size: 13px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 4px;

  &:hover {
    background: theme.$gray_1;
  }
}

.trash-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
  margin-left: 16px;
}

.trash-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  color: theme.$gray_4;

  p {
    margin-top: 16px;
    font-size: 14px;
  }
}

.more-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  min-height: 40px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: theme.$purple_3;
  color: theme.$white;
  box-sizing: border-box;
  transition: background 0.15s ease;

  .more-dots {
    font-size: 18px;
    letter-spacing: 1px;
    line-height: 1;
  }

  &:hover {
    background: theme.$purple_2;
  }
}

.file-meta-wrapper {
  position: relative;
  display: flex;
  flex-direction: row;
  flex: 1;
  flex: 1;
  min-height: 0;
  gap: 8px;
}

.bf-dataset-files {
  background: #fff;
  position: relative;
  &.condensed {
    .bf-upload-info {
      display: none;
    }
  }

  .bf-files-empty-state {
    h2 {
      font-size: 16px;
      font-weight: 600;
      line-height: 16px;
      text-align: center;
    }

    p {
      color: #71747c;
      font-size: 14px;
      line-height: 16px;
      text-align: center;
    }
  }
}
</style>

<style lang="scss">
.file-actions-menu {
  .el-dropdown-menu__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 500;

    span {
      flex: 1;
    }
  }
}
</style>
