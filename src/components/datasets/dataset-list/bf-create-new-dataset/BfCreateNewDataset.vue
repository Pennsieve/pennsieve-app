<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    :show-close="false"
    class="create-new-dataset-dialog"
    @open="handleOpen"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header
        title="Create Dataset"
      />
    </template>


    <dialog-body>
      <!-- Step 1 -->
      <el-form
        v-show="shouldShow(1)"
        ref="newDatasetFormStep1"
        :model="newDatasetForm"
        label-position="top"
        :rules="rules"
        @submit.native.prevent="createDataset()"
      >
        <el-form-item
          label="Dataset Name"
          prop="name"
        >
          <el-input
            v-model="newDatasetForm.name"
            autofocus
            :maxlength="255"
          />
        </el-form-item>
        <el-form-item
          label="Subtitle"
          prop="description"
        >
          <el-input
            v-model="newDatasetForm.description"
            :rows="4"
            :maxlength="255"
            :show-word-limit="true"
          />
        </el-form-item>
      </el-form>

      <!-- Step 2 -->
      <el-form
        v-show="shouldShow(2)"
        ref="newDatasetFormStep2"
        :model="newDatasetForm"
        :rules="rules"
        @submit.native.prevent="createDataset('newDatasetForm')"
      >
        <div
          class="section-title"
        >
          Manage Integrations
        </div>
        <p
          class="section-description"
        >
          Integrations allow external services to be notified when certain events occur on Pennsieve.
          <span v-show="hasDefaultIntegrations">Some integrations are turned on by default by the <span class="org-name">{{ activeOrganization }}</span> Administrators.</span>
        </p>

        <div
          class="integration-list"
        >
          <integration-item-small
            v-for="integration in integrations"
            :key="integration.id"
            :integration="integration"
            :open-index="openIndex"
            @updateIsActive="updateIsActive"
          />
        </div>

        <el-form-item
          v-show="hasActiveIntegrations"
          prop="acknowledgeInfo"
        >
          <el-checkbox
            v-model="acknowledgeInfo"
            class="acknowledgeInfo"
            label="I acknowledge events will be shared with a third party"
          />
        </el-form-item>
      </el-form>
    </dialog-body>

    <template #footer>
      <bf-button
        tabindex="4"
        class="secondary"
        @click="advanceStep(-1)"
      >
        {{ stepBackText }}
      </bf-button>

      <bf-button
        :disabled="isCreating"
        :processing="isCreating"
        processing-text="Creating Dataset"
        @click="advanceStep(1)"
      >
        {{ createText }}
      </bf-button>
    </template>

  </el-dialog>
</template>

