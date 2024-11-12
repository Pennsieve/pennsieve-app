<template>
  <el-dialog
    class="dark-header"
    v-model="dialogVisible"
    :show-close="false"
    @open="handleOpen"
    @close="closeDialog"
  >

    <template #header="{ close, titleId, titleClass }">
      <bf-dialog-header
        title="Create an API Key"
        class="my-header"
      />
    </template>

    <el-form
      ref="apiKeyForm"
      :model="ruleForm"
      :rules="rules"
      label-position="top"
    >
      <el-form-item
        label="API Key"
        prop="apiKey"
      >
        <el-input
          v-model="ruleForm.apiKey"
          autofocus
        />
      </el-form-item>
      <div class="sub-title">
        Key names must be unique
      </div>
    </el-form>

    <template #footer>
      <bf-button
        class="secondary"
        @click="closeDialog"
      >
        Cancel
      </bf-button>
      <bf-button @click="onFormSubmit">
        Confirm
      </bf-button>
    </template>

  </el-dialog>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import { path, pathOr, prop, compose, toLower, map, not, includes, indexOf, defaultTo } from 'ramda'

import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../shared/dialog-body/DialogBody.vue'
import BfButton from '../../shared/bf-button/BfButton.vue'

import Request from '../../../mixins/request'
import AutoFocus from '../../../mixins/auto-focus'
import EventBus from '../../../utils/event-bus'



export default {
  name: 'CreateApiKey',

  components: {
    BfButton,
    BfDialogHeader,
    DialogBody
  },

  mixins: [
    AutoFocus,
    Request
  ],

  props: {
    apiKeys: {
      type: Array,
      default: [],
    },
  },

  data() {
    const validateApiKey = (rule, value, callback) => {
      if (!value) {
        callback(new Error('Please provide an API key'))
      }

      const isUnique = this.checkUniqueName(this.apiKeys, ['name'], value, '')
      if (isUnique === false) {
        callback(new Error('Please provide unique API key'))
      } else {
        callback()
      }
    }

    return {
      dialogVisible: false,
      labelPosition: 'right',
      ruleForm: {
        apiKey: ''
      },
      rules: {
        apiKey: [
          { validator: validateApiKey, trigger: 'false' },
        ]
      }
    }
  },

  computed: {
    ...mapGetters([
      'profile',
      'activeOrganization',
      'config'
    ]),
    apiKeyUrl: function() {
      const url = pathOr('', ['config', 'apiUrl'])(this)
      const userToken = prop('userToken', this)

      if (!url || !userToken) {
        return ''
      }
      return `${url}/token?api_key=${userToken}`
    }
  },

  methods: {
    ...mapActions([
      'updateProfile'
    ]),
    /**
     * Handles submit event
     */
    onFormSubmit: function(e) {
      e.preventDefault()
      this.$refs.apiKeyForm
        .validate((valid) => {
          if (!valid) {
            return
          }
          this.sendRequest()
        })
    },
    /**
     * Makes XHR call to create api key
     */
    sendRequest: function() {
      this.sendXhr(this.apiKeyUrl, {
        method: 'POST',
        body: {
          name: this.ruleForm.apiKey
        }
      })
      .then(this.handleXhrSucces.bind(this))
      .catch(this.handleXhrError.bind(this))
    },
    /**
     * Handles successful two factor xhr response
     * @param {Object} response
     */
    handleXhrSucces: function(response) {
      this.closeDialog()

      EventBus.$emit('toast', {
        detail: {
          type: 'success',
          msg: 'API key successfully added'
        }
      })
      this.$emit('api-key-created', { apiKey: response, type: 'CREATED' })
    },
    /**
     * Resets form fields and validations
     */
    handleOpen: function() {
      this.labelPosition = 'right'
      this.autoFocus()
    },
    /**
     * Closes the dialog
     */
    closeDialog: function() {
      this.dialogVisible = false
      this.$refs.apiKeyForm.resetFields()
    },
    /**
     * Gets all items from an array by path and returns as lowercase string
     * @param {Array} path
     * @return {Array}
     */
    getItemsLower: (p) => compose(
      toLower(),
      path(p),
      defaultTo([])
    ),
    /**
     * Checks if items in an array are unique compared to the input
     * @param {Array} list
     * @param {Array} path
     * @param {string} name
     * @param {string} exclude
     * @return {Boolean}
     */
    checkUniqueName: function(list, p, name, exclude) {
      let filteredNames = map(this.getItemsLower(p), list);

      // Remove name from list if excluding
      if(exclude) {
        const index = indexOf(toLower(exclude), filteredNames);
        if(index >= 0) {
          filteredNames.splice(index, 1);
        }
      }

      return not(includes(toLower(name), filteredNames));
    }
  }
}
</script>
