<template>
  <div class="files-table" :class="withinDeleteMenu && 'undelete-modal'">
    <div
      v-if="selection.length > 0"
      class="selection-menu-wrap mb-16"
    >
      <div class="selection-info">
        <el-checkbox
          class="slim-checkbox"
          id="check-all"
          v-model="checkAll"
          :indeterminate="isIndeterminate"
          @change="onCheckAllChange"
        />
        <span id="selection-count-label">{{
          selectionCountLabel
        }}</span>
      </div>
      <ul class="selection-actions unstyled">
        <template v-if="withinDeleteMenu">
          <li class="mr-24">
            <button
              v-if="!searchAllDataMenu"
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
        </template>
        <li>
          <button
            class="linked btn-selection-action mr-8"
            @click="onDownloadClick"
          >
            <IconUpload class="mr-8" :height="16" :width="16" />
            Download
          </button>
        </li>
        <li>
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
      v-loading="withinDeleteMenu ? false : tableLoading"
      :border="true"
      :data="data"
      :default-sort="{ prop: 'content.name', order: 'ascending' }"
      @selection-change="handleTableSelectionChange"
      @sort-change="onSortChange"
      @row-click="onRowClick"
      @select="onSelect"
    >
      <!-- Package Attachment Select Column (replaces selection when active) -->
      <el-table-column
        v-if="isPackageAttachmentActive"
        label=""
        width="50"
        align="center"
        fixed
      >
        <template #header>
          <span class="select-column-header">Select</span>
        </template>
        <template #default="scope">
          <div
            class="select-package-btn"
            @click.stop="onSelectForAttachment(scope.row)"
            title="Select for attachment"
          >
            <IconPlus :height="14" :width="14" />
          </div>
        </template>
      </el-table-column>

      <!-- Normal selection column (when package attachment is not active) -->
      <el-table-column
        v-else
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
            :search-all-data-menu="true"
            @click-name="onFileLabelClick(scope.row)"
          />
        </template>
      </el-table-column>
      <el-table-column
        v-if="!withinDeleteMenu"
        prop="subtype"
        label="Kind"
        :sortable="!isSearchResults"
        :sort-orders="sortOrders"
      >
        <template #header> Kind </template>
      </el-table-column>

      <el-table-column
        v-if="!withinDeleteMenu"
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
        v-if="!withinDeleteMenu"
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
import IconPlus from "../icons/IconPlus.vue";
import IconTrash from "@/components/icons/IconTrash.vue";

