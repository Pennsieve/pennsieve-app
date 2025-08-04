<template>
  <div class="text-viewer">
    <div class="wrapper">
      <pre>
        <code
          v-if="isText"
          ref="codeblock"
          class="codeblock"
          :class="subtype"
          v-html="escapeHTMLData(fileData)"
        />
        <code
          v-if="!isText"
          ref="codeblock"
          class="codeblock"
          :class="subtype"
        >{{ fileData }}</code>
      </pre>
    </div>
  </div>
</template>

<script>
import hljs from 'highlight.js'

import StaticViewer from '../../mixins/static-viewer'
import GetFileProperty from '../../mixins/get-file-property'
import Request from '../../mixins/request'

import 'highlight.js/styles/github.css';

// import 'highlightjs/styles/color-brewer.css'
const escapeHTML = str => (str+'').replace(/[&<>"'`=\/]/g, s => ({'&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;','/': '&#x2F;','`': '&#x60;','=': '&#x3D;'})[s]);



export default {
  name: 'TextViewer',

  mixins: [
    StaticViewer,
    GetFileProperty,
    Request
  ],

  props: {
    pkg: {
      type: Object,
      default: () => {}
    },
    idx: {
      type: Number,
      default: 0
    }
  },

  data() {
    return {
      fileData: ''
    }
  },

  computed: {
    /**
     * Compute subtype from Package DTO
     */
    subtype: function() {
      return this.getFilePropertyVal(this.pkg.properties, 'subtype').toLowerCase()
    },

    isText: function() {
      return this.subtype === 'text'
    },

  },

  watch: {
    fileUrl: {
      handler: function(url) {
        if (url) {
          this.getData(url)
        }
      },
      immediate: true
    },
  },

  methods: {
    escapeHTMLData: function(str) {
      return (str+'').replace(/[&<>"'`=\/]/g, s => ({'&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;','/': '&#x2F;','`': '&#x60;','=': '&#x3D;'})[s]);

    },
    /**
    * Fetch file data
    * @param {String} url
    */
    getData: function(url) {
      // NOTE: We could augment the Request mixin to handle text responses
      // instead of using fetch here
      fetch(url)
        .then(response => response.text())
        .then(data => {
          this.fileData = data
          const codeblock = this.$refs.codeblock

          hljs.configure()

          this.$nextTick(() => {
            hljs.highlightBlock(codeblock)
          })
        })
        .catch(this.handleXhrError.bind(this))
    }
  }
}
</script>

<style lang="scss" scoped>
@use '../../styles/theme' as *;


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
