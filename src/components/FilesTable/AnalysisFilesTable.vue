<template>
  <div class="analysis-files-table">
    <el-table
      ref="table"
      :border="true"
      :data="data"
      :default-sort="{ prop: 'content.name', order: 'ascending' }"
      @selection-change="handleTableSelectionChange"
      @select="onSelect"
    >
      <el-table-column
        type="selection"
        align="center"
        fixed
        width="50"
      />

      <el-table-column
        prop="content.name"
        label="Name"
        fixed="left"
        min-width="200"
        :resizable="true"
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
        prop="storage"
        label="Size"
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
import { mapState, mapActions } from "vuex";

import BfFileLabel from "../datasets/files/bf-file/BfFileLabel.vue";
import BfStorageMetrics from "../../mixins/bf-storage-metrics";
import FormatDate from "../../mixins/format-date";

export default {
  name: "AnalysisFilesTable",

  components: {
    BfFileLabel,
  },

  mixins: [BfStorageMetrics, FormatDate],

  props: {
    data: {
      type: Array,
      default: () => [],
    },
    clearSelectedValues: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      selection: [],
      lastClickedRow: null,
      shiftKeyPressed: false,
      selectionChangeTimeout: null,
    };
  },

  computed: {
    ...mapState("analysisModule", ["selectedFilesForAnalysis", "fileCount"]),
  },

  mounted() {
    // Track shift key state globally
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
    data: {
      handler: function () {
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
          this.selectRowProgrammatically(elem, true);
        });
      },
      deep: true,
    },
  },

  methods: {
    ...mapActions("analysisModule", ["clearSelectedFiles", "updateFileCount"]),

    handleCloseModal: function () {
      this.$refs.table.clearSelection();
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
        }, 50);
      }
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
     * Programmatically select a row (used by data watcher)
     */
    selectRowProgrammatically: function (row, selected) {
      setTimeout(() => {
        this.$refs.table?.toggleRowSelection(row, selected);
      }, 100);
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

      // Shift+click for range selection
      if (this.shiftKeyPressed && this.lastClickedRow !== null && wasSelected) {
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

      // Always update last clicked row
      this.lastClickedRow = row;
    },

    /**
     * Clear all selected files
     */
    clearAllSelected: function () {
      this.$refs.table.clearSelection();
    },
  },
};
</script>

<style lang="scss" scoped>
@use "../../styles/theme";
@use "../../styles/element/table";

.analysis-files-table {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  border-radius: 4px;
}
</style>