export default {
  name: "FilesTable",

  components: {
    IconTrash,
    IconUpload,
    IconDoneCheckCircle,
    IconMoveFile,
    IconPlus,
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
    clearSelectedValues: {
      type: Boolean,
      default: false,
    },
    isPackageAttachmentActive: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      selection: [],
      sortOrders: ["ascending", "descending"],
      checkAll: false,
      lastClickedRow: null,
      shiftKeyPressed: false,
      selectionChangeTimeout: null,
    };
  },

  mounted() {
    // Track shift key state globally for range selection
    this.handleKeyDown = (e) => {
      if (e.key === 'Shift') {
        this.shiftKeyPressed = true;
      }
    };
    this.handleKeyUp = (e) => {
      if (e.key === 'Shift') {
        this.shiftKeyPressed = false;
      }
    };
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  },
  watch: {
    clearSelectedValues(newVal) {
      if (newVal) {
        this.handleCloseModal();
      }
    },
  },

  computed: {
    ...mapGetters(["getPermission", "datasetLocked"]),

    ...mapState(["dataset", "filesProxyId"]),

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
      this.$refs.table?.toggleRowSelection(row, selected);
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
     * Debounced to prevent multiple rapid updates during shift+click range selection
     * @param {Array} selection
     */
    handleTableSelectionChange: function (selection) {
      if (this.data[0] && this.data[0].content) {
        this.selection = selection;

        // Debounce the emit to batch rapid selection changes
        if (this.selectionChangeTimeout) {
          clearTimeout(this.selectionChangeTimeout);
        }
        this.selectionChangeTimeout = setTimeout(() => {
          const parentId = this.data[0].content.parentId || "root";
          this.$emit("selection-change", this.selection, parentId);
          this.checkAll = this.data.length === this.selection.length;
        }, 50);
      }
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
     * Handle package selection for attachment
     * @param {Object} file
     */
    onSelectForAttachment: function (file) {
      this.$emit("select-for-attachment", file);
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

    /**
     * Get data sorted by name (matching el-table's default-sort)
     */
    getTableData: function () {
      return [...this.data].sort((a, b) => {
        const nameA = (a.content?.name || '').toLowerCase();
        const nameB = (b.content?.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    },

    /**
     * Handle checkbox selection with Shift+click range selection support
     */
    onSelect: function (selection, row) {
      // Check if this row was just selected (it's now in the selection)
      const wasSelected = selection.some(
        (item) => item.content.id === row.content.id
      );

      // If deselecting, clear lastClickedRow to prevent accidental range selection
      if (!wasSelected) {
        this.lastClickedRow = null;
        return;
      }

      // Shift+click for range selection
      if (this.shiftKeyPressed && this.lastClickedRow !== null) {
        const sortedData = this.getTableData();

        const lastIndex = sortedData.findIndex(
          (item) => item.content.id === this.lastClickedRow.content.id
        );
        const currentIndex = sortedData.findIndex(
          (item) => item.content.id === row.content.id
        );

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);

          // Collect all rows to select first
          const rowsToSelect = [];
          for (let i = start; i <= end; i++) {
            const sortedRow = sortedData[i];
            // Find the matching row in the original this.data array
            const originalRow = this.data.find(
              (item) => item.content.id === sortedRow.content.id
            );
            if (originalRow) {
              rowsToSelect.push(originalRow);
            }
          }

          // Select all rows in nextTick to batch updates
          this.$nextTick(() => {
            rowsToSelect.forEach((r) => {
              this.$refs.table?.toggleRowSelection(r, true);
            });
          });
        }
      }

      // Update last clicked row for selected items
      this.lastClickedRow = row;
    },

    /**
     * Handle row click for shift+click range selection anywhere in the row
     */
    onRowClick: function (row, column) {
      // Ignore clicks on the checkbox column - onSelect handles those
      if (column?.type === 'selection') {
        return;
      }

      // Check if row is currently selected
      const isCurrentlySelected = this.selection.some(
        (item) => item.content.id === row.content.id
      );

      // Shift+click for range selection
      if (this.shiftKeyPressed && this.lastClickedRow !== null) {
        const sortedData = this.getTableData();

        const lastIndex = sortedData.findIndex(
          (item) => item.content.id === this.lastClickedRow.content.id
        );
        const currentIndex = sortedData.findIndex(
          (item) => item.content.id === row.content.id
        );

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);

          // Collect all rows to select first
          const rowsToSelect = [];
          for (let i = start; i <= end; i++) {
            const sortedRow = sortedData[i];
            const originalRow = this.data.find(
              (item) => item.content.id === sortedRow.content.id
            );
            if (originalRow) {
              rowsToSelect.push(originalRow);
            }
          }

          // Select all rows in nextTick to batch updates
          this.$nextTick(() => {
            rowsToSelect.forEach((r) => {
              this.$refs.table?.toggleRowSelection(r, true);
            });
          });
        }
        // Update last clicked row
        this.lastClickedRow = row;
      } else {
        // Normal click - toggle single row
        this.$refs.table?.toggleRowSelection(row, !isCurrentlySelected);
        // Update lastClickedRow only when selecting
        if (!isCurrentlySelected) {
          this.lastClickedRow = row;
        } else {
          this.lastClickedRow = null;
        }
      }
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
@use "../../styles/theme";
@use "../../styles/element/table";

.slim-checkbox {
  height: 8px;
  margin-left: 2px;
  margin-right: 32px;
}

.files-table {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  border-radius: 4px;
  &.undelete-modal {
    min-height: calc(100vh - 400px);
    border-bottom: none;
  }
}

.column-header {
}

//.el-table {
//  width: 100%;
//}
//
//.el-table--border {
//  border: none;
//}
//
//.el-table--border td {
//  //border: none;
//  border-right: 1px solid transparent;
//}
//
//.el-table--border tr {
//  border: none;
//  //border-right: 1px solid transparent;
//}

.btn-selection-action {
  align-items: center;
  display: flex;
  font-size: 14px;
}
.link-file {
  color: theme.$text-color;
  &:hover,
  &:focus {
    color: theme.$app-primary-color;
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
.btn-clear-selection {
  font-size: 12px;
  margin-left: 12px;
  color: theme.$app-primary-color;
  &:hover {
    text-decoration: underline;
  }
}
.selection-menu-wrap {
  background: #e9edf6;
  //border: 1px solid theme.$gray_2;
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
.selection-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.selection-actions {
  display: flex;
  flex: 1;
  justify-content: flex-end;
  align-items: center;
}
//.el-table {
//  border-radius: 4px;
//  tr {
//    transition: background-color 0.3s ease-in-out;
//  }
//  td,
//  th {
//    padding: 8px 0;
//  }
//
//  .disable-select {
//    pointer-events: none;
//  }
//
//  .allow-file-navigation button {
//    pointer-events: auto;
//  }
//
//  .cell {
//    padding-left: 16px;
//    padding-right: 16px;
//  }
//
//  .caret-wrapper {
//    display: none;
//  }
//  .highlight {
//    background-color: theme.$status_yellow;
//  }
//}
.file-actions-wrap {
  display: flex;
  justify-content: flex-end;
}

.select-header {
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_6;
}

.select-column-header {
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_6;
  text-align: center;
}

.select-package-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1.5px solid theme.$teal_1;
  border-radius: 50%;
  background: theme.$white;
  color: theme.$teal_2;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: theme.$teal_tint;
    border-color: theme.$teal_2;
  }

  &:active {
    background: theme.$teal_tint;
    transform: scale(0.95);
  }
}
</style>
