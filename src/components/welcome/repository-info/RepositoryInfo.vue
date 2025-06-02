<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    :class="calculateModalWidth"
    :show-close="false"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header
        title="Repository Information"
      />
    </template>

    <div class="image-wrapper">
      <img
        :src=logoPath
        class="logo"
        alt="Logo for Pennsieve"
      />
      <div>
        <a :href="selectedRepoForRequest.url" target="_blank">
          <bf-button class="primary">
            Visit Repository
          </bf-button>
        </a>
      </div>
    </div>

    <dialog-body>
      <markdown-editor
        ref="markdownEditor"
        :value="readmeText"
        :is-editing="false"
        :is-saving="false"
        :is-loading="isLoadingRepositoryDescription"/>
    </dialog-body>

  </el-dialog>

</template>

<script>
import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../shared/dialog-body/DialogBody.vue'
import MarkdownEditor from '../../shared/MarkdownEditor/MarkdownEditor.vue'
import BfButton from '../../shared/bf-button/BfButton.vue'


import {
  mapState,
  mapActions
} from 'vuex'
export default {
  name: "RepositoryInfo",
  components: {
    BfDialogHeader,
    DialogBody,
    MarkdownEditor,
    BfButton
  },
  props: {
    dialogVisible: {
      type: Boolean,
      default: false
    }
  },
  data: function () {
    return {
      readmeText: "",
    }
  },
  computed: {
    ...mapState([
      'primaryNavCondensed',
      'secondaryNavOpen',
    ]),
    ...mapState('repositoryModule',[
      "isLoadingRepositoryDescription",
      'selectedRepoForRequest'
    ]),

    logoPath: function() {
      if (this.selectedRepoForRequest) {
        return this.selectedRepoForRequest.logoFile
      }
      return ""
    },
    /**
     * Calculate modal width based on navigation width
     * @returns {String}
     */
    calculateModalWidth: function() {
      return this.primaryNavCondensed || this.secondaryNavOpen
        ? 'condensed-nav-modal-width'
        : 'default-nav-modal-width'
    },
  },
  watch: {
    selectedRepoForRequest: {
      handler: function() {
        this.getReadmeText()
      }
    }
  },
  methods: {
    ...mapActions('repositoryModule',[
        'updateModalVisible'
      ]
    ),

    getReadmeText: async function() {
      let result = ""
      if (this.selectedRepoForRequest) {
        let response = await fetch(this.selectedRepoForRequest.overviewDocument)
        if (response.ok) {
          result = await response.text()
        }
      }
      this.readmeText = result
    },

    /**
     * Closes the Search Across All Datasets dialog
     */
    closeDialog: function() {
      this.updateModalVisible(false)
    },
  }
}
</script>

<style scoped lang="scss">

.image-wrapper {
  display: flex;
  justify-content: space-between;
  .logo {
    max-width:240px;
    padding-left: 16px;
    margin: 24px 0;
  }
}


.el-dialog {
  margin-top: 16px !important;
}

.default-nav-modal-width {
  width: calc(100vw - 32px - 230px);
  margin-left: 246px;
  overflow-y: auto;
}

.condensed-nav-modal-width {
  width: calc(100vw - 32px - 56px);
  margin-left: 72px;
  overflow-y: auto;
}
</style>

<style scoped>

</style>