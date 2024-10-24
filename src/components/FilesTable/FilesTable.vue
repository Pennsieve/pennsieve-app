<template>
  <div class="files-table" :class="withinDeleteMenu && 'undelete-modal'">
    <div
      v-if="selection.length > 0 && !withinRunAnalysisDialog"
      class="selection-menu-wrap mb-16"
    >
      <el-checkbox
        class="slim-checkbox"
        id="check-all"
        v-model="checkAll"
        :indeterminate="isIndeterminate"
        @change="onCheckAllChange"
      />

      <span v-if="!withinRunAnalysisDialog" id="selection-count-label">{{
        selectionCountLabel
      }}</span>
      <ul class="selection-actions unstyled">
        <template v-if="withinDeleteMenu || withinRunAnalysisDialog">
          <li class="mr-24">
            <button
              v-if="!searchAllDataMenu && !withinRunAnalysisDialog"
              class="linked btn-selection-action"
              :disabled="datasetLocked"
              @click="$emit('restore')"
            >
              <IconMoveFile class="mr-8" :height="16" :width="16" />
              Restore the {{ selectionCountLabel }}
            </button>
          </li>
        </template>
        <template v-else>
          <li class="mr-24">
            <button
              class="linked btn-selection-action"
              :disabled="datasetLocked"
              @click="$emit('delete')"
            >
              <iconTrash class="mr-8" :height="16" :width="16" />
              Delete
            </button>
          </li>
          <li class="mr-8">
            <button
              class="linked btn-selection-action"
              :disabled="datasetLocked"
              @click="$emit('move')"
            >
              <IconMoveFile class="mr-8" :height="16" :width="16" />
              Move to&hellip;
            </button>
          </li>
          <li class="mr-8">
            <button
              class="linked btn-selection-action"
              :disabled="datasetLocked"
              @click="$emit('custom-actions-click')"
            >
              <IconDoneCheckCircle class="mr-8" :height="16" :width="16" />
              Actions
            </button>
          </li>
        </template>
        <li>
          <button
            v-if="!withinRunAnalysisDialog"
            class="linked btn-selection-action mr-8"
            @click="onDownloadClick"
          >
            <IconUpload class="mr-8" :height="16" :width="16" />
            Download
          </button>
        </li>
        <li v-if="!withinRunAnalysisDialog">
          <table-menu
            v-if="getPermission('editor') || searchAllDataMenu"
            :selection="selection"
            :multiple-selected="multipleSelected"
            :search-all-data-menu="searchAllDataMenu"
            @delete="$emit('delete')"
            @move="$emit('move')"
            @download-file="onDownloadClick"
            @process-file="processFile"
            @copy-url="getPresignedUrl"
            @open-office-file="onOpenOffice365"
          />
        </li>
      </ul>
    </div>

    <el-table
      ref="table"
      v-loading="
        withinDeleteMenu || withinRunAnalysisDialog ? false : tableLoading
      "
      :border="true"
      :data="data"
      :default-sort="{ prop: 'content.name', order: 'ascending' }"
      @selection-change="handleTableSelectionChange"
      @sort-change="onSortChange"
      @row-click="onRowClick"
    >
      <el-table-column
        type="selection"
        align="center"
        :selectable="withinDeleteMenu ? canSelectRow : null"
        fixed
        width="50"
      />

      <el-table-column
        prop="content.name"
        label="Name"
        fixed="left"
        min-width="200"
        :resizable="true"
        :sortable="!isSearchResults"
        :sort-orders="sortOrders"
      >
        <template #header> Name </template>
        <template #default="scope">
          <bf-file-label
            :file="scope.row"
            :open-file-button="true"
            :search-all-data-menu="true"
            @click-name="onFileLabelClick(scope.row)"
          />
        </template>
      </el-table-column>
      <template v-if="!withinDeleteMenu && !withinRunAnalysisDialog">
        <el-table-column
          prop="subtype"
          label="Kind"
          :sortable="!isSearchResults"
          :sort-orders="sortOrders"
        >
          <template #header> Kind </template>
        </el-table-column>

        <el-table-column
          prop="storage"
          label="Size"
          :sortable="!isSearchResults"
          :sort-orders="sortOrders"
        >
          <template #header> Size </template>
          <template #default="scope">
            {{ formatMetric(scope.row.storage) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="content.createdAt"
          label="Date Created"
          width="180"
          :sortable="!isSearchResults"
          :sort-orders="sortOrders"
        >
          <template #header> Date Created </template>
          <template #default="scope">
            {{ formatDate(scope.row.content.createdAt) }}
          </template>
        </el-table-column>
      </template>
    </el-table>
  </div>
</template>

<script>
import { pathOr, propOr } from "ramda";
import { mapGetters, mapState, mapActions } from "vuex";
import EventBus from "../../utils/event-bus";

import BfFileLabel from "../datasets/files/bf-file/BfFileLabel.vue";
import TableMenu from "../TableMenu/TableMenu.vue";

import BfStorageMetrics from "../../mixins/bf-storage-metrics";
import FileIcon from "../../mixins/file-icon/index";
import FormatDate from "../../mixins/format-date";
import TableFunctions from "../../mixins/table-functions";
import Sorter from "../../mixins/sorter";
import IconMoveFile from "../icons/IconMoveFile.vue";
import IconDoneCheckCircle from "../icons/IconDoneCheckCircle.vue";
import IconUpload from "../icons/IconUpload.vue";
import IconMenu from "../icons/IconMenu.vue";

export default {
  name: "FilesTable",

  components: {
    IconUpload,
    IconDoneCheckCircle,
    IconMoveFile,
    BfFileLabel,
    TableMenu,
    IconMenu,
  },

  mixins: [BfStorageMetrics, FileIcon, FormatDate, Sorter, TableFunctions],

  props: {
    data: {
      type: Array,
      default: () => [],
    },
    multipleSelected: {
      type: Boolean,
      default: false,
    },
    searchAllDataMenu: {
      type: Boolean,
      default: false,
    },
    isSearchResults: {
      type: Boolean,
      default: false,
    },
    nonSortableColumns: {
      type: Array,
      default: () => [],
    },
    withinDeleteMenu: {
      type: Boolean,
      default: false,
    },
    tableLoading: {
      type: Boolean,
      default: true,
    },
    withinRunAnalysisDialog: {
      type: Boolean,
      default: false,
    },
    clearSelectedValues: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      selection: [],
      sortOrders: ["ascending", "descending"],
      checkAll: false,
    };
  },
  watch: {
    // selectedFiles: {
    //   handler(newVal, oldVal) {
    //     console.log(
    //       "selectedFilesForAnalysis changed from",
    //       oldVal,
    //       "to",
    //       newVal
    //     );
    //     // Perform any additional logic when the property changes
    //   },
    //   deep: true, // Set to true if you want to watch for nested changes
    //   immediate: true, // Trigger the watcher immediately with the current value
    // },
    clearSelectedValues(newVal) {
      if (newVal) {
        this.handleCloseModal();
      }
    },
    data: {
      handler: function (newVal, oldVal) {
        if (this.withinRunAnalysisDialog) {
          const filesToSelect = [];
          const dataFilesToSelect = [];
          for (const parentId in this.selectedFilesForAnalysis) {
            this.selectedFilesForAnalysis[parentId].forEach((file) => {
              filesToSelect.push(file);
            });
          }
          filesToSelect.forEach((elem) => {
            this.data.forEach((dataElem) => {
              if (elem.content.id === dataElem.content.id) {
                dataFilesToSelect.push(dataElem);
              }
            });
          });
          dataFilesToSelect.forEach((elem) => {
            this.onRowClick(elem, true);
          });
        }
      },
      deep: true,
    },
  },

  computed: {
    ...mapGetters(["getPermission", "datasetLocked"]),

    ...mapState(["dataset", "filesProxyId"]),
    ...mapState("analysisModule", ["selectedFilesForAnalysis", "fileCount"]),
    selectedFiles() {
      return this.selectedFilesForAnalysis;
    },
    /**
     * Compute if the checkbox is indeterminate
     * @returns {Boolean}
     */
    isIndeterminate: function () {
      return (
        this.selection.length > 0 && this.selection.length < this.data.length
      );
    },

    /**
     * Compute selection count label
     * @returns {String}
     */
    selectionCountLabel: function () {
      const selectionCount = this.selection.length;
      const fileWord = selectionCount === 1 ? "file" : "files";
      return `${selectionCount} ${fileWord} selected`;
    },
  },
  methods: {
    ...mapActions("filesModule", ["openOffice365File"]),
    ...mapActions("analysisModule", ["clearSelectedFiles", "updateFileCount"]),

    handleCloseModal: function () {
      this.$refs.table.clearSelection();
    },

    onOpenOffice365: function (file) {
      this.openOffice365File(file);
    },
    /**
     * Select the row
     * @param {Object} row
     * @param {Boolean} selected
     */
    selectRow: function (row, selected = null) {
      this.$refs.table.toggleRowSelection(row, selected);
    },

    canSelectRow: (row) => {
      return row.state === "DELETED";
    },

    /**
     * Checkbox display logic
     * @param {Object} store
     */
    showRowCheckbox: function (store) {
      if (this.datasetLocked) {
        return false;
      }

      const tableSelection = pathOr([], ["states", "selection"], store);
      return tableSelection.length > 0;
    },

    /**
     * Handle table selection change
     * @param {Array} selection
     */
    handleTableSelectionChange: function (selection) {
      this.selection = selection;
      const parentId = this.data[0].content.parentId || "root";
      this.$emit("selection-change", selection, parentId);
      this.checkAll = this.data.length === selection.length;
    },

    /**
     * Callback from sort change
     * Set new sort order and property
     * @param {Object} evt
     */
    onSortChange: function (evt) {
      const order = propOr("", "order", evt);
      const property = propOr("", "prop", evt);
      this.sortBy = property;

      const sortOrder = order === "descending" ? "desc" : "asc";
      this.sortDirection = sortOrder;
    },

    /**
     * Emit event for file label click
     * @param {Object} file
     */
    onFileLabelClick: function (file) {
      this.$emit("click-file-label", file);
    },

    /**
     * Deselect all files
     */
    deselectAll: function () {
      this.$refs.table.clearSelection();
    },

    /**
     * Check all, or clear the selection
     * @param {Boolean} shouldCheckAll
     */
    onCheckAllChange: function (shouldCheckAll) {
      if (shouldCheckAll) {
        this.$refs.table.toggleAllSelection();
      } else {
        this.$refs.table.clearSelection();
      }
    },
    clearAllSelected: function () {
      this.$refs.table.clearSelection();
    },

    onRowClick: function (row, selected) {
      setTimeout(
        function () {
          this.$refs.table.toggleRowSelection(row, selected);
        }.bind(this),
        100
      );
    },

    /**
     * handle the table header download click
     */
    onDownloadClick: function () {
      EventBus.$emit("trigger-download", this.selection);
    },

    /**
     * delete file from file menu
     * @param {Object} file
     */
    deleteFile: function (file) {
      this.setFileMenuSelection(file);
      this.$emit("delete");
    },

    /**
     * Movie file from file menu
     * @param {Object} file
     */
    moveFile: function (file) {
      this.setFileMenuSelection(file);
      this.$emit("move");
    },

    /**
     * Downloads file from the file menu
     */
    downloadFile: function (file) {
      this.setFileMenuSelection(file);
      this.$emit("download", file);
    },

    /**
     * Process file
     * @param {Object} file
     */
    processFile: function (file) {
      this.$emit("process", file);
    },

    /**
     * Get presigned URL and copy to clipboard
     * @param {Object} file
     */
    getPresignedUrl: function (file) {
      this.$emit("copy-url", file);
    },

    /**
     * Select file for file menu action
     * @param {Object} file
     */
    setFileMenuSelection: function (file) {
      this.deselectAll();
      this.selectRow(file, true);
    },

    /**
     * Compute row class name
     * @returns {String}
     */
    getRowClassName: function (tableRow) {
      const { row } = tableRow;

      const id = pathOr("", ["content", "nodeId"], row);
      const trimmedId = id.replace(/:/g, "");

      return `${
        tableRow.row.state !== "DELETED" &&
        this.withinDeleteMenu &&
        "disable-select"
      } ${
        tableRow.row.state === "READY" && "allow-file-navigation"
      } file-row-${trimmedId}`;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../../assets/_variables.scss";

.slim-checkbox {
  height: 8px;
  margin-left: 2px;
  margin-right: 32px;
}

.files-table {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  //border: 1px solid $gray_2;
  border-radius: 4px;
  &.undelete-modal {
    min-height: calc(100vh - 400px);
    border-bottom: none;
  }
}

.column-header {
}

.el-table {
  width: 100%;
}

.el-table--border {
  border: none;
}

.el-table--border td {
  //border: none;
  border-right: 1px solid transparent;
}

.el-table--border tr {
  border: none;
  //border-right: 1px solid transparent;
}

.btn-selection-action {
  align-items: center;
  display: flex;
  font-size: 14px;
}
.link-file {
  color: $text-color;
  &:hover,
  &:focus {
    color: $app-primary-color;
  }
}
#check-all {
  margin-right: 37px;
}
#selection-count-label {
  font-size: 12px;
  font-weight: 700;
  transform: translateY(1px);
}
.selection-menu-wrap {
  background: #e9edf6;
  border: 1px solid $gray_2;
  box-sizing: border-box;
  border-radius: 3px 3px 0 0;
  display: flex;
  padding: 6px 15px;
  position: absolute;
  justify-content: space-between;
  width: 100%;
  z-index: 10;
  align-items: center;
}
.selection-actions {
  display: flex;
  flex: 1;
  justify-content: flex-end;
  align-items: center;
}
.el-table {
  border-radius: 4px;
  tr {
    transition: background-color 0.3s ease-in-out;
  }
  td,
  th {
    padding: 8px 0;
  }

  .disable-select {
    pointer-events: none;
  }

  .allow-file-navigation button {
    pointer-events: auto;
  }

  .cell {
    padding-left: 16px;
    padding-right: 16px;
  }

  .caret-wrapper {
    display: none;
  }
  .highlight {
    background-color: $status_yellow;
  }
}
.file-actions-wrap {
  display: flex;
  justify-content: flex-end;
}
</style>
