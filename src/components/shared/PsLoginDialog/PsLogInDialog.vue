<template>
  <el-dialog
    class="light-header ps-login-dialog"
    :modelValue="visible"
    @update:modelValue="visible = $event"
    :width="dialogWidth"
    @close="closeLogInDialog"
  >

    
    <div class="log-in-dialog__container" :class="containerClass">
      <PennsieveLogoContainer class="dialog-container" stacked="stacked" :show-penn-logo="false"/>

      <template v-if="logInState !== states.TWO_FACTOR">
        <p
             class="log-in-dialog__container--top-copy">
          {{ formTopCopy }}
        </p>
        <template v-if="isLogInState">
          <el-form
            ref="logInForm"
            :model="logInForm"
            :rules="logInRules"
            :validate-on-rule-change="false"
            @submit.native.prevent="onFormSubmit('logInForm')"
          >
            <el-form-item prop="email" >
              <el-input v-model="logInForm.email" placeholder="Email Address" @keyup.enter.native="onEnter"/>
            </el-form-item>
            <el-form-item prop="password">
              <el-input
                ref="pwdField"
                v-model="logInForm.password"
                type="password"
                placeholder="Password"
                @keyup.enter.native="onEnter"
                show-password />
            </el-form-item>
            <el-form-item>
              <bf-button
                class="log-in-dialog__container--button"
                :processing="isLoggingIn"
                processing-text="Signing In"
                @click="onFormSubmit('logInForm')"
                >Sign in</bf-button
              >
            </el-form-item>
          </el-form>
          <div class="option-divider">  - or - </div>
          <bf-button
            class="log-in-dialog__container--federated-login-button"
            :processing="isLoggingIn"
            processing-text="Signing In"
            @click="initiateFederatedLogin('ORCID')"
            ><img src="/src/assets/images/orcid_24x24.png" alt="iD" width="24" height="24" style="display: block; margin-left: 0; margin-right: 32px; width: 24px; height: 24px">Sign in with your ORCID iD</bf-button>
          <div class="log-in-dialog__container--actions" :class="actionsClass">
            <router-link
              tag="a"
              class="ml-16"
              :to="signupRoute"
            >
              Create new account
            </router-link>
            |
            <a class="mr-16" href="#" @click.prevent="toForgotPasswordState">Forgot password?</a>
          </div>
        </template>
        <template v-else-if="isForgotPasswordState">
          <el-form
            ref="forgotPasswordForm"
            :model="forgotPasswordForm"
            :rules="forgotPasswordRules"
            :validate-on-rule-change="false"
            @submit.native.prevent="onFormSubmit('forgotPasswordForm')"
          >
            <el-form-item prop="email">
              <el-input
                ref="forgotPasswordEmailInput"
                v-model="forgotPasswordForm.email"
                placeholder="Email Address"
                @enter="onFormSubmit('forgotPasswordForm')"
              />
            </el-form-item>
            <el-form-item>
              <bf-button
                class="log-in-dialog__container--button"
                :processing="isSendingResetEmail"
                processing-text="Sending Email"
                @click="onFormSubmit('forgotPasswordForm')"
              >
                Reset password
              </bf-button>
            </el-form-item>
          </el-form>
          <a
            class="log-in-dialog__container--actions"
            :class="actionsClass"
            href="#"
            @click.prevent="toLogInState"
          >

            <IconArrowDown
                width=20
            />Back
            to Sign In</a
          >
        </template>
        <template v-else>
          <bf-button
            class="log-in-dialog__container--back-button"
            @click="toLogInState"
          >
            Back to Sign In
          </bf-button>
          <a
            class="log-in-dialog__container--actions"
            :class="actionsClass"
            href="https://docs.pennsieve.io/"
            target="_blank"
            >Need Help?</a
          >
        </template>
        <p class="log-in-dialog__container--footer">
          By signing in to Pennsieve, you accept our
          <a
            class="grey-link"
            href="https://docs.pennsieve.io/page/pennsieve-terms-of-use"
            target="_blank"
            >Terms of Use</a
          >
          and
          <a
            class="grey-link"
            href="https://docs.pennsieve.io/page/privacy-policy"
            target="_blank"
            >Privacy Policy</a
          >.
        </p>
      </template>
      <!-- two factor form -->
      <el-form
        v-if="logInState === states.TWO_FACTOR"
        ref="twoFactorForm"
        class="two-factor-form"
        :model="twoFactorForm"
        :rules="twoFactorRules"
        @submit.native.prevent="onTwoFactorFormSubmit"
      >
        <el-form-item prop="token" :inline-message="true">
          <el-input
            ref="twoFactor"
            v-model="twoFactorForm.token"
            placeholder="Two-factor token"
            autofocus
            @key.enter="onTwoFactorFormSubmit"
          />
        </el-form-item>
        <el-form-item class="log-in-dialog__container--footer">
          <bf-button
            :processing="isLoadingTwoFactor"
            processing-text="Submitting"
            @click="onTwoFactorFormSubmit"
          >
            Submit
          </bf-button>
          <a href="#" class="grey-link ml-8" @click.prevent="toLogInState">
            Cancel
          </a>
        </el-form-item>
      </el-form>
    </div>
  </el-dialog>
