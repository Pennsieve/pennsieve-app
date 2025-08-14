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
        title="Setup Two-Factor Authentication"
      />
    </template>

    <dialog-body>
      <p> Follow these steps to enable two-factor authentication for your account.</p>

      <p>Please use a TOTP-compatible authenticator app, such as Google Authenticator or Authy. <a href="https://docs.pennsieve.io" target="blank">Read More</a></p>

      <p class="strong">1. Enter the code into your authenticator app</p>

      <el-input v-model="totpCode"></el-input>

      <p class="strong">
        2. Enter validation code:
      </p>
      <el-input v-model="totpValidation" maxlength="6"></el-input>
      <p class="error" v-if="error">Incorrect validation code. Please try again.</p>
      <!-- <el-form
        ref="twoFactorForm"
        :model="ruleForm"
        :rules="rules"
        @submit.native.prevent="onTwoFactorFormSubmit"
      >
        <el-form-item
          label="Country Code"
          prop="countryCode"
        >
          <el-input
            v-model="ruleForm.countryCode"
            autofocus
          />
        </el-form-item>
        <el-form-item
          label="Phone Number"
          prop="phoneNumber"
        >
          <a11y-keys @key-pressed="onHandleKeyPressed">
            <el-input v-model="ruleForm.phoneNumber">
              <template slot="prepend">
                +{{ ruleForm.countryCode }}
              </template>
            </el-input>
          </a11y-keys>
        </el-form-item>
        <div>Please provide numbers only.</div>
      </el-form> -->
    </dialog-body>

    <template #footer>
      <bf-button
        class="secondary"
        @click="closeDialog"
      >
        Cancel
      </bf-button>
      <bf-button @click="onTwoFactorFormSubmit">
        Confirm
      </bf-button>
    </template>

  </el-dialog>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex'
import { pathOr, prop } from 'ramda'
// import {Auth} from 'aws-amplify'

// import A11yKeys from '../../shared/a11y-keys/A11yKeys.vue'
import BfButton from '../../shared/bf-button/BfButton.vue'
import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../shared/dialog-body/DialogBody.vue'

import AutoFocus from '../../../mixins/auto-focus'
import Request from '../../../mixins/request'
import EventBus from '../../../utils/event-bus'
import {useSendXhr} from "@/mixins/request/request_composable";
import {useGetToken} from "@/composables/useGetToken";

export default {
  name: 'CreateTwoFactor',

  components: {
    // A11yKeys,
    BfButton,
    BfDialogHeader,
    DialogBody
  },

  mixins: [
    AutoFocus,
    Request
  ],

  data() {
    return {
      dialogVisible: false,
      totpCode: '',
      totpValidation: '',
      error: false,
      labelPosition: 'right',
      ruleForm: {
        countryCode: '1',
        phoneNumber: '',
      },
      rules: {
        countryCode: [
          { required: true, message: 'Please provide a country code', trigger: 'false' },
        ],
        phoneNumber: [
          { required: true, message: 'Please provide your phone number', trigger: 'false' }
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
    ...mapState([
      'cognitoUser'
    ]),

  },

  methods: {
    ...mapActions([
      'updateCognitoUser'
    ]),

    /**
     * Generates Two Factor code
     */
    generateTwoFactorCode: function() {
      // retrieve current authenticated user
      //  Auth.setupTOTP(this.cognitoUser).then((code) => {
      //     this.totpCode = code
      //   })
      // .catch(err => console.error(err));
    },

    /**
     * Handles key-pressed event for last input in form
     */
    onHandleKeyPressed: function() {
      this.onTwoFactorFormSubmit()
    },
    /**
     * Handles submit event
     */
    onTwoFactorFormSubmit: function() {
      // TODO - keep code until SMS two factor validation is completed on backend
      // this.$refs.twoFactorForm
      //   .validate((valid) => {
      //     if (!valid) {
      //       return
      //     }
      //     this.sendTwoFactorAuthRequest()
      //   })
      // this.totpValidation = this.totpValidation.replace(/\s/g, '')
      // Auth.verifyTotpToken(this.cognitoUser, this.totpValidation).then(() => {
      // // don't forget to set TOTP as the preferred MFA method
      // Auth.setPreferredMFA(this.cognitoUser, 'TOTP')
      // this.handleTwoFactorXhrSucces()

      // }).catch(() => {
      //   this.error = true
      // })
    },
    /**
     * Makes XHR call to update two factor auth status
     */
    sendTwoFactorAuthRequest: function() {
      const phoneNumber = this.ruleForm.phoneNumber.replace(/\D/g, '')

      useGetToken()
        .then(token => {
          const url = `${this.config.apiUrl}/user/twofactor?api_key=${token}`
          return useSendXhr(url, {
            method: 'POST',
            body: {
              countryCode: this.ruleForm.countryCode,
              phoneNumber
            }
          })
            .then(this.handleTwoFactorXhrSucces.bind(this))
        })
        .catch(this.handleXhrError.bind(this))
    },
    /**
     * Handles successful two factor xhr response
     * @param {Object} response
     */
    handleTwoFactorXhrSucces: function(response) {
      this.closeDialog()
      this.error = false

      EventBus.$emit('toast', {
        detail: {
          type: 'MESSAGE',
          msg: 'Two-factor Authentication successfully added'
        }
      })

      this.$emit('change-status', true)

    },
    /**
     * Resets form fields and validations
     */
    handleOpen: function() {
      this.labelPosition = 'right'
      this.apiKeys = []
      this.autoFocus()
    },
    /**
     * Closes the dialog
     */
    closeDialog: function() {
      this.dialogVisible = false
      this.totpValidation = ''
      // this.$refs.twoFactorForm.resetFields()
    }
  },

  watch: {
    dialogVisible: {
      handler: function(val) {
        if (val) {
          this.error = false
          this.generateTwoFactorCode()
        }
      },
      immediate: true
    }
  },
}
</script>

<style scoped lang="scss">
@import '../../../assets/_variables.scss';
  p {
    color: black;
  }

  .dialog-box {
    width: 540px;
  }

  .strong {
    font-size: 14px;
    font-weight: 500;
    margin-top: 30px;
  }

  .error {
    color: red;
    font-size: 12px;
    margin-top: 3px;
  }

</style>
