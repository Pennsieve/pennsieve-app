<template>
  <div class="wrapper">
    <div
      v-if="!isUserSignInFailed && !isUserPasswordUpdated"
      class="login-wrap"
    >
      <h2 class="sharp-sans">
        Thank you for verifying your email and activating your account!
      </h2>
      <p>
        After setting a password, you can login the platform with your email and
        password.
      </p>
      <el-form
        id="profile-form"
        ref="profileForm"
        :model="profileForm"
        :rules="profileRules"
        label-position="top"
        status-icon
        @submit.native.prevent="onFormSubmit"
      >
        <el-form-item label="Password" prop="password" class="password-valid">
          <el-input
            v-model="profileForm.password"
            type="password"
            @enter="onFormSubmit"
            show-password
          />
          <transition name="el-zoom-in-top">
            <div v-if="isPasswordFormValid" class="pw-is-valid-text">
              Strong Password!
            </div>
          </transition>
        </el-form-item>

        <el-form-item label="Retype Your Password" prop="passwordConfirm">
          <el-input
            v-model="profileForm.passwordConfirm"
            type="password"
            required
            show-password
          />
        </el-form-item>
        <!--        <div class="helper">-->
        <!--          We recommend that you create a password that is more than 8 characters long and contains a combination of uppercase & lowercase characters, numbers and symbols.-->
        <!--        </div>-->
        <el-form-item>
          <bf-button
            class="saveProfile"
            :processing="isSavingProfile"
            processing-text="Setting password"
            @click="onFormSubmit"
          >
            Set Password
          </bf-button>
        </el-form-item>
      </el-form>
      <p class="agreement">
        By clicking “Set Password” you are agreeing to the Pennsieve
        <a
          href="https://docs.pennsieve.io/page/pennsieve-terms-of-use"
          target="_blank"
        >
          Terms of Use
        </a>
        and
        <a href="https://docs.pennsieve.io/page/privacy-policy" target="_blank">
          Privacy Policy </a
        >.
      </p>
    </div>
    <div v-if="isUserPasswordUpdated" class="login-wrap">
      <h2 class="sharp-sans">Account creation completed.</h2>
      <p>
        You successfully created your Pennsieve account. You can now log in with
        your email and password.
      </p>
      <p>
        We hope you will be able to use the platform to manage your scientific
        data and publish your datasets to the public domain when you are ready!
      </p>
      <p>
        Please feel free to reach out to our support team if you have any
        questions or suggestions on how to improve the platform. You can leave
        us messages directly from within the app.
      </p>
      <div class="user-already-created-wrap">
        <router-link class="btn-back-to-sign-in" :to="{ name: 'home' }">
          <bf-button> Return to Login Page </bf-button>
        </router-link>
      </div>
    </div>

    <div v-if="isUserSignInFailed" class="login-wrap">
      <h2 class="sharp-sans">
        {{ titleMessage }}
      </h2>
      <p>
        We were unable to set up a new profile. If you already have set up your
        profile and forgot your password, please go back to sign-in and select
        "Forgot Password" to reset your password.
      </p>
      <div class="user-already-created-wrap">
        <router-link class="btn-back-to-sign-in" :to="{ name: 'home' }">
          <bf-button> Back to Sign In </bf-button>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex";
import { propOr } from "ramda";
import {
  AuthError,
  confirmSignIn,
  signIn,
  updatePassword,
} from "aws-amplify/auth";

import * as siteConfig from "@/site-config/site.json";

import BfButton from "@/components/shared/bf-button/BfButton.vue";
import PasswordValidator from "@/mixins/password-validator";

import EventBus from "@/utils/event-bus";
import Request from "@/mixins/request";

