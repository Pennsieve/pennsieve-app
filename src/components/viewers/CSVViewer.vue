<template>
  <div class="text-viewer">
    <div class="wrapper">
      <table v-if="parsed" style="width: 100%">
        <thead>
          <tr>
            <th
              v-for="(header, key) in content.meta.fields"
              v-bind:key="'header-' + key"
            >
              {{ header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowKey) in content.data"
            v-bind:key="'row-' + rowKey"
          >
            <td
              v-for="(column, columnKey) in content.meta.fields"
              v-bind:key="'row-' + rowKey + '-column-' + columnKey"
            >
              <div class="table-cell">
                {{ content.data[rowKey][column] || "" }}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!--      <pre>-->
      <!--        <code-->
      <!--          v-if="isText"-->
      <!--          ref="codeblock"-->
      <!--          class="codeblock"-->
      <!--          :class="subtype"-->
      <!--          v-html="escapeHTMLData(fileData)"-->
      <!--        />-->
      <!--        <code-->
      <!--          v-if="!isText"-->
      <!--          ref="codeblock"-->
      <!--          class="codeblock"-->
      <!--          :class="subtype"-->
      <!--        >{{ fileData }}</code>-->
      <!--      </pre>-->
    </div>
  </div>
</template>

<script>
import StaticViewer from "../../mixins/static-viewer";
import GetFileProperty from "../../mixins/get-file-property";
import Request from "../../mixins/request";
import Papa from "papaparse";

export default {
  name: "CSVViewer",

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
      content: {},
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
      Papa.parse(this.fileData, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
          this.content = results;
          this.parsed = true;
        }.bind(this),
      });
    },
    /**
     * Fetch file data
     * @param {String} url
     */
    getData: function (url) {
      // NOTE: We could augment the Request mixin to handle text responses
      // instead of using fetch here
      fetch(url)
        .then((response) => response.text())
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
@import "../../assets/_variables.scss";

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
