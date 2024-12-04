<template>
  <bf-stage
    class="bf-stage-file"
    slot="stage"
    element-loading-background="transparent"
    @drop="onDrop"
  >
    <template #actions>
      <stage-actions>
        <template #left>
          <breadcrumb-navigation
            :ancestors="ancestors"
            :file="file"
            :file-id="$route.params.fileId"
            @navigate-breadcrumb="handleNavigateBreadcrumb"
          />
        </template>
        <template #right>
          <template v-if="quickActionsVisible">
            <bf-button
              :disabled="!isFeatureFlagEnabled"
              @click="openRunAnalysisDialog"
              class="mr-8 flex"
            >
              <template #prefix>
                <IconAnalysis class="mr-8" :height="20" :width="20" />
              </template>
              Run Analysis
            </bf-button>

            <bf-button
              v-if="getPermission('editor')"
              class="flex mr-8"
              :disabled="datasetLocked"
              data-cy="createNewFolder"
              @click="openPackageDialog"
            >
              <template #prefix>
                <IconPlus class="mr-8" :height="20" :width="20" />
              </template>
              New Folder
            </bf-button>
          </template>
          <ps-button-dropdown
            @click="toggleActionDropdown"
            :menu-open="!quickActionsVisible"
          >
            <template #buttons>
              <bf-button
                :disabled="!isFeatureFlagEnabled"
                @click="openRunAnalysisDialog"
                class="dropdown-button"
              >
                <template #prefix>
                  <IconAnalysis class="mr-8" :height="20" :width="20" />
                </template>
                Run Analysis
              </bf-button>

              <bf-button
                v-if="getPermission('editor')"
                class="dropdown-button"
                :disabled="datasetLocked"
                data-cy="createNewFolder"
                @click="openPackageDialog"
              >
                <template #prefix>
                  <IconPlus class="mr-8" :height="20" :width="20" />
                </template>
                New Folder
              </bf-button>

              <bf-button @click="showUpload" class="dropdown-button">
                <template #prefix>
                  <IconUpload class="mr-8" :height="20" :width="20" />
                </template>

                Upload
              </bf-button>

              <bf-button @click="generateManifest" class="dropdown-button">
                <template #prefix>
                  <IconAnnotation class="mr-8" :height="20" :width="20" />
                </template>

                Generate Manifest
              </bf-button>

              <bf-button @click="NavToDeleted" class="dropdown-button">
                <template #prefix>
                  <IconTrash class="mr-8" :height="20" :width="20" />
                </template>

                Restore
              </bf-button>
            </template>
          </ps-button-dropdown>
        </template>
      </stage-actions>
    </template>

    <div class="file-meta-wrapper" >
      <div class="table-container" ref="tableContainer" @scroll="handleScroll">
        <files-table
          :data="files"
          :multiple-selected="multipleSelected"
          :table-loading="filesLoading"
          @move="showMove"
          @delete="showDeleteDialog"
          @rename-file="showRenameFileDialog"
          @custom-actions-click="showCustomActionsDialog"
          @process="processFile"
          @copy-url="getPresignedUrl"
          @selection-change="setSelectedFiles"
          @click-file-label="onClickLabel"
        />
        <div class="loading-spinner-container" v-if="filesLoading && !lastPage">
          <!-- <el-spinner class="loading-spinner" /> -->
        </div>
      </div>
      <file-metadata-info
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
      :dialog-visible="moveDialogVisible"
      :file="file"
      :move-conflict.sync="moveConflict"
      :selected-files="selectedFiles"
      @rename-conflicts="onRenameConflicts"
      @move="moveItems"
      @close="onCloseMoveDialog"
    />

    <RenameFileDialog
      :dialog-visible="renameDialogVisible"
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

    <custom-actions-dialog
      ref="customActionsDialog"
      :selected-files="selectedFiles"
    />

    <run-analysis-dialog
      :datasetId="datasetId"
      :dialog-visible="runAnalysisDialogVisible"
      @close="onCloseRunAnalysisDialog"
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
import CustomActionsDialog from "./custom-actions-dialog/CustomActionsDialog.vue";
import RunAnalysisDialog from "./RunAnalysisDialog/RunAnalysisDialog.vue";
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
import IconPlus from "../../icons/IconPlus.vue";
import IconTrash from "../../icons/IconTrash.vue";
import IconAnalysis from "../../icons/IconAnalysis.vue";
import StageActions from "../../shared/StageActions/StageActions.vue";
import RenameFileDialog from "./RenameFileDialog.vue";
import { copyText } from "vue3-clipboard";
import IconUpload from "../../icons/IconUpload.vue";

import {
  isEnabledForImmuneHealth,
  isEnabledForTestOrgs,
  isEnabledForAllDevOrgs,
} from "../../../utils/feature-flags.js";
import PsButtonDropdown from "@/components/shared/ps-button-dropdown/PsButtonDropdown.vue";
import IconAnnotation from "@/components/icons/IconAnnotation.vue";
import {useGetToken} from "@/composables/useGetToken";
import {useSendXhr} from "@/mixins/request/request_composable";

