<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    data-cy="bfPackageDialog"
    class="bf-package-dialog"
    :show-close="false"
    @open="onOpen"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header
        slot="title"
        data-cy="bfPackageDialogTitle"
        :title="dialogText"
      />
    </template>

    <dialog-body>
      <el-form
        ref="packageForm"
        :model="packageForm"
        :rules="rules"
        label-position="top"
        @submit.native.prevent="submitForm('packageForm')"
      >
        <el-form-item
          label="Name"
          prop="name"
        >
          <el-input
            v-model="packageForm.name"
            data-cy="collectionName"
            autofocus
            :maxlength="255"
          />

          <template #error>
            <!-- eslint-disable-next-line --><!-- $sanitize in use -->
            <div class="el-form-item__error" v-html="$sanitize(error.error, ['a'])" />
          </template>
        </el-form-item>
      </el-form>
    </dialog-body>

    <template #footer>
      <bf-button
        class="secondary"
        data-cy="closeCollectionDialog"
        @click="closeDialog"
      >
        Cancel
      </bf-button>
      <bf-button
        data-cy="createCollection"
        @click="submitForm('packageForm')"
      >
        {{ dialogText }}
      </bf-button>

    </template>

  </el-dialog>
</template>

<script>
import BfButton from '../../shared/bf-button/BfButton.vue'
import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../shared/dialog-body/DialogBody.vue'
import Request from '../../../mixins/request/index'
import AutoFocus from '../../../mixins/auto-focus'
import CheckUniqueNames from '../../../mixins/check-unique-names/index'
import SanitizeName from '../../../mixins/sanitize-name/index'
import { isValidPackageName } from '@/utils/namingConventions'
import { mapGetters } from 'vuex'
import { pathOr, pathEq, equals } from 'ramda'

export default {
  name: 'RenameFileDialog',

  components: {
    BfDialogHeader,
    DialogBody,
    BfButton
  },

  mixins: [
    AutoFocus,
    Request,
    CheckUniqueNames,
    SanitizeName
  ],

  props: {
    dialogVisible: {
      type: Boolean,
      default: false
    },
    parentFolder: {
      type: Object,
      default: () => {
        return {}
      }
    },
    files: {
      type: Array,
      default: function() {
        return []
      }
    },
    file: {},
  },

  data: function() {
    return {

      packageForm: {
        name: ''
      },
      rules: {
        name: [
          { required: true, validator: this.validateName, trigger: 'false' },
        ]
      },
      isDuplicate: false
    }
  },

  computed: {
    ...mapGetters([
      'config'
    ]),
    /**
     * Computes form URL based on type of action user is taking (rename vs creating)
     * @returns {String}
     */
    formUrl: function() {
      if (this.config.apiUrl && this.userToken) {
        const id = pathOr('', ['content', 'id'], this.file)
        return `${this.config.apiUrl}/packages/${id}?api_key=${this.userToken}`
      }
    },
    /**
     * Compute dialog text
     * @returns {String}
     */
    dialogText: function() {
      const isFolder = pathEq(['content', 'packageType'], 'Collection', this.file)
      const packageHeading = isFolder ? 'Folder' : 'File'
      return `Rename ${packageHeading}`
    },
  },

  methods: {
    /**
     * On dialog open. Ensure the form field is
     */
    onOpen: function() {
      this.autoFocus()
      this.$nextTick(() => {
        this.packageForm.name = pathOr('', ['content', 'name'], this.file)
      })
    },

    /**
     * Closes the dialog
     */
    closeDialog: function() {
      this.$refs.packageForm.resetFields()
      this.$emit('close')
    },

    /**
     * Submit Form
     * @param {String} formName
     */
    submitForm: function(formName) {
      this.isDuplicate = false

      this.$refs[formName]
        .validate((valid) => {
          if (!valid) {
            return
          }
          this.renamePackage()
        })
    },

    /**
     * Sends XHR request to create dataset
     */
    renamePackage: function() {
      const fileName = pathOr('', ['content', 'name'], this.file)
      if (fileName === this.packageForm.name) {
        this.closeDialog()
        return
      }

      if (this.formUrl) {
        this.sendXhr(this.formUrl, {
          method: 'PUT',
          body: this.packageForm
        })
          .then(response => {
            this.$emit('file-renamed', response)
            this.closeDialog()
          })
          .catch(response => {
            if (response.status === 500) {
              response.text()
                .then(data => {
                  this.isDuplicate = data.indexOf('package name is already taken') >= 0

                  // Validate form again to show error
                  this.$refs.packageForm.validate()
                })
            }
          })
      }
    },

    /**
     * Validate name
     * @param {Object} rule
     * @param {String} value
     * @param {Function} callback
     */
    validateName: function(rule, value, callback) {
      const packageType = pathOr('Collection', ['content', 'packageType'], this.file)
      // Get list based on the file's packageType
      const list = this.filterFiles(packageType === 'Collection')
      const isUnique = this.checkUniqueName(list, ['content', 'name'], value, value)
      const isValidName = isValidPackageName(value)
      if (value === '') {
        callback(new Error('Please provide name'))
      } else if (!isValidName) {
        callback(new Error('This is not a valid filename. Find out more <a href="https://docs.pennsieve.io/" target="_blank">here</a>.'))
      } else if (!isUnique || this.isDuplicate) {
        callback(new Error('Name must be unique'))
      } else {
        callback()
      }
    },

    /**
     * Get all collections or everything but collections
     * @returns {Array}
     */
    filterFiles: function(collectionsOnly) {
      return this.files.filter(item => {
        const packageType = pathOr('', ['content', 'packageType'], item)
        return equals(packageType, 'Collection') === collectionsOnly
      })
    }
  }
}
</script>

<style scoped lang="scss">
</style>
