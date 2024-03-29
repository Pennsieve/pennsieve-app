<template>
    <el-table
      ref="table"
      :border="true"
      :data="data"
      :fit="true"
      table-layout="auto"
      @sort-change="onSortChange"
      @row-click="onRowClick"
    >
      <el-table-column
        v-for="heading in headings"
        :key="heading.name"
        :prop="heading.name"
        :minWidth="widthForColumn(heading)"
        :label="heading.displayName"
        :sortable="isSortable ? 'custom' : false"
      >
        <template #header>
          <el-tooltip
            v-if="isSortable"
            :content="heading.displayName"
            placement="top"
          >
            <button :class="{ 'sort-active': tableSearchParams.orderBy === heading.name }">
              {{ heading.displayName }}
              <IconSort
                class="sort-icon"
                :class="[ tableSearchParams.ascending && tableSearchParams.orderBy === heading.name ? 'svg-flip' : '' ]"
              />
            </button>
          </el-tooltip>

          <template v-else>
            {{ heading.displayName }}
          </template>
        </template>

<!--        Something here-->

<!--        <template slot-scope="scope">-->
<!--          <div-->
<!--            :class="{ 'model-title': heading.modelTitle }"-->
<!--            v-html="$sanitize(scope.row[heading.name], ['a'])"-->
<!--          />-->
<!--        </template>-->
      </el-table-column>

      <el-table-column
        v-if="showMenuColumn"
        label=""
        fixed="right"
        align="right"
        width="54"
        :sortable="isSortable ? 'custom' : false"
        :resizable="false"
      >
        <template #default="scope">
          <div
            class="record-actions-wrap"
          >
            <table-menu
              :file="scope.row"
              :search-all-data-menu="searchAllDataMenu"
              :search-all-data-records="searchAllDataMenu"
            />
          </div>
        </template>
      </el-table-column>
    </el-table>
</template>

<script>
import {
  propOr
} from 'ramda'

import TableMenu from '../../../TableMenu/TableMenu.vue'
import BfStorageMetrics from '../../../../mixins/bf-storage-metrics'
import FileIcon from '../../../../mixins/file-icon/index'
import FormatDate from '../../../../mixins/format-date'
import TableFunctions from '../../../../mixins/table-functions'
import Sorter from '../../../../mixins/sorter'
import IconSort from "../../../icons/IconSort.vue";

export default {
  name: 'RecordsTable',

  components: {
    IconSort,
    TableMenu
  },

  mixins: [
    BfStorageMetrics,
    FileIcon,
    FormatDate,
    Sorter,
    TableFunctions
  ],

  props: {
    data: {
      type: Array,
      default: () => []
    },
    searchAllDataMenu: {
      type: Boolean,
      default: false
    },
    searchAllDataRecords: {
      type: Boolean,
      default: false
    },
    headings: {
      type: Array,
      default: () => []
    },
    showMenuColumn: {
      type: Boolean,
      default: true
    },
    isSortable: {
      type: Boolean,
      default: false
    },
    tableSearchParams: {
      type: Object,
      default: () => {
        return {}
      }
    }
  },

  data () {
    return {
      activeRow: {},
      selection: [],
      sortOrders: ['ascending', 'descending'],
      checkAll: false
    }
  },



  methods: {
    getTextWidth: function(text, font) {
      // if given, use cached canvas for better performance
      // else, create new canvas
      var canvas = this.getTextWidth.canvas || (this.getTextWidth.canvas = document.createElement("canvas"));
      var context = canvas.getContext("2d");
      context.font = font;
      var metrics = context.measureText(text);
      return metrics.width;
    },

    widthForColumn: function(heading) {
      if (this.data.length > 0) {
        let longestValue = heading.name + ">>"
        for (let i = 0; i < this.data.length; i++) {
          let curValue = this.data[i][heading.name]
          if (curValue) {
            longestValue =  ((curValue.length > longestValue.length) ? curValue : longestValue)
          }
        }

        let tw = this.getTextWidth(longestValue, '14pt sans-serif')

        return (tw < 300) ? tw: 300
      }
      return "200"
    },
    /**
     * Action when clicking a row
     */
    onRowClick: function(row, column) {
     const columnProperty = propOr('', 'property', column)
     if (columnProperty !== undefined) {
       this.$emit('navigate-to-record', row)
     }
    },

    /**
     * Callback from sort change
     * Set new sort order and property
     * @param {Object} evt
     */
    onSortChange: function(evt) {

      this.$refs.table.doLayout()

      const property = propOr('', 'prop', evt)

      const ascending = !(this.tableSearchParams.orderBy === property && this.tableSearchParams.ascending)

      const orderDirection = ascending ? 'asc' : 'desc'

      this.$emit('sort', {
        orderBy: property,
        ascending,
        orderDirection
      })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../../../../assets/_variables.scss';

.records-table {
  position: relative;
}
.el-table {
  width: 100%;
}
.el-table--border td {
  border-right: 1px solid transparent;
}
.hover-row,
 .el-table__row:hover {
  background: #f5f6f9;
}
.btn-selection-action {
  align-items: center;
  display: flex;
  font-size: 14px;
}

 .el-table {
  border-radius: 4px;
  tr {
    transition: background-color 0.3s ease-in-out;
  }
  td {
    padding: 8px 0;
    &:hover {
      cursor: pointer;
    }
  }
  th {
    padding: 10px 0;
    font-size: 12px;
    font-weight: 600;
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
.record-actions-wrap {
  display: flex;
  justify-content: flex-end;
}
</style>