export default {
  name: "VerifyAccount",

  components: {
    BfButton,
  },

  mixins: [PasswordValidator, Request],

  data() {
    const validatePasswordCheck = (rule, value, callback) => {
      if (this.profileForm.password !== value) {
        return callback(new Error("Passwords do not match"));
      }
      callback();
    };

    const validatePassword = (rule, value, callback) => {
      if (value === "") {
        this.isPasswordFormValid = false;
        return callback(new Error("Please input the password"));
      }

      const { isValid, feedback } = this.validatePassword(value);

      if (!isValid) {
        this.isPasswordFormValid = false;
        callback(new Error(feedback));
      } else {
        this.isPasswordFormValid = true;
        callback();
      }
    };
    return {
      showMatchError: false,
      profileForm: {
        password: "",
        passwordConfirm: "",
      },
      profileRules: {
        password: [
          { required: true, validator: validatePassword, trigger: "change" },
        ],
        passwordConfirm: [
          {
            required: true,
            validator: validatePasswordCheck,
            trigger: "submit",
          },
        ],
      },
      isSavingProfile: false,
      isPasswordFormValid: false,
      user: {},
      isUserSignInFailed: false,
      isUserPasswordUpdated: false,
    };
  },

  computed: {
    ...mapState(["config", "activeOrganization"]),

    titleMessage: function () {
      return this.isUserSignInFailed
        ? "Unable to set up profile."
        : "Let's set up your profile.";
    },

    /**
     * Compute API url to createUser on initial setup
     */
    createUserUrl: function () {
      const apiUrl = propOr("", "apiUrl", this.config);
      return `${apiUrl}/account/`;
    },

    /**
     * Compute the organization ID from the URL
     * @returns {String}
     */
    activeOrganizationId: function () {
      return this.$route.params.orgId;
    },

    /**
     * Get token for profile setup
     */
    verifyAccountToken: function () {
      return this.$route.query.token;
    },
  },

  methods: {
    /**
     * Submit the form to create the user
     * @param {Object} evt
     */
    onFormSubmit: function (evt) {
      // logic goes here
      evt.preventDefault();

      this.$refs.profileForm.validate(
        function (valid) {
          if (!valid) {
            return;
          }

          // Check if the passwords match
          if (this.profileForm.password !== this.profileForm.passwordConfirm) {
            return;
          }

          this.isSavingProfile = true;
          this.initialLogin();
        }.bind(this)
      );
    },

    /**
     * Initial login
     */
    async initialLogin() {
      try {
        this.user = await signIn({
          username: this.$route.params.username,
          password: this.$route.params.password,
          options: {
            authFlowType: siteConfig.awsConfig.authenticationFlowType,
          },
        })
          .then(() => {
            confirmSignIn({
              challengeResponse: this.profileForm.password,
            }).then(() => {
              this.isUserPasswordUpdated = true;
            });
          })
          .catch((err) => {
            console.log(err);
          });
      } catch (error) {
        this.isSavingProfile = false;
        this.isUserSignInFailed = true;
      }
    },

    /**
     * API Request to create a new user
     */
    async verifyAccount() {
      try {
        const passwordOld = this.$route.params.password;
        const passwordNew = this.profileForm.password;
        await updatePassword({
          oldPassword: passwordOld,
          newPassword: passwordNew,
        });
        this.isUserPasswordUpdated = true;
      } catch (error) {
        this.handleFailedUserCreation();
      }
    },

    /**
     * Handle successful API response to createUser
     * @param {Object} response
     * @param {String} jwt
     *
     */
    handleCreateUserSuccess: function (response, jwt) {
      this.isSavingProfile = false;
      let loginBody = {
        token: jwt,
        profile: response.profile,
        firstTimeSignOn: true,
      };

      const orgId = response.orgIds[0];
      const switchOrgUrl = `${this.config.apiUrl}/session/switch-organization?organization_id=${orgId}`;

      this.sendXhr(switchOrgUrl, {
        method: "PUT",
        header: {
          Authorization: `Bearer ${jwt}`,
        },
      })
        .then(() => {
          EventBus.$emit("login", loginBody);
        })
        .catch(this.handleFailedUserCreation.bind(this));
    },

    /**
     * Handle API response error to createUser
     * @param {Object} response
     */
    handleFailedUserCreation: function (response) {
      this.isSavingProfile = false;
      const msg =
        response.status === 400
          ? "Sorry, but your token has expired. Please request a new invitation."
          : "Could not create a user with that username and password. Try adding more letters, numbers and punctuation.";
      EventBus.$emit("toast", {
        detail: {
          type: "message",
          msg: msg,
        },
      });
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../assets/_variables.scss";

.wrapper {
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
    background: #ffffff;
    border: 1px solid #dadada;
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
      background: #fafafa;
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
  background: #fafafa;
  border-radius: 0 0 5px 5px;
  border: solid 1px #dadada;
  height: 15px;
  width: 93.5%;
  position: relative;
  z-index: 0;
  margin: 0;
}

.pw-recommendation-text {
  font-size: 13px;
  padding: 13px 10px;
  margin: 0;
}

.helper {
  color: #71747c;
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
  font-size: 20px;
  line-height: 24px;
  font-weight: 400;
  margin: 0 0 12px;
}

a {
  color: #71747c;
  text-decoration: underline;
}

.sharp-sans {
  color: #000;
  font: 700 24px/31px "SharpSans", sans-serif;
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
    text-decoration: none;
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
