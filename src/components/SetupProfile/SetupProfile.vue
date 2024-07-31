<template>
  <div class="wrapper">
    <PennsieveLogoContainer class="logo-container"/>

    <div
      v-if="!hideSignInForm"
      class="login-wrap"
    >
      <h2 class="sharp-sans">
        Let's set up your profile.
      </h2>
      <p>Complete your profile so members of your team can easily identify you. <strong>All fields are required</strong>.</p>
      <el-form
        id="profile-form"
        ref="profileForm"
        label-position="top"
        :model="profileForm"
        :rules="profileRules"
        status-icon
        @submit.native.prevent="onFormSubmit"
      >
        <el-form-item
          label="First Name"
          prop="firstName"
        >
          <el-input
            v-model="profileForm.firstName"
            required
            class="first-name-input"
            autofocus
          />
        </el-form-item>
        <el-form-item
          label="Last Name"
          prop="lastName"
        >
          <el-input
            v-model="profileForm.lastName"
            required
          />
        </el-form-item>
        <el-form-item
          label="Job Title"
          prop="jobTitle"
        >
          <el-input
            v-model="profileForm.jobTitle"
            required
          />
        </el-form-item>
        <el-form-item
          label="Password"
          prop="password"
          class="password-valid"
        >
          <el-input
            v-model="profileForm.password"
            type="password"
            @enter="onFormSubmit"
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
        <div class="helper">
          We recommend that you create a password that is more than 8 characters long and contains a combination of uppercase & lowercase characters, numbers and symbols.
        </div>

        <el-form-item
          label="Retype Your Password"
          prop="passwordConfirm"
        >
          <el-input
            v-model="profileForm.passwordConfirm"
            type="password"
            required
            show-password
          />
        </el-form-item>
        <el-form-item>
          <bf-button
            class="saveProfile"
            :processing="isSavingProfile"
            processing-text="Logging In"
            @click="onFormSubmit"
          >
            Save Profile
          </bf-button>
        </el-form-item>
      </el-form>
      <p class="agreement">
        By clicking “Save Profile” you are agreeing to the Pennsieve
        <a
          href="https://docs.pennsieve.io/page/pennsieve-terms-of-use"
          target="_blank"
        >
          Terms of Use
        </a> and
        <a
          href="https://docs.pennsieve.io/page/privacy-policy"
          target="_blank"
        >
          Privacy Policy
        </a>.
      </p>
    </div>
    <div
      v-if="isUserPasswordUpdated"
      class="login-wrap"
    >
      <h2 class="sharp-sans">
        Account creation completed.
      </h2>
      <p> You successfully created your Pennsieve account. You can now log in with your email and password.</p>
      <p> We hope you will be able to use the platform to manage your scientific data and publish your datasets to the public domain when you are ready! </p>
      <p> Please feel free to reach out to our support team if you have any questions or suggestions on how to improve the platform. You can leave us messages directly from within the app.</p>
      <div class="user-already-created-wrap">
        <router-link
          class="btn-back-to-sign-in"
          :to="{name: 'home' }"
        >
          <bf-button>
            Return to Login Page
          </bf-button>
        </router-link>
      </div>
    </div>
    <div
      v-if="isUserSignInFailed"
      class="login-wrap"
    >
      <h2 class="sharp-sans">
        {{titleMessage}}
      </h2>
      <p>We were unable to set up a new profile. If you already have set up your profile and forgot your password, please select “I forgot my password” to receive an email to reset your password.</p>
      <p>Please contact Pennsieve support otherwise.</p>
      <div class="user-already-created-wrap">
        <router-link
          class="btn-back-to-sign-in"
          :to="{name: 'home' }"
        >
          <bf-button>
            Back to Sign In
          </bf-button>
        </router-link>
        <a
          class="forgot-password"
          href="#"
          @click="onForgotPasswordClick"
        >
          I forgot my password
        </a>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { propOr } from 'ramda'
import {Auth} from '@aws-amplify/auth'

import BfButton from '../shared/bf-button/BfButton.vue'
import PasswordValidator from '../../mixins/password-validator'

import EventBus from '../../utils/event-bus'
import Request from '../../mixins/request'

