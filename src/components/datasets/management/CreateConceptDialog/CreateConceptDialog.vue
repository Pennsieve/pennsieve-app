<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    class="add-concept-dialog"
    :show-close="false"
    @open="autoFocus"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header
        slot="title"
        title="New Metadata Model"
      />
    </template>

    <dialog-body>
      <el-form
        ref="conceptForm"
        :model="concept"
        :rules="rules"
        label-position="top"
        @submit.native.prevent="createconcept"
        @keyup.enter.native="createConcept"
      >
        <template #default>
          <el-form-item prop="displayName" >
            <template #label>
              Display Name <span class="label-helper">
              required
            </span>
            </template>
            <el-input
              v-model="concept.displayName"
              placeholder="For example Name, Type, Species"
              autofocus
            />
          </el-form-item>

          <el-form-item prop="name">
            <template #label>
              Model Identifier <span class="label-helper">
              generated from name
            </span>
            </template>
            <el-input
              v-model="concept.name"
            />
          </el-form-item>
        </template>

      </el-form>
    </dialog-body>


    <template #footer>
      <bf-button
        class="secondary"
        @click="closeDialog"
      >
        Cancel
      </bf-button>
      <bf-button
        :processing="processing"
        processing-text="Creating Your Model"
        @click="createConcept"
      >
        Create Model
      </bf-button>
    </template>

  </el-dialog>
</template>

<script>
  import snakeCase from 'lodash.snakecase'
  import { propOr } from 'ramda'
  import { mapGetters, mapActions, mapState } from 'vuex'

  import BfButton from '../../../shared/bf-button/BfButton.vue'
  import BfDialogHeader from '../../../shared/bf-dialog-header/BfDialogHeader.vue'
  import DialogBody from '../../../shared/dialog-body/DialogBody.vue'
  import Request from '../../../../mixins/request/index'
  import AutoFocus from '../../../../mixins/auto-focus'
  import Sorter from '../../../../mixins/sorter'
  import checkUniqueName from '../../../../mixins/check-unique-names'

  export default {
    name: 'CreateConceptDialog',

    components: {
      BfDialogHeader,
      DialogBody,
      BfButton
    },

    mixins: [
      Request,
      AutoFocus,
      checkUniqueName,
      Sorter
    ],

    props: {
      selectedFiles: Array,
      dialogVisible: Boolean
    },

    data: function() {
      return {
        processing: false,
        concept: {
          displayName: '',
          name: ''
        },
        rules: {
          displayName: [
            { required: true, validator: this.validateDisplayName, trigger: 'false' },
          ],
          name: [
            { required: true, validator: this.validateName, trigger: 'false' },
          ]
        }
      }
    },

    computed: {
      ...mapGetters([
        'userToken',
        'config',
        'hasFeature',
      ]),
      ...mapState([
        'onboardingEvents'
      ]),
      ...mapState('metadataModule',[
        'models'
      ]),

      /**
       * Convert display name into snake case
       * @returns {String}
       */
      name: function() {
        return snakeCase(this.concept.displayName)
      },

      /**
       * Onboarding Events Url
       * @returns {String}
       */
      onboardingEventsUrl() {
        const apiUrl = propOr('', 'apiUrl', this.config)
        if (apiUrl && this.userToken) {
          return `${apiUrl}/onboarding/events?api_key=${this.userToken}`
        }
      }
    },

    watch: {
      /**
       * Watch name and set form model to the value
       * @param {String} val
       */
      name: function(val) {
        this.concept.name = val
      }
    },

    methods: {
      ...mapActions([
        'updateOnboardingEvents'
      ]),
      ...mapActions('metadataModule',[
        'updateModels'
      ]),

      /**
       * Closes the dialog
       */
      closeDialog: function() {
        this.$emit('close')
        this.$refs.conceptForm.resetFields()
      },

      /**
       * Send concept to API to create it
       */
      createConcept: function() {
        this.processing = true
        this.$refs.conceptForm.validate((valid) => {
          if (!valid) {
            this.processing = false
            return
          }

          const datasetId = this.$route.params.datasetId
          const url = `${this.config.conceptsUrl}/datasets/${datasetId}/concepts`

          this.sendXhr(url, {
            header: {
              'Authorization': `bearer ${this.userToken}`
            },
            method: 'POST',
            body: {
              name: this.concept.name,
              displayName: this.concept.displayName,
              description: '',
              locked: false
            }
          })
          .then(this.handleCreateConcept.bind(this))
          .catch(err => {
            this.processing = false
            this.handleXhrError(err)
          })
        })
      },

      /**
       * Add concept to state then send user to concept manage page
       * @param {Object} model
       */
      handleCreateConcept: function(model) {
        // Add to state
        const models = [...this.models, model]
        const sortedConcepts = this.returnSort('displayName', models, 'asc')

        // check for onboarding event state for creating a model
        if (this.onboardingEvents.indexOf('CreatedModel') === -1){
          // make post request
          this.sendOnboardingEventsRequest()
        }

        this.updateModels(sortedConcepts).then(() => {
          // Redirect user to new concept instance page
          // this.$router.replace({
          //   name: 'models',
          // })
          this.closeDialog()
          this.processing = false
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
          callback(new Error('Please provide an identifier'))
        }
        const isUnique = this.checkUniqueName(this.models, ['name'], value, '')
        if (!isUnique) {
          callback(new Error('A concept with this name already exists'))
        }
        callback()
      },

      /**
       * Validate Display Name
       * @param {Object} rule
       * @param {String} value
       * @param {Function} callback
       */
      validateDisplayName: function(rule, value, callback) {
        if (value === '') {
          callback(new Error('Please provide a display name'))
        }
        const isUnique = this.checkUniqueName(this.models, ['displayName'], value, '')
        if (!isUnique) {
          callback(new Error('A concept with this display name already exists'))
        }
        callback()
      },

      sendOnboardingEventsRequest: function(){
        if (this.onboardingEventsUrl){
          this.sendXhr(this.onboardingEventsUrl, {
            method: 'POST',
            body: 'CreatedModel',
            header: {
              'Authorization': `bearer ${this.userToken}`
            }
          })
          .then(response => {
            const onboardingEvents = [...this.onboardingEvents, 'CreatedModel']
            this.updateOnboardingEvents(onboardingEvents)
          })
          .catch(this.handleXhrError.bind(this))
        }

      }
    }
  }
</script>

<style lang="scss" scoped>
  .button-spinner {
    height: 20px;
    margin: -3px 8px -3px 0;
    width: 20px;
  }
</style>
