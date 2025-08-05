<template>
<!--  <div-->
<!--    v-click-outside="clearSelection">-->
  <div>

    <div
      class="content-section"
      id="source-files-table"
      v-loading="isLoading"
      element-loading-background="#FBFBFD"
    >
      <div
        v-if="totalRowCount > this.limit"
        class="pagination-header"
      >
        <pagination-page-menu
          class="ml-8"
          :page-size="limit"
          @update-page-size="onUpdateLimit"
        />
        <el-pagination
          :page-size="limit"
          :pager-count="5"
          :current-page="offset / limit + 1"
          layout="prev, pager, next"
          :total="totalRowCount"
          @current-change="onPaginationPageChange"
        />
      </div>

      <div class="table-wrap">
        <div v-if="selection.length > 0"
             :class="[singleSelect ? 'single-select' : '', 'selection-menu-wrap mb-16']">

          <el-checkbox
            v-if="!singleSelect"
            class="slim-checkbox"
            id="check-all"
            v-model="checkAll"
            @change="handleCheckAllChange"
            :indeterminate="isIndeterminate"

          />
          <div v-else>
            <button class="btn-action"
                    @click="clearSelection">
              Clear Selection
            </button>
          </div>

          <div class="right-actions">
            <slot name="actions" />
          </div>

        </div>

        <div ref="tableWrapper">
          <el-table
            ref="Table"
            :data="data"
            :border="true"
            @row-click="onRowClick"
            @selection-change="handleTableSelectionChange"
            :highlight-current-row="singleSelect"
          >
            <slot name="columns"/>
          </el-table>
        </div>

      </div>

    </div>
  </div>
</template>

<script>

import PaginationPageMenu from "../PaginationPageMenu/PaginationPageMenu.vue";

export default {
  name: 'PennsieveTable',

  components: {
    PaginationPageMenu,
  },

  props: {
    isLoading: {
      type: Boolean,
      default: true,
    },
    totalRowCount: {
      type: Number,
      default: 1
    },
    data: {
      type: Array,
      default: []
    },
    limit: {
      type: Number,
      default: 50,
    },
    offset: {
      type: Number,
      default: 0
    },
    singleSelect: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      checkAll: false,
      selection: []
    }
  },
  emits: ['changePage', 'updateLimit','toggleAll', 'selectionChange'],
  computed:{
    /**
     * Compute if the checkbox is indeterminate
     * @returns {Boolean}
     */
    isIndeterminate: function() {
      return (
        this.selection.length > 0 && this.selection.length < this.data.length
      )
    },
  },

  methods: {



    /**
     * Handle table selection change
     * @param {Array} selection
     */
    handleTableSelectionChange(selection) {

      this.selection = selection
      this.checkAll = this.data.length === this.selection.length;
      this.$emit('selectionChange', selection)
    },
    onRowClick: function(row, selected) {
      this.$refs.Table.clearSelection()
      this.$refs.Table.toggleRowSelection(row, true)
    },

    clearSelection: function() {
      this.$refs.Table.clearSelection()
      this.$refs.Table.setCurrentRow(null)
      this.selection = []
      this.checkAll = false
    },

    handleCheckAllChange: function(val){
      if (val) {
        // This situation should not exist (component not visible)
        return
      } else {
        this.$refs.Table.clearSelection()
        this.selection = []
        this.checkAll = false
      }
    },
    /**
     * handle changing the results per page
     * @param {Number} limit
     */
    onUpdateLimit: function(limit) {
      this.$emit('updateLimit',limit)
    },

    onPaginationPageChange: function(page) {
      this.$emit('changePage', page)
    }
  }
}

</script>

<style scoped lang="scss">
@use '../../../styles/theme';


.btn-action {
  color: theme.$purple_2;
}
.selection-menu-wrap {
  background: #e9edf6;
  //border: 1px solid theme.$gray_2;
  box-sizing: border-box;
  border-radius: 3px 3px 0 0;
  display: flex;
  padding: 3px 17px;
  position: absolute;
  justify-content: space-between;
  width: 100%;
  z-index: 10;
  align-items: center;
  min-height: 40px;

  &.single-select {
    padding: 3px 17px 3px 8px;
  }
}

.right-actions {
  display: flex;
  flex-direction: row;
}
.table-wrap {
  position: relative;
}

.content-section {
  width: 100%-1; // For some reason setting to 100% prevents table shrinking
}

.pagination-header {
  align-items: center;
  display: flex;
  justify-content: space-between
}
</style>
