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

          <template #error="{ error }"">
            <!-- eslint-disable-next-line --><!-- $sanitize in use -->
            <div class="el-form-item__error" v-html="$sanitize(error, ['a'])" />
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
import SanitizeName from '../../../mixins/sanitize-name/index'
import { mapGetters } from 'vuex'
import { pathOr, pathEq, equals } from 'ramda'
import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError} from "@/mixins/request/request_composable";

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
    SanitizeName
  ],

  props: {
    dialogVisible: {
      type: Boolean,
      default: false
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
          { required: true, validator: this.validateName, trigger: 'blur' },
        ]
      },
      serverError: false, 
      serverErrorMessage: ''
    }
  },

  computed: {
    ...mapGetters([
      'config'
    ]),

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
     * Computes form URL based on type of action user is taking (rename vs creating)
     * @returns {String}
     */
    formUrl: async function() {
      return useGetToken()
        .then(token => {
          const id = pathOr('', ['content', 'id'], this.file)
          return `${this.config.apiUrl}/packages/${id}?api_key=${token}`
        }).catch(err => console.log(err))
    },
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
      this.serverError = false
      this.serverErrorMessage = ''

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

      this.formUrl()
        .then(url => {
          return this.sendXhr(url, {
            method: 'PUT',
            body: this.packageForm
          })
            .then(response => {
              this.$emit('file-renamed', response)
              this.closeDialog()
            })
            .catch(response => {
              if (response.status === 400) {
                response.json()
                  .then(data => {
                    this.serverErrorMessage = data.message
                    this.serverError = true

                    // Validate form again to show error
                    this.$refs.packageForm.validate()
                  })
              }
            })
        })

    },

    /**
     * Validate name
     * @param {Object} rule
     * @param {String} value
     * @param {Function} callback
     */
    validateName: function(rule, value, callback) {
      if (value === '') {
        callback(new Error('Please provide a name'))
      } else if (this.serverError) {
        callback(new Error('Within the current folder, '+this.serverErrorMessage))
      } else {
        callback()
      }
    }

  }
}
</script>

<style scoped lang="scss">
</style>
