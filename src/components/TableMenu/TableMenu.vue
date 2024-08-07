<template>
  <el-dropdown trigger="click" placement="bottom-end" @command="onFileMenu">
    <button class="btn-file-menu el-dropdown-link">
      <IconMenu :height="20" :width="20" />
    </button>
    <template #dropdown>
      <el-dropdown-menu slot="dropdown" class="bf-menu" :offset="9">
        <el-dropdown-item
          v-if="getFileState === 'Unprocessed'"
          :disabled="datasetLocked"
          command="processFile"
        >
          Process File
        </el-dropdown-item>
        <el-dropdown-item
          v-if="
            isMSOfficeFile &&
            getFileState !== 'Unprocessed' &&
            getFileState !== 'Processing' &&
            !isExternalFile
          "
          command="openMSOfficeFile"
        >
          Open with Office 365
        </el-dropdown-item>
        <el-dropdown-item
          v-if="
            !isMSOfficeFile &&
            packageType !== 'Collection' &&
            packageType !== 'Unknown' &&
            getFileState !== 'Unprocessed' &&
            getFileState !== 'Processing' &&
            getFileState !== 'Failed' &&
            !isExternalFile
          "
          :disabled="getFileState === 'Uploading'"
          command="openViewer"
        >
          Open Viewer
        </el-dropdown-item>
        <el-dropdown-item
          v-if="
            packageType !== 'Collection' && !multipleSelected && !isExternalFile
          "
          :disabled="isFileProcessing"
          command="download"
        >
          Download
        </el-dropdown-item>
        <el-dropdown-item
          v-if="
            packageType !== 'Collection' && !multipleSelected && !isExternalFile
          "
          :disabled="isFileProcessing"
          command="copyUrl"
        >
          Copy URL to Clipboard
        </el-dropdown-item>
        <el-dropdown-item
          v-if="getPermission('editor')"
          :disabled="datasetLocked"
          command="delete"
        >
          Delete
        </el-dropdown-item>
        <el-dropdown-item
          v-if="isExternalFile && getPermission('editor')"
          :disabled="datasetLocked"
          command="editExternalFile"
        >
          Update
        </el-dropdown-item>
        <el-dropdown-item
          v-if="!multipleSelected && getPermission('editor') && !isExternalFile"
          :disabled="datasetLocked"
          command="rename"
        >
          Rename
        </el-dropdown-item>
        <el-dropdown-item
          v-if="getPermission('editor')"
          :disabled="datasetLocked"
          command="move"
        >
          Move to&hellip;
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script>
import { mapGetters, mapState, mapActions } from "vuex";
import { path, pathOr, propOr } from "ramda";

import EventBus from "../../utils/event-bus";
import GetFileProperty from "../../mixins/get-file-property";
import IconMenu from "../icons/IconMenu.vue";

const conceptId = "00000000-0000-0000-0000-000000000000";