export default {
  name: 'SetupProfile',

  components: {
    BfButton
  },

  mixins: [
    PasswordValidator,
    Request
  ],

  data() {
    const validatePasswordCheck = (rule, value, callback) => {
      if (this.profileForm.password !== value) {
        return callback(new Error('Passwords do not match'))
      }
      callback()
    }

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
      profileForm: {
        firstName: '',
        lastName: '',
        jobTitle: '',
        password: '',
        passwordConfirm: ''
      },
      profileRules: {
        firstName: [
          { required: true, message: 'Please enter your first name', trigger: 'submit' }
        ],
        lastName: [
          { required: true, message: 'Please enter your last name', trigger: 'submit' }
        ],
        jobTitle: [
          { required: true, message: 'Please enter your job title', trigger: 'submit' }
        ],
        password: [
          { required: true, validator: validatePassword, trigger: 'change' }
        ],
        passwordConfirm: [
          { required: true, validator: validatePasswordCheck, trigger: 'submit' }
        ]
      },
      isSavingProfile: false,
      isPasswordFormValid: false,
      isUserPasswordUpdated: false,
      hideSignInForm:false,
      user: {},
      isUserSignInFailed: false
    }
  },

  computed: {
    ...mapState([
      'config',
      'activeOrganization'
    ]),

    titleMessage: function() {
      return this.isUserSignInFailed ? "Unable to set up profile.": "Let's set up your profile."
    },
    /**
     * Compute API url to createUser on initial setup
     */
    createUserUrl: function() {
      const apiUrl = propOr('', 'apiUrl', this.config)
      return `${apiUrl}/account/`
    },

    /**
     * Compute the organization ID from the URL
     * @returns {String}
     */
    activeOrganizationId: function() {
      return this.$route.params.orgId
    },

    /**
     * Get token for profile setup
    */
    setupProfileToken: function() {
      return this.$route.query.token
    },
  },

  methods: {
    /**
     * Submit the form to create the user
     * @param {Object} evt
     */
    onFormSubmit: function(evt) {
      // logic goes here
      evt.preventDefault()

      this.$refs.profileForm.validate(function(valid) {
        if (!valid) {
          return
        }
        this.isSavingProfile = true
        this.initialLogin()
      }.bind(this))
    },

    /**
     * Initial login
     */
    async initialLogin() {
      try {
          this.user = await Auth.signIn(this.$route.params.username, this.$route.params.password)
         this.setupProfile()
        } catch (error) {
          this.isSavingProfile = false
          this.isUserSignInFailed = true
          this.hideSignInForm = true
        }
    },
    /**
     * API Request to create a new user
     */
    async setupProfile() {
      try {
        const newUser = await Auth.completeNewPassword(
          this.user,
          this.profileForm.password,
          {
            email: this.$route.query.email
          }
        )

        this.createUser(newUser.signInUserSession.accessToken.jwtToken,this.$route.name)
      } catch (error) {
        if (this.$route.name === "complete-profile-accept") {
            this.isUserPasswordUpdated = true;
            this.hideSignInForm = true
            return;
          }else{
            this.handleFailedUserCreation(this)
          }
      }
    },

    /**
     * Create the user on Pennsieve
     * @param {String} jwt
     */
    async createUser(jwt, routeName) {
      try {
        let apiMethod = "POST"
        if (routeName === "complete-profile-accept") {
          apiMethod = "PUT"
        }

        const user = await this.sendXhr(this.createUserUrl, {
          method: apiMethod,
          header: {
            'Authorization': `bearer ${jwt}`
          },
          body: {
            lastName: this.profileForm.lastName,
            firstName: this.profileForm.firstName,
            title: this.profileForm.jobTitle,
          }
        })
        this.handleCreateUserSuccess(user, jwt)
      } catch (error) {
        this.handleFailedUserCreation(this)
      }
    },

    /**
     * Handle successful API response to createUser
     * @param {Object} response
     * @param {String} jwt
     *
     */
    handleCreateUserSuccess: function(response, jwt) {
      this.isSavingProfile = false
      let loginBody = {
        token: jwt,
        profile: response.profile,
        firstTimeSignOn: true
      }

      const orgId = response.orgIds[0]
      const switchOrgUrl = `${this.config.apiUrl}/session/switch-organization?organization_id=${orgId}`

      this.sendXhr(switchOrgUrl, {
        method: 'PUT',
        header: {
          'Authorization': `Bearer ${jwt}`
        }
      })
      .then(() => {
        EventBus.$emit('login', loginBody)
      })
      .catch(this.handleFailedUserCreation(this))
    },

    /**
     * Handle API response error to createUser
     * @param {Object} response
     */
    handleFailedUserCreation: function(response) {
      this.isSavingProfile = false
      const msg = response.status === 400 ?
        'Sorry, but your token has expired. Please request a new invitation.' :
        'Could not create a user with that username and password. Try adding more letters, numbers and punctuation.';
        EventBus.$emit('toast', {
          detail: {
            type: 'message',
            msg: msg
          }
        })

    },

    /**
     * Submit forgot password request and take user to the forgot password page
     */
    onForgotPasswordClick: function() {
      Auth.forgotPassword(this.$route.params.username)
        .then(() => {
          EventBus.$emit('toast', {
          detail: {
            type: 'info',
            msg: 'Reset password email sent'
          }
        })
        })
        .catch(error => {
          EventBus.$emit('toast', {
          detail: {
            type: 'error',
            msg: error.message
          }
        })
        })
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../assets/_variables.scss';

.wrapper {
  background: $white;
  box-sizing: border-box;
  color: $gray_4;
  max-width: 720px;
  min-height: 100vh;
  padding-bottom: 20px;
  padding-top: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;

  .logo-container {
    width: 300px;
    margin-bottom: 64px;
  }

  h2 {
    color: $purple_3;
  }
}

.login-wrap {
  width: 360px;
  flex: 1;
  flex-basis: 0.000000001px;

  p {
    margin: 10px 0 28px;
  }
}

form {
  margin-bottom: 30px;
}

.bf-button {
  padding: 9px 35px;
  border-radius: 5px;
  line-height: 20px;
  margin-top: 10px;
}

.el-input {
  .el-input__inner {
      display: flex;
      flex-direction: row;
      background: #FFFFFF;
      border: 1px solid #DADADA;
      border-radius: 5px;
      box-sizing: border-box;
      font-size: 14px;
      line-height: inherit;
      max-width: 100%;
      padding: 10px;
      position: relative;
      width: 100%;
    }
  }

  .el-form {
    .el-form-item__content {
      div {
        line-height: 20px;
      }

      .el-form-item__error {
        font-size: 13px;
        line-height: 1;
        padding: 13px 10px;
        background: #FAFAFA;
        border-radius: 0 0 5px 5px;
        border: solid 1px #dadada;
        height: 15px;
        width: 94%;
        position: absolute;
        z-index: 0;
        margin: 0;
      }
    }
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
  position: absolute;
  z-index: 0;
  margin: 0;
  top:3rem;
}


.pw-recommendation-text {
  font-size: 13px;
  padding: 13px 10px;
  margin: 0;
}

.helper {
  color: #71747C;
  font-size: 13px;
  margin-top: 51px;
  margin-bottom: 15px;
}

.form-item-wrap {
  color: #000;
  display: block;
  font-weight: 500;
  margin-bottom: 6px;
  pointer-events: none;
}

h2 {
  color: $purple_3;
  font-size: 20px;
  line-height: 24px;
  font-weight: 400;
  margin: 0 0 12px;
}

a {
  color: #71747C;
  text-decoration: underline;
}

.sharp-sans {
  color: #000;
  font: 700 24px/31px 'SharpSans', sans-serif;
  display: flex;
}

.agreement {
  font-size: 13px;
  margin: 0;
}
.btn-back-to-sign-in {
  text-decoration: none;
  .bf-button {
    margin-top: 0;
    text-decoration: none;;
  }
}
.user-already-created-wrap {
  align-items: center;
  display: flex;
  justify-content: space-between;
  .forgot-password {
    color: $app-primary-color;
    flex: 1;
    margin-left: 16px;
    text-align: center;
  }
}
</style>