</template>

<script>
import { mapActions } from 'vuex'
import { propOr, pathOr } from 'ramda'
// import {Auth} from 'aws-amplify'
import BfButton from '../bf-button/BfButton.vue'
import EventBus from '../../../utils/event-bus'
import IconRemove from "../../icons/IconRemove.vue"
import IconArrowDown from "../../icons/IconArrowDown.vue"
import PennsieveLogoContainer from "../PennsieveLogoContainer/PennsieveLogoContainer.vue";


export default {
  name: 'PsLogInDialog',

  components: {
    PennsieveLogoContainer,
    BfButton,
    IconRemove,
    IconArrowDown
  },

  props: {
    visible: {
      type: Boolean,
      default: false
    },
    isMobile: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      dialogVisible: false,
      logInForm: {
        email: '',
        password: ''
      },
      forgotPasswordForm: {
        email: ''
      },
      logInState: '',
      states: {
        LOG_IN: 'logIn',
        FORGOT_PASSWORD: 'forgotPassword',
        RESET_PASSWORD: 'resetPassword',
        TWO_FACTOR: 'twoFactor'
      },
      logInRules: {
        email: [
          {
            required: true,
            message: 'Please add your Email',
            trigger: 'submit'
          }
        ],
        password: [
          {
            required: true,
            message: 'Please add your Password',
            trigger: 'submit'
          }
        ]
      },
      twoFactorForm: {
        token: ''
      },
      twoFactorRules: {
        token: [
          {
            required: true,
            message: 'Please add your Token',
            trigger: 'submit'
          }
        ]
      },
      isLoadingTwoFactor: false,
      tempSessionToken: '',
      isLoggingIn: false,
      isSendingResetEmail: false
    }
  },

  computed: {
    /**
     * Compute what route the logo should
     * take the user based on their organization
     * @returns {Object}
     */
    signupRoute: function() {
      let routeName = 'create-account'

      return {
        name: routeName, params: {}
      }
    },
    /**
     * True if user is on login dialog
     * @returns {Boolean}
     */
    isLogInState() {
      return this.logInState === this.states.LOG_IN
    },

    /**
     * True if user is on forgot password dialog
     * @returns {Boolean}
     */
    isForgotPasswordState() {
      return this.logInState === this.states.FORGOT_PASSWORD
    },

    /**
     * True if user is on reset password dialog
     * @returns {Boolean}
     */
    isResetPasswordState() {
      return this.logInState === this.states.RESET_PASSWORD
    },

    /**
     * Conditional modal width for mobile
     * @returns {String}
     */
    dialogWidth() {
      return this.isMobile ? '327px' : '374px'
    },

    /**
     * Conditional modal height to account for
     * different dialog heights
     * @returns {String}
     */
    containerClass() {
      return this.isForgotPasswordState || this.isResetPasswordState
        ? 'password-reset-height'
        : 'log-in-height'
    },

    /**
     * Conditional container bottom margin
     * for actions below dialog forms
     * @returns {String}
     */
    actionsClass() {
      return this.isResetPasswordState
        ? 'reset-password'
        : this.isForgotPasswordState
        ? 'forgot-password'
        : 'log-in'
    },

    /**
     * Copy at the top of the three different
     * dialog dialogs
     * @returns {String}
     */
    formTopCopy() {
      if (this.isForgotPasswordState) {
        return "We'll email you a link to reset your password."
      } else if (this.isResetPasswordState) {
        return "We've sent an email that contains a link to reset your password. Contact support if you have any issues or don't receive an email."
      } else {
        return 'Sign in with your email'
      }
    },

    /**
     * User api url
     * @returns {String}
     */
    userUrl() {
      return `${process.env.api_host}/user`
    },

    twoFactorUrl() {
      return `${process.env.api_host}/account/login/twofactor?api_key=${this.tempSessionToken}`
    },

    /**
     * Rules for forgot password form
     * @returns {Object}
     */
    forgotPasswordRules() {
      return { email: this.logInRules.email }
    }
  },

  beforeMount() {
    // Start on login dialog
    this.toLogInState()
  },

  methods: {
    ...mapActions(['updateProfile']),

    onEnter(event) {
      if (event.currentTarget === this.$refs.pwdField.ref) {
        this.onFormSubmit('logInForm')
      } else {
        this.$refs.pwdField.focus()
      }

    },
    /**
     * Reset all values and validation for
     * login form
     */
    resetLogInForm() {
      this.$refs.logInForm.clearValidate('email')
      this.$refs.logInForm.clearValidate('password')
      this.logInForm.email = ''
      this.logInForm.password = ''

      this.twoFactorForm.token = ''
      this.isLoadingTwoFactor = false
    },

    /**
     * Reset all values and validation for
     * forgot password form
     */
    resetForgotPasswordForm() {
      this.$refs.forgotPasswordForm.clearValidate('email')
      this.forgotPasswordForm.email = ''
    },

    /**
     * Reset all values and validation for
     * two factor form
     */
    resetTwoFactorForm() {
      this.$refs.twoFactorForm.clearValidate('token')
      this.twoFactorForm.token = ''
    },

    /**
     * Close login modal, clear current form and
     * return to login dialog before closings
     */
    closeLogInDialog() {
      if (this.isLogInState) {
        this.resetLogInForm()
      } else if (this.isForgotPasswordState) {
        this.resetForgotPasswordForm()
      }
      if (!this.isLogInState) {
        this.toLogInState()
      }
      this.$emit('close-log-in-dialog')
    },

    /**
     * Send user to login dialog
     */
    toLogInState() {
      if (this.isForgotPasswordState) {
        this.resetForgotPasswordForm()
      }
      if (this.logInState === this.states.TWO_FACTOR) {
        this.resetTwoFactorForm()
      }
      this.logInState = this.states.LOG_IN
    },

    /**
     * Send user to forgot password dialog
     */
    toForgotPasswordState() {
      if (this.isLogInState) {
        this.resetLogInForm()
      }
      this.logInState = this.states.FORGOT_PASSWORD
      this.$nextTick(() => this.$refs.forgotPasswordEmailInput.focus())
    },

    /**
     * Send user to reset password confirmation
     * dialog
     */
    toResetPasswordState() {
      if (this.isForgotPasswordState) {
        this.resetForgotPasswordForm()
      }
      this.logInState = this.states.RESET_PASSWORD
    },

    /**
     * Validate form and submit if valid
     * @param {String} e
     */
    onFormSubmit(e) {
      this.$refs[e].validate((valid) => {
        if (!valid) {
          return
        }
        if (this.isLogInState) {
          this.sendLoginRequest()
        } else {
          this.sendResetPasswordEmailRequest()
        }
      })
    },

    /**
     * Handle login request after validation
     */
    async sendLoginRequest() {

      // this.isLoggingIn = true
      // try {
      //   const user = await Auth.signIn(
      //     this.logInForm.email,
      //     this.logInForm.password
      //   )
      //   // this.handleLoginSuccess(user)
      //   EventBus.$emit('toast', {
      //     detail: {
      //       type: 'info',
      //       msg: `Login successful. Loading Workspace, please wait.`,
      //       duration: 5000
      //     }
      //   })
      //   this.$emit('succesfulLogin', user)
      //   this.closeLogInDialog()
      // } catch (error) {
      //   EventBus.$emit('toast', {
      //     detail: {
      //       type: 'error',
      //       msg: `Incorrect username or password. Please try again.`
      //     }
      //   })
      //   this.logInForm.password = ''
      // }
      // this.isLoggingIn = false
    },

    async initiateFederatedLogin(provider) {
      // this.isLoggingIn = true
      // this.closeLogInDialog()
      // try {
      //   const cred = await Auth.federatedSignIn({customProvider: provider})
      // } catch (error) {
      //   this.isLoggingIn = false
      //   EventBus.$emit('toast', {
      //     detail: {
      //       type: 'error',
      //       msg: `There was an error with your federated login attempt. Please try again.`
      //     }
      //   })
      // }
    },

    /**
     * Log the user in and set the state
     * @param {String} token
     * @param {Object} profile
     */
    setLogin(token) {
      // this.$cookies.set('user_token', token)

      // this.updateUserToken(token)
      const url = `${this.userUrl}` + `?api_key=${token}`
      this.$axios.$get(url).then((response) => {
        this.updateProfile(response)
      })
      this.closeLogInDialog()
    },

    /**
     * Handle password reset request after validation
     */
    sendResetPasswordEmailRequest() {
      // this.isSendingResetEmail = true
      // Auth.forgotPassword(this.forgotPasswordForm.email)
      //   .then(this.toResetPasswordState())
      //   .catch(() => {
      //     EventBus.$emit('toast', {
      //       detail: {
      //         msg: `There was an error sending a password reset request. Please try again.`
      //       }
      //     })
      //   })
      //   .finally(() => {
      //     this.isSendingResetEmail = false
      //   })
    },

    /**
     * Generate password reset url based on email param
     * @param {String} email
     */
    generateResetPasswordEmailUrl(email) {
      return `${process.env.api_host}/account/${email}/reset`
    },

    /**
     * Handles submit event for Two Factor form
     */
    onTwoFactorFormSubmit() {
      this.$refs.twoFactorForm.validate((valid) => {
        if (!valid) {
          return
        }
        this.sendTwoFactorRequest()
      })
    },

    /**
     * Makes XHR call to login
     */
    sendTwoFactorRequest() {
      this.isLoadingTwoFactor = true

      this.$axios
        .$post(this.twoFactorUrl, {
          token: this.twoFactorForm.token
        })
        .then(this.handleTwoFactorSuccess.bind(this))
        .catch(this.handleTwoFactorError.bind(this))
    },

    /**
     * Handles successful login response
     * @param {Object} response
     */
    handleTwoFactorSuccess(response) {
      this.setLogin(response.sessionToken, response.profile)
    },

    /**
     * Handles failed login response
     * @param {Object} response
     */
    handleTwoFactorError(response) {
      this.isLoadingTwoFactor = false
      this.$refs.twoFactor.focus()

      EventBus.$emit('toast', {
        detail: {
          type: 'ERROR',
          msg: `Two Factor validation failed: Token is invalid`
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../../../assets/_variables.scss';


.dialog-container {
  margin-bottom: 40px;
}
.log-in-dialog {
  //width: 540px;
  &__close-dialog {
    float: right;
  }
  &__container {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    width: 100%;
    word-break: normal;

    a {
      line-height: 18px;
      font-size: 14px;
    }

    &--logo {
      padding: 20px 0 30px 0;
      display: block;
      height: 35px;
      width: 198px;
    }

    &--top-copy {
      margin-bottom: 16px;
      line-height: 22px;
      align-self: flex-start;
      margin-left: 8px;
    }

    &--button,
    &--back-button {
      width: 298px;
    }

    &--back-button {
      margin-bottom: 16px;
    }

    &--federated-login-button {
      height: 36px;
      width: 298px;
      color: black;
      background-color: whitesmoke;
      border-color: darkgray;
      justify-content: flex-start;

    }
 &--federated-login-button:hover{
    color:white;
 }
    &--actions {
      &.log-in {
        margin-top: 32px;
        margin-bottom: 32px;
        @media (max-width: 48em) {
          margin-bottom: 22px;
        }
      }
      &.forgot-password {
        margin-bottom: 56px;
        @media (max-width: 48em) {
          margin-bottom: 46px;
        }
      }
      &.reset-password {
        margin-bottom: 70px;
        @media (max-width: 48em) {
          margin-bottom: 60px;
        }
      }
    }

    &--footer {
      color: $purple_1;
      line-height: 18px;
      font-size: 14px;
    }
  }

  .el-input {
    width: 100%;
  }

  .el-form-item {
    margin-bottom: 16px;
  }
}



//
//:deep(.el-dialog log-in-dialog ) {
//
//}

.option-divider {
  margin-bottom: 16px;
  color: $gray_5;
}

.password-reset-height {
  height: 355px;
}

.two-factor-form {
  text-align: left;
  width: 100%;
}
</style>
<style lang="scss">
@import '../../../assets/_variables.scss';
.ps-login-dialog .el-dialog__close{
    color:$purple_3!important;
    }
</style>
