<script setup>
import { ref, onBeforeMount } from "vue";
import { useRoute, useRouter } from "vue-router";
import * as config from "@/site-config/site.json";
import { confirmSignIn, fetchAuthSession, signIn, signOut } from "aws-amplify/auth";
import QrcodeVue from "qrcode.vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import AuthLayout from "@/components/shared/AuthLayout/AuthLayout.vue";
import { DEFAULT_LANDING_PATH, safeRedirectPath } from "@/utils/auth-redirect";

const route = useRoute();
const router = useRouter();

const states = {
  CHECKING: "checking",
  LOG_IN: "logIn",
  TOTP_CODE: "totpCode",
  TOTP_SETUP: "totpSetup",
};
const logInState = ref(states.CHECKING);

const errorMessage = ref("");

function landingPath() {
  return safeRedirectPath(route.query.redirectTo) || DEFAULT_LANDING_PATH;
}

onBeforeMount(async () => {
  try {
    const session = await fetchAuthSession();
    if (session?.tokens?.accessToken) {
      await router.replace(landingPath());
      return;
    }
  } catch (err) {
    console.warn("Session check failed:", err.message);
  }
  logInState.value = states.LOG_IN;
});

function toLogInState() {
  errorMessage.value = "";
  logInForm.value.password = "";
  mfaForm.value.token = "";
  totpSetupUri.value = "";
  logInState.value = states.LOG_IN;
}

// ==== LOGIN ====
const logInFormRef = ref(null);
const isLoggingIn = ref(false);

const logInForm = ref({
  email: "",
  password: "",
});

const logInRules = {
  email: [{ required: true, message: "Please add your Email", trigger: "submit" }],
  password: [{ required: true, message: "Please add your Password", trigger: "submit" }],
};

function onLogInSubmit() {
  if (isLoggingIn.value) {
    return;
  }
  logInFormRef.value.validate((valid) => {
    if (valid) {
      sendLoginRequest();
    }
  });
}

async function sendLoginRequest() {
  isLoggingIn.value = true;
  errorMessage.value = "";
  try {
    // Clears any stale tokens so Amplify doesn't reject the sign-in as already authenticated.
    await signOut();

    const result = await signIn({
      username: logInForm.value.email.trim(),
      password: logInForm.value.password,
      options: {
        authFlowType: config.awsConfig.authenticationFlowType,
      },
    });
    await handleNextStep(result);
  } catch (error) {
    errorMessage.value = error.message;
  }
  isLoggingIn.value = false;
}

async function handleNextStep(result) {
  const { signInStep } = result.nextStep;

  switch (signInStep) {
    case "DONE":
      await router.replace(landingPath());
      break;

    case "CONFIRM_SIGN_IN_WITH_TOTP_CODE":
      errorMessage.value = "";
      logInState.value = states.TOTP_CODE;
      break;

    case "CONTINUE_SIGN_IN_WITH_TOTP_SETUP":
      errorMessage.value = "";
      totpSetupUri.value = result.nextStep.totpSetupDetails.getSetupUri("Pennsieve").toString();
      totpSecret.value = result.nextStep.totpSetupDetails.sharedSecret;
      logInState.value = states.TOTP_SETUP;
      break;

    // Completing an invitation also creates the Pennsieve user record, which only
    // the setup-profile flow does, so the new password can't be set here.
    case "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED":
      await signOut();
      logInState.value = states.LOG_IN;
      errorMessage.value =
        "Your account setup isn't finished. Use the link in your invitation email to set up your profile.";
      break;

    case "RESET_PASSWORD":
      await router.push({ name: "password" });
      break;

    default:
      console.warn("Unsupported sign-in step:", signInStep);
      await signOut();
      logInState.value = states.LOG_IN;
      errorMessage.value =
        "We couldn't complete sign in for this account. Please contact support.";
  }
}

// ==== MFA ====
const mfaFormRef = ref(null);
const isValidating = ref(false);
const totpSetupUri = ref("");
const totpSecret = ref("");

const mfaForm = ref({
  token: "",
});

const mfaRules = {
  token: [{ required: true, message: "Please provide a validation code", trigger: "submit" }],
};

