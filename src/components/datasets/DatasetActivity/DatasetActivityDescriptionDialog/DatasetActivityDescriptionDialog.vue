<template>
  <div>
    Updated {{ type }}
    <a
      href="#"
      @click.prevent="dialogVisible = true"
    >
       (Show details)
    </a>
    <el-dialog
      v-model="dialogVisible"
      :show-close="false"
      @close="dialogVisible = false"
    >
      <template #header>
        <bf-dialog-header
          slot="title"
          :title="titleStr"

        />
      </template>


      <dialog-body>
        <div v-html="parsedMarkdown" />
      </dialog-body>

      <template #footer>
        <bf-button
          class="secondary"
          @click="dialogVisible = false"
        >
          Close
        </bf-button>
      </template>

    </el-dialog>
  </div>
</template>

<script>
import { marked } from 'marked'

import BfButton from '@/components/shared/bf-button/BfButton.vue'
import BfDialogHeader from '@/components/shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '@/components/shared/dialog-body/DialogBody.vue'

marked.setOptions({
  sanitize: true
})

export default {
  name: 'DatasetActivityDescriptionDialog',

  components: {
    BfDialogHeader,
    DialogBody,
    BfButton
  },

  props: {
    description: {
      type: String,
      default: ''
    },
    type: {
      type: String,
      default: 'Readme'
    },
    action: {
      type: String,
      default: 'added'
    }
  },

  data() {
    return {
      dialogVisible: false
    }
  },

  computed: {
    titleStr: function() {
      return this.type + " description " + this.action
    },
    /**
     * Parse markdown description to be rendered
     * @returns {String}
     */
    parsedMarkdown: function() {
      return marked(this.description)
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../../../assets/_variables.scss';
@import '../../../shared/MarkdownEditor/_markdown.scss';

</style>
