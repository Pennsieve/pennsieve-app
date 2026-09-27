<template>
  <AuthLayout>
    <!-- submit email -->
    <div
      v-if="!verificationCode && !linkSent"
      key="emailForm"
      class="auth-content"
    >
      <h2 class="auth-title">Reset your password</h2>
      <p
        v-if="!hideEmail"
        class="auth-info"
      >
        Enter the email address associated with your account, and we’ll email you a link to reset your password.
      </p>

      <div
        v-if="errorMsg !== ''"
        class="auth-error"
        role="alert"
      >
        {{ errorMsg }}
      </div>

      <el-form
        ref="emailForm"
        :model="emailForm"
        :rules="emailRules"
        class="auth-form"
        label-position="top"
        hide-required-asterisk
        @submit.prevent="onEmailFormSubmit"
      >
        <el-form-item
          label="Email"
          prop="email"
        >
          <el-input
            v-model="emailForm.email"
            type="email"
            autocomplete="username"
            autofocus
          />
        </el-form-item>
        <bf-button
          class="auth-full-width"
          type="submit"
          :processing="isSendingEmail"
          processing-text="Sending Email"
        >
          Reset Password
        </bf-button>
      </el-form>

      <router-link
        :to="signInRoute"
        class="auth-secondary-link"
      >
        Back to Sign In
      </router-link>
    </div>

    <!-- submit new password -->
    <div
      v-if="verificationCode || linkSent"
      key="resetForm"
      class="auth-content"
    >
      <h2
        v-if="linkSent"
        class="auth-title"
      >
        Reset code sent
      </h2>
      <h2
        v-else
        class="auth-title"
      >
        Reset your password
      </h2>
      <p
        v-if="linkSent"
        class="auth-info"
      >
        We’ve sent an email that contains a code to reset your password. Contact support if you have any issues or don’t receive an email.
      </p>
      <p class="auth-info password-requirements">
        Use more than 8 characters, with a mix of uppercase &amp; lowercase letters, numbers and symbols.
      </p>

      <div
        v-if="errorMsg !== ''"
        class="auth-error"
        role="alert"
      >
        {{ errorMsg }}
      </div>

      <el-form
        ref="passwordForm"
        :model="passwordForm"
        :rules="passwordRules"
        class="auth-form"
        label-position="top"
        hide-required-asterisk
        @submit.prevent="onPasswordFormSubmit"
      >
        <el-form-item
          v-show="!$route.query.username"
          label="Email"
          prop="email"
        >
          <el-input
            ref="passwordFormEmail"
            v-model="passwordForm.email"
            type="email"
            autocomplete="username"
          />
        </el-form-item>
        <el-form-item
          label="Verification code"
          prop="code"
        >
          <el-input
            ref="passwordFormCode"
            v-model="passwordForm.code"
            autocomplete="one-time-code"
            inputmode="numeric"
          />
        </el-form-item>
        <el-form-item
          label="New password"
          prop="password"
        >
          <el-input
            v-model="passwordForm.password"
            type="password"
            autocomplete="new-password"
            show-password
          />
        </el-form-item>
        <p
          v-if="isPasswordFormValid"
          class="pw-is-valid-text"
        >
          Strong password!
        </p>
        <bf-button
          class="auth-full-width"
          type="submit"
          :processing="isResettingPassword"
          :processing-text="resettingPasswordText"
        >
          Reset Password
        </bf-button>
      </el-form>

      <router-link
        :to="signInRoute"
        class="auth-secondary-link"
      >
        Back to Sign In
      </router-link>
    </div>
  </AuthLayout>
</template>

<script>
import { mapState } from 'vuex'
import { pathOr, propOr } from 'ramda'
import { confirmResetPassword, resetPassword, signIn } from 'aws-amplify/auth';

import BfButton from '../../components/shared/bf-button/BfButton.vue'
import AuthLayout from '../../components/shared/AuthLayout/AuthLayout.vue'
import { isFeatureEnabled } from '@/utils/features'

import AutoFocus from '../../mixins/auto-focus'
import Request from '../../mixins/request'
import PasswordValidator from '../../mixins/password-validator/index'
import EventBus from '../../utils/event-bus'

export default {
  name: 'ResetPassword',

  components: {
    BfButton,
    AuthLayout
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

    signInRoute: function() {
      return isFeatureEnabled('inAppLogin') ? { name: 'login' } : { name: 'home' }
    },

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
      this.errorMsg = ''

      try {
        const { nextStep } = await resetPassword({
          username: this.emailForm.email
        })
        if (nextStep.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
          this.onEmailFormSuccess()
        }
      } catch (error) {
        this.errorMsg = error.message
      } finally {
        this.isSendingEmail = false
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
        this.$refs.passwordFormCode.focus()
      })
    },

    /**
     * Send XHR to set new password
     * @param {Object} e
     */
    onPasswordFormSubmit: function (e) {
      if (this.isResettingPassword) {
        return
      }
      this.resettingPasswordText = 'Saving'
      this.errorMsg = ''

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
              detail: {
                type: 'success',
                msg: 'Password successfully reset. Sign in with your new password.'
              }
            })
            this.$router.push(this.signInRoute)
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

<style scoped lang="scss">
@use '../../styles/theme';

.password-requirements {
  font-size: 14px;
  color: theme.$gray_5;
}

.pw-is-valid-text {
  margin: -8px 0 16px 0;
  color: theme.$green_2;
  font-size: 14px;
  line-height: 24px;
}
</style>
