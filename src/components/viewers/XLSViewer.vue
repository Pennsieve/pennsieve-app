<template>
  <div class="text-viewer">
    <div class="wrapper">
      <table v-if="parsed" style="width: 100%">
        <thead>
          <tr>
            <th v-for="column in uniqueColumns" :key="column">
              {{ column === "_EMPTY" ? "" : column }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowKey) in content" :key="'row-' + rowKey">
            <td
              v-for="column in uniqueColumns"
              :key="'row-' + rowKey + '-column-' + column"
            >
              <div class="table-cell">
                {{ row[column] || "" }}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import StaticViewer from "../../mixins/static-viewer";
import GetFileProperty from "../../mixins/get-file-property";
import Request from "../../mixins/request";
import Papa from "papaparse";
import { read, utils } from "xlsx";
import { forEach } from "ramda";

export default {
  name: "XLSViewer",

  mixins: [StaticViewer, GetFileProperty, Request],

  props: {
    pkg: {
      type: Object,
      default: () => {},
    },
    idx: {
      type: Number,
      default: 0,
    },
  },

  data() {
    return {
      fileData: "",
      content: [],
      parsed: false,
    };
  },

  computed: {
    /**
     * Compute subtype from Package DTO
     */
    subtype: function () {
      return this.getFilePropertyVal(
        this.pkg.properties,
        "subtype"
      ).toLowerCase();
    },
    uniqueColumns() {
      const columns = new Set();
      this.content.forEach((row) => {
        Object.keys(row).forEach((key) => columns.add(key));
      });
      return Array.from(columns);
    },
  },

  watch: {
    fileUrl: {
      handler: function (url) {
        if (url) {
          this.getData(url);
        }
      },
      immediate: true,
    },
  },

  methods: {
    parseFile: function () {
      let workbook = read(this.fileData, { type: "base64" });
      let sheetNames = workbook.SheetNames;

      const sheetIndex = 1;

      this.content = utils.sheet_to_json(
        workbook.Sheets[sheetNames[sheetIndex - 1]]
      );
      this.parsed = true;

      // Papa.parse( this.fileData, {
      //   header: true,
      //   skipEmptyLines: true,
      //   complete: function( results ){
      //     this.content = results;
      //     this.parsed = true;
      //   }.bind(this)
      // } );
    },
    /**
     * Fetch file data
     * @param {String} url
     */
    getData: function (url) {
      // NOTE: We could augment the Request mixin to handle text responses
      // instead of using fetch here
      fetch(url)
        .then((response) => response.arrayBuffer())
        .then((data) => {
          this.fileData = data;
          this.parseFile();
        })
        .catch(this.handleXhrError.bind(this));
    },
  },
};
</script>

<style lang="scss" scoped>
@use "../../styles/theme' as *;

th {
  text-align: left;
}

td {
  border-bottom: 1px solid $purple_tint;
  height: 24px;
}

.table-cell {
  align-self: center;
}

.text-viewer {
  overflow: hidden;
  width: 100%;
  height: 100%;
  background: white;
  border: 1px solid $gray_3;
}

.wrapper {
  //position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  overflow: auto;
}

.codeblock {
  overflow: visible;
}

pre {
  white-space: pre-wrap;
}
</style>