function onMfaSubmit() {
  if (isValidating.value) {
    return;
  }
  mfaFormRef.value.validate(async (valid) => {
    if (!valid) {
      return;
    }
    isValidating.value = true;
    errorMessage.value = "";
    try {
      const result = await confirmSignIn({
        challengeResponse: mfaForm.value.token.trim(),
      });
      await handleNextStep(result);
    } catch (error) {
      errorMessage.value = error.message;
    }
    isValidating.value = false;
  });
}
</script>

<template>
  <AuthLayout v-if="logInState !== states.CHECKING">
    <div v-if="errorMessage" class="auth-error" role="alert">
      {{ errorMessage }}
    </div>

    <div v-if="logInState === states.LOG_IN" class="auth-content">
      <el-form
        ref="logInFormRef"
        :model="logInForm"
        :rules="logInRules"
        class="auth-form"
        label-position="top"
        hide-required-asterisk
        :validate-on-rule-change="false"
        @submit.prevent="onLogInSubmit"
      >
        <el-form-item label="Email" prop="email">
          <el-input
            v-model="logInForm.email"
            type="email"
            autocomplete="username"
            autofocus
          />
        </el-form-item>
        <el-form-item label="Password" prop="password">
          <el-input
            v-model="logInForm.password"
            type="password"
            autocomplete="current-password"
            show-password
          />
        </el-form-item>
        <bf-button
          class="auth-full-width"
          type="submit"
          :processing="isLoggingIn"
          processing-text="Signing In"
        >
          Sign in
        </bf-button>
      </el-form>

      <router-link class="auth-secondary-link" :to="{ name: 'password' }">Forgot password?</router-link>
    </div>

    <div v-if="logInState === states.TOTP_SETUP" class="auth-content">
      <p class="auth-info">
        Your account requires multi-factor authentication. Scan this code with an
        authenticator app, then enter the code it generates.
      </p>

      <div class="qr-code">
        <qrcode-vue :value="totpSetupUri" :size="160" level="M" />
      </div>
      <p class="secret">
        Can't scan it? Enter this key instead:
        <code>{{ totpSecret }}</code>
      </p>
    </div>

    <div
      v-if="logInState === states.TOTP_CODE || logInState === states.TOTP_SETUP"
      class="auth-content"
    >
      <p v-if="logInState === states.TOTP_CODE" class="auth-info">
        Enter the code generated by your authenticator app.
      </p>

      <el-form
        ref="mfaFormRef"
        :model="mfaForm"
        :rules="mfaRules"
        class="auth-form"
        label-position="top"
        hide-required-asterisk
        :validate-on-rule-change="false"
        @submit.prevent="onMfaSubmit"
      >
        <el-form-item label="Authentication code" prop="token">
          <el-input
            v-model="mfaForm.token"
            autocomplete="one-time-code"
            inputmode="numeric"
            autofocus
          />
        </el-form-item>
        <bf-button
          class="auth-full-width"
          type="submit"
          :processing="isValidating"
          processing-text="Validating"
        >
          {{ logInState === states.TOTP_SETUP ? "Verify and sign in" : "Validate" }}
        </bf-button>
      </el-form>

      <a href="#" class="auth-secondary-link" @click.prevent="toLogInState">Back to Sign In</a>
    </div>

    <template #below>
      <p v-if="logInState === states.LOG_IN" class="auth-below">
        Looking for Pennsieve?
        <a href="https://app.pennsieve.io">Go to app.pennsieve.io</a>
      </p>
      <p class="auth-below">
        By signing in to Pennsieve, you accept our
        <a href="https://docs.pennsieve.io/page/pennsieve-terms-of-use" target="_blank">Terms of Use</a>
        and
        <a href="https://docs.pennsieve.io/page/privacy-policy" target="_blank">Privacy Policy</a>.
      </p>
    </template>
  </AuthLayout>
</template>

<style scoped lang="scss">
.qr-code {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.secret {
  margin: 16px 0 0 0;
  font-weight: 300;
  word-break: break-all;

  code {
    display: block;
    margin-top: 8px;
  }
}
</style>
