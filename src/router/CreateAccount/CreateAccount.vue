<template>
  <div class="create-account">
    <div class="create-account-wrapper">
      <div class="create-account-inner">
        <div v-if="!accountCreated">
          <h2 class="sharp-sans">Create Your Account</h2>
          <p>
            Welcome to Pennsieve! Complete the following form so that we can
            register your account.
            <strong>All fields are required</strong>
            .
          </p>
          <el-form
            id="signup-form"
            ref="signupForm"
            :model="signupForm"
            :rules="signupRules"
            status-icon
            @submit.native.prevent="onFormSubmit"
            @keyup.enter.native="onFormSubmit"
          >
            <el-form-item label="First Name" prop="firstName">
              <el-input
                v-model="signupForm.firstName"
                required
                class="first-name-input"
                autofocus
              />
            </el-form-item>
            <el-form-item label="Last Name" prop="lastName">
              <el-input v-model="signupForm.lastName" required />
            </el-form-item>
            <el-form-item label="Email" prop="email">
              <el-input v-model="signupForm.email" required />
            </el-form-item>
            <div class="mb-32 mt-32">
              <el-form-item class="button-wrap">
                <bf-button class="secondary" @click="onFormCancel">
                  Cancel
                </bf-button>
                <bf-button
                  :processing="isCreatingAccount"
                  processing-text="Submitting"
                  @click="onFormSubmit"
                >
                  Create Account
                </bf-button>
              </el-form-item>
            </div>
          </el-form>
          <p v-if="hasError" class="error-copy">
            Sorry, an error has occurred.
            <br />
            Please try again or
            <a target="_blank" @click="openContactUsDialog">contact support</a>
            .
          </p>
          <p v-if="hasConflict" class="error-copy conflict">
            This email is already associated with a Pennsieve Account. Please Sign in
            <router-link to="/?redirectTo=">here</router-link>
          </p>
          <p class="agreement">
            By clicking “Create Account" you are agreeing to the Pennsieve
            <a
              href="https://docs.pennsieve.io/page/pennsieve-terms-of-use"
              target="_blank"
            >
              Terms of Use
            </a>
            and
            <a
              href="https://docs.pennsieve.io/page/privacy-policy"
              target="_blank"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
        <div v-else>
          <h2 class="sharp-sans">Thank You</h2>
          <p>
            Thank you for registering an account. An email should have been sent
            to create your password.
          </p>
          <router-link :to="{ name: 'home' }">Back to login</router-link>
        </div>
      </div>
    </div>
    <contact-us-dialog />
  </div>
</template>

<script>
import { mapState } from "vuex";

import BfButton from "@/components/shared/bf-button/BfButton.vue";
import Request from "@/mixins/request";
import EventBus from "../../utils/event-bus";

export default {
  name: "CreateAccount",

  components: {
    BfButton,
  },

  mixins: [Request],

  mounted: async function() {
    await this.$recaptchaLoaded()
    this.$recaptchaInstance.value.showBadge()
  },
  unmounted() {
    this.$recaptchaInstance.value.hideBadge()
  },

  data() {
    return {
      isCreatingAccount: false,
      accountCreated: false,
      signupForm: {
        firstName: "",
        lastName: "",
        email: "",
        title: "",
      },
      signupRules: {
        firstName: [
          {
            required: true,
            message: "Please enter your first name",
            trigger: "submit",
          },
        ],
        lastName: [
          {
            required: true,
            message: "Please enter your last name",
            trigger: "submit",
          },
        ],
        email: [
          {
            required: true,
            message: "Please enter your email",
            trigger: "submit",
            type: "email",
          },
        ],
      },
      hasError: false,
      hasConflict: false,
    };
  },

  computed: {
    ...mapState(["config"]),
  },


  methods: {
    /**
     * Take the user back home
     */
    onFormCancel: function () {
      this.$router.push({ name: "home" });
    },

    /**
     * Validate the form, and if valid
     * send request to the endpoint
     */
    onFormSubmit: function () {
      this.$refs.signupForm.validate((valid) => {
        if (!valid) {
          return;
        }
        this.createAccount();
      });
    },

    /**
     * Send request to endpoint to create the
     * user's account
     */
    createAccount: async function () {
      this.isCreatingAccount = true;
      this.hasError = false;
      this.hasConflict = false;

      try {
        const recaptchaToken = await this.$recaptcha();

        await this.sendXhr(`${this.config.apiUrl}/account/sign-up`, {
          method: "POST",
          body: {
            ...this.signupForm,
            recaptchaToken,
          },
        });

        this.accountCreated = true;
        this.isCreatingAccount = false;
      } catch (error) {
        if(error.status === 409) {
          this.hasConflict = true
        } else {
          this.hasError = true;
        }
        this.isCreatingAccount = false;
      }
    },
    /**
     * Display Contact us dialog
     */
    openContactUsDialog() {
      EventBus.$emit("isContactUsDialogOpen", true);
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../../assets/_variables.scss";

.create-account {
  background: $purple_1;
  display: block;

  .create-account-wrapper {
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

  .create-account-inner {
    background: $white;
    box-sizing: border-box;
    color: $gray_4;
    max-width: 720px;
    width: 360px;
  }
  
  a {
    cursor: pointer;
  }
}

:deep(.el-form-item__label) {
  margin-bottom: -10px;
  align-self: flex-start;
}

p {
  margin: 10px 0 28px;
}

.sharp-sans {
  color: #000;
  font: 700 24px/31px "SharpSans", sans-serif;
  display: flex;
}

h2 {
  font-size: 20px;
  line-height: 24px;
  font-weight: 400;
  margin: 0 0 12px;
}

.bf-button {
  width: 48.8%;
  &:first-child {
    margin-right: 8px;
  }
}

.el-form-item {
  display: flex;
  flex-direction: column;
  align-content: flex-start;
}
.error-copy {
  color: $error-color;
  &.conflict {
    color: $success-color;
  }
}
</style>
