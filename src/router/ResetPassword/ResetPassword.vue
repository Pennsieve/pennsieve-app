<template>
  <div
    class="reset-password"
    :class="{ 'welcome-to-pennsieve': $route.name === 'welcome-to-pennsieve' }"
  >
    <div class="reset-password-wrapper">
      <div class="reset-password-inner">
        <div class="login-header">
          <PennsieveLogoContainer
            class="logo-container"
            :dark-background="false"
            :show-pennsieve-logo="true"
          />

        </div>
        <!-- submit email -->
        <div
          v-if="!verificationCode && !linkSent"
          key="emailForm"
        >
          <h2>Reset your password.</h2>
          <p
            v-if="!hideEmail"
            class="email-description"
          >
            Enter the email address associated with your account, and we’ll email you a link to reset your password.
          </p>
          <el-form
            ref="emailForm"
            :model="emailForm"
            :rules="emailRules"
            @submit.native.prevent="onEmailFormSubmit"
          >
            <el-form-item
              class="email"
              prop="email"
            >
              <el-input
                v-model="emailForm.email"
                type="email"
                placeholder="Your email address"
                autofocus
                @enter="onEmailFormSubmit"
              />
            </el-form-item>
              <bf-button
                class="send-email-btn"
                :processing="isSendingEmail"
                processing-text="Sending Email"
                @click="onEmailFormSubmit"
              >
                Reset Password
              </bf-button>
              <router-link
                :to="{ name: 'home' }"
                class="back-to-login"
              >
                Back to sign in page.
              </router-link>
          </el-form>

          <p
            v-if="errorMsg !== ''"
            class="mt-8 error"
          >
            {{ errorMsg }}
          </p>
        </div>

        <!-- submit new password -->
        <div
          v-if="verificationCode || linkSent"
          key="resetForm"
        >
          <h2 v-if="linkSent">
            Reset code sent.
          </h2>
          <h2 v-else>
            Reset your password.
          </h2>
          <p class="link-sent-text">
            We’ve sent an email that contains a code to reset your password. Contact support if you have any issues or don’t receive an email.
          </p>
          <p class="password-requirements">
            We recommend that you create a password that is more than 8 characters long and contains a combination of uppercase &amp; lowercase characters,
            numbers and symbols.
          </p>
          <el-form
            ref="passwordForm"
            :model="passwordForm"
            :rules="passwordRules"
            @submit.native.prevent="onPasswordFormSubmit"
          >
            <el-form-item
              v-show="!$route.query.username"
              class="email"
              prop="email"
            >
              <el-input
                ref="passwordFormEmail"
                v-model="passwordForm.email"
                placeholder="Email"
              />
            </el-form-item>
            <el-form-item
              class="code"
              prop="code"
            >
              <el-input
                ref="passwordFormCode"
                v-model="passwordForm.code"
                placeholder="Verification Code"
              />
            </el-form-item>
            <el-form-item
              class="password"
              prop="password"
            >
              <el-input
                v-model="passwordForm.password"
                type="password"
                placeholder="New Password"
                autofocus
                @click="onPasswordFormSubmit"
                show-password
              />
              <transition name="el-zoom-in-top">
                <div
                  v-if="isPasswordFormValid"
                  class="pw-is-valid-text"
                >
                  Strong Password!
                </div>
              </transition>
            </el-form-item>
              <bf-button
                class="reset-pw-btn"
                :processing="isResettingPassword"
                :processing-text="resettingPasswordText"
                @click="onPasswordFormSubmit"
              >
                Reset Password
              </bf-button>
              <router-link
                :to="{ name: 'home' }"
                class="back-to-login"
              >
                Back to sign in page.
              </router-link>

            <p
              v-if="errorMsg !== ''"
              class="mt-8 error"
            >
              {{ errorMsg }}
            </p>
          </el-form>
        </div>
      </div>

      <pennsieve-simple-footer/>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { pathOr, propOr } from 'ramda'
import { confirmResetPassword, resetPassword, signIn } from 'aws-amplify/auth';