export default {
  name: "TableMenu",
  components: {
    IconMenu,
  },

  mixins: [GetFileProperty],

  props: {
    selection: {
      type: Array,
      default: () => [],
    },
    multipleSelected: {
      type: Boolean,
      default: false,
    },
  },

  computed: {
    ...mapGetters(["getPermission", "datasetLocked"]),

    ...mapState(["dataset"]),

    /**
     * Checks if file type is an MS Office file
     * @returns {Boolean}
     */
    isMSOfficeFile: function () {
      return (
        this.kind === "MS Powerpoint" ||
        this.kind === "MS Excel" ||
        this.kind === "MS Word"
      );
    },

    // /**
    //  * Generates the file type value for a file in the table
    //  * @returns {String}
    //  */
    kind: function () {
      if (this.packageType === "Collection") {
        return "Folder";
      }

      if (this.isExternalFile) {
        return "External File";
      }

      const subtype = this.getFilePropertyVal(
        this.selection[0].properties,
        "subtype"
      );
      return subtype
        ? subtype
        : propOr("Unknown", "subtype", this.selection[0] || []);
    },

    /**
     * Gets the state of a file in the table
     * @returns {String}
     */
    getFileState: function () {
      const states = {
        UPLOADED: "Unprocessed",
        PROCESSING: "Processing",
        RUNNING: "Processing",
        UNAVAILABLE: "Uploading",
        PENDING: "Processing",
        ERROR: "Failed",
      };
      const fileState = path(["content", "state"], this.selection[0] || []);
      return states[fileState] ? states[fileState] : "";
    },

    /**
     * Computes if the file is processing
     * @returns {Boolean}
     */
    isFileProcessing: function () {
      return (
        this.getFileState == "Uploading" || this.getFileState == "Processing"
      );
    },

    /**
     * Compute if package is an external file
     * @returns {Boolean}
     */
    isExternalFile: function () {
      return this.packageType === "ExternalFile";
    },

    /**
     * Compute package type
     * @returns {String}
     */
    packageType: function () {
      return pathOr("", ["content", "packageType"], this.selection[0] || []);
    },
  },

  methods: {
    ...mapActions(["updateSearchModalVisible"]),
    /**
     * Emit Office 365 modal event
     */
    openMSOfficeFile: function () {
      this.$emit("open-office-file", this.selection[0] || []);
    },
    /**
     * Handler for file menu click
     * @param {String} name
     */
    onFileMenu: function (name) {
      if (typeof this[name] === "function") {
        this[name]();
      }
    },

    /**
     * Emit download-file event
     */
    download: function () {
      EventBus.$emit("trigger-download", [this.selection]);
    },

    /**
     * Emit rename event
     */
    rename: function () {
      EventBus.$emit("rename-file", this.selection);
    },

    /**
     * Emit delete event
     */
    delete: function () {
      this.$emit("delete", this.selection);
    },

    /**
     * Emit move event
     */
    move: function () {
      this.$emit("move", this.selection);
    },

    /**
     * Open viewer
     */
    openViewer: function () {
      const fileId = pathOr("", ["content", "nodeId"], this.selection[0] || []);
      if (fileId) {
        this.$router.push({
          name: "viewer",
          params: { fileId },
        });
      }
    },

    /**
     * Process file
     */
    processFile: function () {
      this.$emit("process-file", this.selection[0] || []);
    },

    /**
     * Copy url
     */
    copyUrl: function () {
      this.$emit("copy-url", this.selection[0] || []);
    },

    /**
     * Navigate to file
     * @param {String} id
     */
    // navigateToFile: function(id) {
    //   this.$router.push({ name: 'collection-files', params: { fileId: id } })
    //   this.updateSearchModalVisible(false)
    // },

    // /**
    //  * Navigate to dataset route
    //  */
    // navigateToDatasetFiles: function() {
    //   const datasetId = pathOr('', ['content', 'datasetNodeId'], this.file)
    //   this.$router.push({
    //     name: 'dataset-files',
    //     params: { datasetId: datasetId }
    //   })
    //   this.updateSearchModalVisible(false)
    // },

    // /**
    //  * Navigate to records details route
    //  */
    // navigateToRecord: function() {
    //   const recordId = propOr('', 'recordId', this.file)
    //   const datasetId = propOr('', 'datasetId', this.file)
    //   const modelId = propOr('', 'modelId', this.file)
    //
    //   this.$router.push({
    //     name: 'metadata-record',
    //     params: {
    //       instanceId: recordId,
    //       conceptId: modelId,
    //       datasetId: datasetId
    //     }
    //   })
    //   this.updateSearchModalVisible(false)
    // },

    /**
     * Navigate to records list route
     */
    // showRecordList: function() {
    //   const datasetId = propOr('', 'datasetId', this.file)
    //   const modelId = propOr('', 'modelId', this.file)
    //
    //   this.$router.push({
    //     name: 'model-details',
    //     params: {
    //       datasetId: datasetId,
    //       conceptId: modelId
    //     }
    //   })
    //   this.updateSearchModalVisible(false)
    // },

    // /**
    //  * Open File Details
    //  */
    // openDetails: function() {
    //   const datasetId = pathOr('', ['content', 'datasetNodeId'], this.file)
    //
    //   const fileId = pathOr('', ['content', 'nodeId'], this.file)
    //
    //   if (fileId === '') {
    //     return
    //   }
    //
    //   if (this.packageType === 'Collection') {
    //     this.navigateToFile(fileId)
    //   } else {
    //     this.$router.push({
    //       name: 'file-record',
    //       params: {
    //         instanceId: fileId,
    //         datasetId: datasetId,
    //         conceptId: conceptId
    //       }
    //     })
    //   }
    //
    //   this.updateSearchModalVisible(false)
    // },

    // /**
    //  * Show in Folder
    //  * @param {Object} file
    //  */
    // showInFolder: function() {
    //
    //   const fileId = pathOr('', ['content', 'id'], this.file)
    //   if (this.packageType === 'Collection') {
    //     this.navigateToFile(fileId)
    //   } else {
    //     this.navigateToDatasetFiles()
    //   }
    //
    // }
  },
};
</script>

<style lang="scss" scoped></style>
