<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    :show-close="false"
    @close="close"
  >
    <template #header>
      <bf-dialog-header
        :title="dataUseAgreement.name"
      />
    </template>

    <div class="bf-dialog-body">
      <div class="agreement-wrap">
        <!-- eslint-disable vue/no-v-html -->
        <!-- $sanitize will sanitize the HTML injected -->
        <div
          class="col-xs-12 col-md-8 description-container"
          v-html="parsedMarkdown"
        />
      </div>
    </div>

  </el-dialog>
</template>

<script>
import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../shared/dialog-body/DialogBody.vue'
import { marked } from 'marked'
marked.setOptions({
    sanitize: true
})

export default {
  name: 'DataUseAgreementUpdateDialog',

  components: {
    BfDialogHeader,
    DialogBody
  },

  props: {
    dialogVisible: {
      type: Boolean,
      default: false
    },
    dataUseAgreement: {
      type: Object,
      default: () => {
        return {}
      }
    }
  },

  data() {
    return {
      marked
    }
  },

  computed: {
    /**
     * Parses the markdown text
     */
    parsedMarkdown() {
      return marked(this.dataUseAgreementBody)
    },

    dataUseAgreementBody() {
      return this.replaceAllSlashEscapedSequences(this.dataUseAgreement.body)
    },
  },

  methods: {
    close: function() {
      this.$emit('close', false)
    },

    replaceAllSlashEscapedSequences(sourceString){
      var result = ''
      var remaining = sourceString
      var cutPoint = 0
      var index = remaining.indexOf("\\")
      while (index >= 0){
        var nextChar = remaining[index+1]
        var append = ''
        if (nextChar === 'n') {
          append = '\n'
        } else if (nextChar === 't') {
          append = '\t'
        }
        var slice = remaining.slice(cutPoint,index)
        result = result.concat(slice)
        result = result.concat(append)
        remaining = remaining.slice(index+2)
        index = remaining.indexOf("\\")
      }
      if (remaining.length > 0) {
        result = result.concat(remaining)
      }
      return result
    }
  }
}
</script>

<style lang="scss" scoped>
.button-wrap {
  display: flex;
}
// Markdown styles
.description-container {
  color: #000;
  font-size: 16px;
  line-height: 24px;
  padding-top: 32px;
  white-space: pre-wrap;
  :deep(
    h1,
    p,
    h2,
    h3,
    blockquote,
    h4,
    pre) {
      max-width: 616px;
    };
  :deep(
    h1,
    h2,
    h3,
    h4,
    h5) {
      margin: 0 0 8px;
    };
  :deep(
    h1) {
      font-size: 32px;
      font-weight: bold;
      line-height: 40px;
    };
  :deep(
      p) {
      margin-bottom: 16px;
    };
  :deep(
    img) {
      height: auto;
      max-width: 170%;
      margin-bottom: 20px;
      flex-basis: 50%;
      margin-top: 24px;
    };
  :deep(h2) {
      font-size: 24px;
      font-weight: bold;
      line-height: 32px;
    };
  :deep(h3) {
      font-size: 20px;
      font-weight: bold;
      line-height: 24px;
      letter-spacing: 0;
    };
  :deep(h4) {
      font-size: 16px;
      font-weight: bold;
      line-height: 24px;
      text-transform: uppercase;
      letter-spacing: 0;
    };
  :deep(ul) {
      margin: 0 0 16px;
      padding: 0 0 0 18px;
    };
  :deep(blockquote) {
      font-weight: normal;
      line-height: 24px;
      font-size: 16px;
      border-left: 8px solid gray;
      margin-left: 0;
      p {
        margin-left: 16px;
      }
    };
  :deep(pre) {
      background-color: #f1f1f3;
      line-height: 24px;
      padding: 16px;
      code {
        font-weight: normal;
        font-size: 14px;
      }
  }
}
</style>