import BfButton from '../../components/shared/bf-button/BfButton.vue'
import PennsieveSimpleFooter from "../../components/shared/PennsieveFooter/PennsieveSimpleFooter.vue";

import AutoFocus from '../../mixins/auto-focus'
import Request from '../../mixins/request'
import PasswordValidator from '../../mixins/password-validator/index'
import EventBus from '../../utils/event-bus'
import PennsieveMark from "../../components/icons/IconPennsieveMark.vue";
import PennsieveLogoContainer from "../../components/shared/PennsieveLogoContainer/PennsieveLogoContainer.vue";

export default {
  name: 'ResetPassword',

  components: {
    PennsieveMark,
    BfButton,
    PennsieveSimpleFooter,
    PennsieveLogoContainer
  },

  mixins: [
    AutoFocus,
    Request,
    PasswordValidator
  ],

  data() {
    const validatePassword = (rule, value, callback) => {

      if (value === '') {
        this.isPasswordFormValid = false
        return callback(new Error('Please input the password'))
      }

      const { isValid, feedback } = this.validatePassword(value)

      if (!isValid) {
        this.isPasswordFormValid = false
        callback(new Error(feedback))
      } else {
        this.isPasswordFormValid = true
        callback()
      }
    }

    return {
      hideEmail: false,
      hidePassword: true,
      linkSent: false,
      emailForm: {
        email: ''
      },
      emailRules: {
        email: [
          { type: 'email', required: true, message: 'Please add your Email', trigger: 'submit' }
        ]
      },
      passwordForm: {
        email: '',
        password: '',
        code: ''
      },
      passwordRules: {
        email: [
          { required: true, message: 'Please add your Email' }
        ],
        code: [
          { required: true, message: 'Please add your verification code' }
        ],
        password: [
          { validator: validatePassword, trigger: 'change' }
        ]
      },
      isSendingEmail: false,
      isResettingPassword: false,
      isPasswordFormValid: false,
      tempEmail: '',
      errorMsg: '',
      resettingPasswordText: 'Saving'
    }
  },

  computed: {
    ...mapState([
      'config'
    ]),

    /**
     * Grab verificationCode from query param in route
     */
    verificationCode: function() {
      return this.$route.query.verificationCode
    },

    /**
     * Compute Reset Password Email Url
     */
    resetPasswordEmailUrl: function() {
      const apiUrl = propOr('', 'apiUrl', this.config)
      const email = propOr('', 'email', this.emailForm)

      if (apiUrl && email) {
        return `${apiUrl}/account/${email}/reset`;
      }
      return ''
    },

    /**
     * Compute Reset Password Url
     */
    resetPasswordUrl: function() {
      const apiUrl = propOr('', 'apiUrl', this.config)

      if (apiUrl) {
        return `${apiUrl}/account/reset`
      }
      return ''
    }
  },

  watch: {
    verificationCode: {
      handler(val) {
        this.passwordForm.code = val
      },
      immediate: true
    },
    '$route.query.username': {
      handler(val) {
        this.passwordForm.email = val
      },
      immediate: true
    }
  },

  methods: {
    /**
     * Send XHR to send reset password email
     * @param {Object} e
     */
    onEmailFormSubmit: function(e) {
      this.$refs.emailForm.validate(valid => {
        if (!valid) {
          return
        }

        this.submitResetRequest()
      })
    },

    /**
     * Submit the password reset request
     */
    submitResetRequest: async function() {
      this.isSendingEmail = true

      const output = await resetPassword({
        username: this.emailForm.email
      });

      const { nextStep } = output;
      switch (nextStep.resetPasswordStep) {
        case 'CONFIRM_RESET_PASSWORD_WITH_CODE':
          const codeDeliveryDetails = nextStep.codeDeliveryDetails;
          console.log(
            `Confirmation code was sent to ${codeDeliveryDetails.deliveryMedium}`
          );
          this.isSendingEmail = false
          // Collect the confirmation code from the user and pass to confirmResetPassword.
          break;
        case 'DONE':
          console.log('Successfully reset password.');
          break;
      }
    },

    /**
     * Reset password email callback
     */
    onEmailFormSuccess: function() {
      this.linkSent = true
      this.hideEmail = true
      this.passwordForm.email = this.emailForm.email

      this.$nextTick(() => {
        this.$refs.passwordFormEmail.focus()
      })
    },

    /**
     * Send XHR to set new password
     * @param {Object} e
     */
    onPasswordFormSubmit: function (e) {
      this.resettingPasswordText = 'Saving'

      this.$refs.passwordForm.validate(valid => {
        if (!valid) {
          return
        }

        this.isResettingPassword = true

        const { email, code, password } = this.passwordForm
        // Collect confirmation code and new password, then
        confirmResetPassword({
          username: email,
          confirmationCode: code,
          newPassword: password
        })
          .then(() => {
            this.resettingPasswordText = 'Reset successful!'
            EventBus.$emit('toast', {
              type: 'success',
              msg: 'Password successfully reset'
            })
          })
          .catch(error => {
            this.errorMsg = error.message
            this.isResettingPassword = false
          })
      })
    },

    /**
     * Login the user after successfully resetting their password
     * On failure, take the user back to the login page
     */
    // loginUser: async function() {
    //   try {
    //     const { email, password } = this.passwordForm
    //     const user = await signIn(email, password)
    //     const token = pathOr('', ['signInUserSession', 'accessToken', 'jwtToken'], user)
    //     const userAttributes = propOr({}, 'attributes', user)
    //     EventBus.$emit('login', { token, userAttributes })
    //   } catch (error) {
    //     EventBus.$emit('toast', {
    //       type: 'success',
    //       msg: 'Password successfully reset'
    //     })
    //   }
    // }
  }
}
</script>