<script>
  import { mapGetters, mapState, mapActions } from 'vuex'
  import { propOr, pathOr } from 'ramda'

  import BfButton from '../../../shared/bf-button/BfButton.vue'
  import BfDialogHeader from '../../../shared/bf-dialog-header/BfDialogHeader.vue'
  import DialogBody from '../../../shared/dialog-body/DialogBody.vue'
  import IntegrationItemSmall from "./IntegrationItemSmall.vue";

  import CheckUniqueNames from '../../../../mixins/check-unique-names'
  import SanitizeName from '../../../../mixins/sanitize-name'
  import Request from '../../../../mixins/request'
  import AutoFocus from '../../../../mixins/auto-focus'

  import EventBus from '../../../../utils/event-bus'
  import {useGetToken} from "@/composables/useGetToken";
  import {useSendXhr} from "@/mixins/request/request_composable";

  export default {
    name: 'BfCreateNewDataset',

    components: {
      BfButton,
      BfDialogHeader,
      DialogBody,
      IntegrationItemSmall
    },

    mixins: [
      Request,
      AutoFocus,
      CheckUniqueNames,
      SanitizeName
    ],

    props: {
      dialogVisible: Boolean,
      datasets: Array,
      integrations: Array
    },

    data: function() {
      return {
        processStep: 1,
        openIndex:0,
        newDatasetForm: {
          name: '',
          description: '',
          includedWebhookIds: [],
          excludedWebhookIds: []
        },
        rules: {
          name: [
            { required: true, validator: this.validateName, trigger: 'false' },
          ],
          acknowledgeInfo: [
            { required: true, validator: this.checkedAck, trigger: 'false' }
          ]
        },
        duplicateName: false,
        step: 2,
        templateSelection: '',
        isCreating: false,
        acknowledgeInfo: false,
        hasActiveIntegrations: false
      }
    },

    computed: {
      ...mapState([
        'config',
        'datasetTemplates',
        'activeOrganization'
      ]),

      ...mapGetters([
        'hasFeature',
        'getActiveOrganization'
      ]),

      hasDefaultIntegrations: function() {
        return this.integrations.map(x => x.isDefault).some( (x) => x === true)
      },

      activeOrganization :function() {
        if (this.getActiveOrganization().organization) {
          return  this.getActiveOrganization().organization.name
        } else {
          return ''
        }
      },

      createText: function() {
        return this.processStep > 1 ? 'Create Dataset' : 'Continue'
      },

      stepBackText: function() {
        return this.processStep > 1 ? 'Back' : 'Cancel'
      },


      /**
       * Compute if user has dataset templates
       * @returns {Boolean}
       */
      hasTemplates: function() {
        return this.hasFeature('dataset_templates_feature') && this.datasetTemplates.length > 0
      },

      /**
       * Computes whether or not user has administratrive rights for the organization
       * @returns {Boolean}
       */
      hasAdminRights: function() {
        const isAdmin = propOr(false, 'isAdmin', this.activeOrganization)
        const isOwner = propOr(false, 'isOwner', this.activeOrganization)
        return isAdmin || isOwner
      },

      /**
       * Compute url for creating a dataset from a template
       * @returns {String}
       */
      createDatsetFromTemplateUrl: function() {
        const orgId = pathOr('', ['organization', 'intId'], this.activeOrganization)
        const templateId = this.templateSelection

        if (!orgId || !templateId) {
          return ''
        }

        return `${this.config.apiUrl}/model-schema/organizations/${orgId}/dataset-templates/${templateId}`
      }
    },

    watch: {
      hasTemplates: {
        handler: function(val) {
          if (val === true) {
            this.step = 1
          } else {
            this.step = 2
          }
        },
        immediate: true
      },
    },

    mounted: function() {
    },

    methods: {
      ...mapActions([
        'addDataset',
      ]),
      /**
       * Compute create dataset url
       * @returns {String}
       */
      createDatasetsUrl: async function() {
        return useGetToken()
          .then(token => {
            return `${this.config.apiUrl}/datasets?api_key=${token}`
          }).catch(err => console.log(err))
      },

      updateIsActive: function(value) {
        this.integrations.filter(n => n.id === value.id)[0].isActive = value.isActive
        this.checkActiveIntegrations()

      },
      checkActiveIntegrations: function() {
        this.hasActiveIntegrations = this.integrations.map(x => x.isActive).some( (x) => x === true)
      },
      /**
       * Determines button action
       * @param step
       */
      advanceStep: function(step) {
        this.processStep += step
        if (this.processStep === 0) {
          this.closeDialog()
        }
        if (this.processStep === 3) {
          this.processStep = 2
          this.createDataset('newDatasetForm')
        }
      },

      /**
       * Determines which step content is active
       * @param {number} key
       * @returns {Boolean}
       */
      shouldShow: function(key) {
        return this.processStep === key
      },

      /**
       * Handles key-pressed event
       * @param {Object} evt
       */
      handleKeyPress: function(evt) {
        evt.preventDefault()
        this.createDataset('newDatasetForm')
      },
      /**
       * Resets the form
       */
      handleOpen: function() {
        this.autoFocus()
        this.openIndex += 1
        for (let x in this.integrations) {
          this.integrations[x].isActive = this.integrations[x].isDefault
        }
      },
      /**
       * Closes the dialog
       */
      closeDialog: function() {
        this.$emit('close-dialog')
        this.duplicateName = false
        for (let x in this.integrations) {
          this.integrations[x].isActive = this.integrations[x].isDefault
        }

        setTimeout(() => {
          this.processStep = 1
          this.$refs.newDatasetFormStep1.resetFields()
          this.$refs.newDatasetFormStep2.resetFields()
        })

        // // form ref is only available in step 2
        // if (this.step === 2) {
        //   this.$refs.newDatasetFormStep1.resetFields()
        // }

        // if (this.hasTemplates) {
        //   // scroll dataset templates section to top
        //   const scrollEl = this.$el.querySelector('.el-dialog__body')
        //   scrollEl.scrollTop = 0
        // }

        // this.hasTemplates ? this.step = 1 : this.step = 2
        // this.templateSelection = ''
      },
      /**
       * Create Dataset
       */
      createDataset: function() {
        this.duplicateName = false
        let isValid = true

        // Set include/exclude webhooks
        this.newDatasetForm.includedWebhookIds= this.integrations.filter(n => n.isActive === true).map(x => x.id)
        this.newDatasetForm.excludedWebhookIds = this.integrations.filter(n => n.isActive === false).map(x => x.id)

        this.$refs.newDatasetFormStep1.validate( (valid) => {
          if (!valid) {
            isValid = false
            return this.processStep = 1
          }
        })

        this.$refs.newDatasetFormStep2.validate( (valid) => {
          if (!valid) {
            isValid = false
            return this.processStep = 2
          }
        })

        if (isValid) {
          this.sendRequest()
        }

      },
      /**
       * Sends XHR request to create dataset
       */
      sendRequest: function() {
        this.isCreating = true

        this.createDatasetsUrl()
          .then(url => {
            return useSendXhr(url, {
              method: 'POST',
              body: this.newDatasetForm
            })
              .then(this.handleSuccess.bind(this))
              .catch(err => {
                this.isCreating = false
                this.handleError(err)
              })
          })

      },
      /**
       * Handles successful dataset creation ajax
       * @param {Object} response
       */
      handleSuccess: function(response) {
        this.addDataset(response).then(() => {
          this.closeDialog()

          EventBus.$emit('track-event', {
            name: 'Dataset Created'
          })

          const id = pathOr('', ['content', 'id'], response)
          this.$router.push({ name: 'dataset', params: { datasetId: id }})
          this.isCreating = false
        })
      },
      /**
       * Handles error dataset creation ajax
       * @param {Object} response
       */
      handleError: function(response) {
        if (response.status === 400) {
          this.duplicateName = true
          this.$refs.newDatasetFormStep1.validate((valid) => {
            if (!valid) {
              return this.processStep = 1
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
      // eslint-disable-next-line complexity
      validateName: function(rule, value, callback) {
        const isUnique = this.checkUniqueName(this.datasets, ['content', 'name'], value, '')
        const hasReservedChars = this.containsReservedChars(value)
        if (value === '') {
          callback(new Error('Please provide a name'))
        } else if (value.length > 255) {
          callback(new Error('Dataset name must be less than 255 characters'))
        } else if (hasReservedChars) {
          callback(new Error(`A dataset name cannot contain any of the following characters: ${ this.reservedCharsStr }`))
        } else if  (!isUnique || this.duplicateName) {
          callback(new Error('A dataset with this name already exists'))
        } else {
          callback()
        }
      },
      checkedAck: function(rule, value, callback) {
        const needCheck = this.hasActiveIntegrations
        if (needCheck) {
          if (this.acknowledgeInfo) {
            callback()
          } else {
            callback(new Error('Need to acknowledge sharing info'))
          }
        } else {
          callback()
        }
      },
      /**
       * Handle dataset template selection
       * @param {String} templateSelection
       */
      onTemplateClick: function(templateSelection) {
        this.templateSelection = templateSelection
      },
      /**
       * Handle continue button click
       */
      onContinue: function() {
        this.step = 2
      }
    }
  }
</script>

<style lang="scss" scoped>
@import "../../../../assets/_variables.scss";

.el-dialog__header, .el-dialog__body {
  padding: 24px 24px 32px 0;

}


.acknowledgeInfo {
  color: $gray_5;
}

.integration-list {
  max-height: 300px;
  overflow: scroll;
}
.section-title {
  color: $gray_5;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}

.section-description {
  margin-bottom: 40px;
  color:$gray_5;
}

.org-name {
  color: $purple_1;
  font-weight: 500;
}

.dataset-template-select-item {
  padding-top: 16px;
  cursor: pointer;

  h2 {
    margin-bottom: 8px;
  }

  h2, p {
    padding: 0 32px;
  }

  hr {
    margin: 16px 0 0;
  }

  &:hover {
    background: $gray_2;
    hr {
      border-top-color: $gray_2;
    }
  }

  &.selected {
    color: white;
    background: $purple_1;

    h2 {
      color: white;
    }

    hr {
      border-top-color: $purple_1;
    }
  }
}

.dataset-template-select-item:last-of-type {
  hr {
    opacity: 0;
  }
}

.manage-datasets {
  position: absolute;
  right: 32px;
  bottom: 24px;
}

.icon-help-processing {
  margin-bottom: 3px;
  margin-left: 4px;
}
</style>

<!--<style lang="scss">-->
<!--.create-new-dataset-dialog {-->
<!--  &.step-1 {-->
<!--    .el-dialog__body {-->
<!--      max-height: 250px;-->
<!--      overflow-y: scroll;-->
<!--      padding: 0 0 24px;-->
<!--    }-->
<!--  }-->
<!--}-->
<!--</style>-->