export default {
  name: "BfDatasetFiles",

  components: {
    IconAnnotation,
    IconAnalysis,
    IconUpload,
    RenameFileDialog,
    StageActions,
    IconTrash,
    IconPlus,
    BfRafter,
    BfButton,
    BfEmptyPageState,
    BfPackageDialog,
    BfDeleteDialog,
    CustomActionsDialog,
    BfMoveDialog,
    BfDropInfo,
    BfUploadInfo,
    BreadcrumbNavigation,
    BfUploadMenu,
    FilesTable,
    LockedBanner,
    DeletedFiles,
    FileMetadataInfo,
    RunAnalysisDialog,
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
      ancestors: null,
      files: [],
      sortedFiles: [],
      selectedFiles: [],
      moveConflict: {},
      showDropInfo: false,
      sortDirection: "asc",
      singleFile: {},
      deletedDialogOpen: false,
      limit: 100,
      offset: 0,
      allowFetch: true,
      filesLoading: false,
      lastPage: false,
      packageDialogVisible: false,
      deleteDialogVisible: false,
      renameDialogVisible: false,
      moveDialogVisible: false,
      selectedFileForAction: {},
      pusherChannelName: "",
      pusherChannel: {},
      runAnalysisDialogVisible: false,
    };
  },

  computed: {
    ...mapState("analysisModule", [
      "computeNodes",
      "preprocessors",
      "processors",
      "postprocessors",
      "selectedFilesForAnalysis",
    ]),
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
    ...mapGetters("uploadModule", ["getIsUploading", "getUploadComplete"]),

    ...mapGetters("datasetModule", [
      "getPusherChannel",
      "getManifestNotification",
    ]),

    showUploadInfo: function () {
      return this.getUploadComplete() || this.getIsUploading();
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

    filesUrl:  function () {
        const baseUrl = this.$route.name === "dataset-files" ? "datasets" : "packages";
        const id = this.$route.name === "dataset-files" ? this.$route.params.datasetId : this.$route.params.fileId;
        return `${this.config.apiUrl}/${baseUrl}/${id}?includeAncestors=true&limit=${this.limit}&offset=${this.offset}`;
    },

    /**
     * Get move URL
     * @returns {String}
     */
    moveUrl: async function () {
      return useGetToken()
        .then(token => {
          return `${this.config.apiUrl}/data/move?api_key=${token}`;
        })
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
    isFeatureFlagEnabled: function () {
      const orgId = pathOr("", ["organization", "id"], this.activeOrganization);
      return (
        isEnabledForTestOrgs(orgId) ||
        isEnabledForImmuneHealth(orgId) ||
        isEnabledForAllDevOrgs(this.config.apiUrl)
      );
    },
  },

  watch: {
    getManifestNotification: {
      handler(newValue, oldValue) {
        EventBus.$emit("toast", {
          detail: {
            type: "warning",
            msg: `The manifest has been generated: <a href=${newValue.url} download>Download Manifest</a>`,
            duration: 0,
            showClose: true,
          },
        });
      },
      deep: true,
    },

    offset: function() {
      this.fetchFiles()
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
    EventBus.$on("update-external-file", this.onFileRenamed);
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
    EventBus.$off("update-external-file", this.onFileRenamed);
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
    onCloseRunAnalysisDialog: function () {
      this.runAnalysisDialogVisible = false;
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

      useGetToken()
        .then(token => {
          const fullUrl = `${this.filesUrl}&api_key=${token}`
          return useSendXhr(fullUrl)
            .then((response) => {
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

              const pkgId = pathOr("", ["query", "pkgId"], this.$route);
              if (pkgId) {
                this.scrollToFile(pkgId);
              }
              this.allowFetch = true;
              this.filesLoading = false;
            })

        })
        .catch((response) => {
          this.handleXhrError(response);
      })
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
      this.moveDialogVisible = true;
      const moveDialog = this.$refs.moveDialog;
      moveDialog.file = this.file;
      moveDialog.visible = true;
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

      this.moveUrl
        .then(url =>{
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
        })

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

        // Show user notice of conflicts
        this.$refs.moveDialog.visible = true;
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

        useGetToken()
          .then((token) => {
            const url = `${this.config.apiUrl}/packages/${id}?api_key=${token}`;

            return this.sendXhr(url, {
              method: "PUT",
              body: {
                name: propOr("", "generatedName", obj),
              },
            });
          })

      });
      Promise.all(promises).then((response) => {
        // Move files again, now with new name
        this.moveItems(destination, response);

        // Reset
        this.moveConflict = {};

        // Hide user notice of conflicts
        this.$refs.moveDialog.visible = false;
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

      useGetToken()
        .then((token) => {
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

        })



    },

    /**
     * Get a presigned URL and copy the URL to the clipboard
     * @param {Object} file
     */
    getPresignedUrl: function (file) {
      const packageId = pathOr("", ["content", "id"], file);

      // Get the files for the package
      useGetToken()
        .then((token) => {
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
        })

    },
    openRunAnalysisDialog: function () {
      this.runAnalysisDialogVisible = true;
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
@import "../../../assets/_variables.scss";

.bf-stage-file {
  //height: calc(100vh - 180px);
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
  margin-top: 1px;
  border: 1px solid $gray_2;
  max-height: calc(100vh - 200px);
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
  color: $gray_6;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  &:hover {
    color: $purple_1;
  }
}

.plus-icon {
  margin: -10px 0px -8px 6px;
}

.dropdown-button {
  margin-top: 8px;
}

//.bf-stage-content {
//  display: flex;
//  flex-direction: row;
//  padding-top: 0px;
//  flex-direction: column;
//  overflow: auto;
//}

.file-meta-wrapper {
  position: relative;
  display: flex;
  flex-direction: row;
  flex: 1;
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