<style lang="scss">
@import '../../assets/variables.scss';

.logo-container {
  width: 300px;
}

.reset-password {
  background: $purple_1;
  display: block;

  h2 {
    color: $purple_3;
    font: 700 24px/31px SharpSans,sans-serif;
    margin: 0 0 10px 0;
  }


  .reset-password-wrapper {
    background: $white;
    box-sizing: border-box;
    color: $gray_4;
    max-width: 720px;
    min-height: 100vh;
    padding-bottom: 20px;
    padding-top: 130px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .reset-password-inner {
    background: $white;
    box-sizing: border-box;
    color: $gray_4;
    max-width: 720px;
    flex: 1;
    width: 360px;
  }

  .login-header {
    margin-bottom: 60px;
    display: flex;
    flex-direction: row;
    justify-content: center;
  }

  .logo {
    display: block;
    height: 35px;
    width: 198px;
  }

  .email-description {
    margin-bottom: 28px;
  }

  .el-form-item.email {
    margin-bottom: 20px;
  }

  .send-email-btn,
  .reset-pw-btn {
    width: 50%;
  }

  .back-to-login {
    margin-left: 16px;
    width: 50%;
    text-align: center;
  }

  .link-sent-text {
    margin-bottom: 16px;
  }

  .password-requirements {
    margin-bottom: 24px;
  }

  .pw-is-valid-text {
    color: #17bb62;
    font-size: 13px;
    line-height: 1;
    padding: 13px 10px;
    background: #FAFAFA;
    border-radius: 0 0 5px 5px;
    border: solid 1px #dadada;
    height: 15px;
    width: 93.5%;
    position: relative;
    z-index: 0;
    margin: 0;
  }

  .button-spinner {
    height: 20px;
    margin: -3px 8px -3px 0;
    width: 20px;
  }

  .send-email-form-item {
    .el-form-item__content {
      display: flex;
    }
  }

  .reset-pw-form-item {
    .el-form-item__content {
      display: flex;
    }
  }
  .error {
    color: $error-color;
  }
}

.welcome-to-pennsieve {
  .login-header {
    align-items: center;
    flex-direction: column;
  }
}
</style>
