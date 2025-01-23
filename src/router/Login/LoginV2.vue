<script setup>
import { ref } from "vue";
import * as config from "@/site-config/site.json";
import { AuthError, signIn, signOut } from "aws-amplify/auth";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import router from "@/router";

//  ==== LOGIN ====
const logInForm = ref({
  email: "",
  password: "",
});

const logInRules = ref({
  email: [
    {
      required: true,
      message: "Please add your Email",
      trigger: "submit",
    },
  ],
  password: [
    {
      required: true,
      message: "Please add your Password",
      trigger: "submit",
    },
  ],
});

const isLoggingIn = ref(false);
const pwdFieldRef = ref(null);
const logInFormRef = ref(null);

/**
 * Validate form and submit if valid
 * @param {String} e
 */
function onFormSubmit(e) {
  logInFormRef.value.validate((valid) => {
    if (!valid) {
      return;
    }
    sendLoginRequest();
  });
}

/**
 * Handle login request after validation
 */
async function sendLoginRequest() {
  isLoggingIn.value = true;
  try {
    // Sign out user in case the user was already signed in.
    await signOut();

    // Now, sign in user
    const user = await signIn({
      username: logInForm.value.email,
      password: logInForm.value.password,
      options: {
        authFlowType: config.awsConfig.authenticationFlowType,
      },
    });
    handleLoginSuccess(user);
  } catch (error) {
    error instanceof AuthError &&
      console.log(error.name, error.message, error.recoverySuggestion);
  }
  isLoggingIn.value = false;
}

/**
 * Handle a successful login: set vuex state
 * and cookies, close login dialog
 */
async function handleLoginSuccess(user) {
  console.log("Logged IN");

  switch (user.nextStep.signInStep) {
    // ...
    case "CONTINUE_SIGN_IN_WITH_TOTP_SETUP":
      // Open setupUri with an authenticator APP to retrieve an OTP code
      break;
    // ...
    case "DONE":
      await router.push({ path: "/" });
      break;
  }
}

function onEnter(event) {
  if (event.currentTarget.__vue__ === pwdFieldRef.value) {
    onFormSubmit("logInForm");
  } else {
    pwdFieldRef.value.focus();
  }
}

async function onLogout() {
  await signOut();
  console.log("Signed out");
}
</script>

<template>
  <div>
    <el-form
      class="form"
      ref="logInFormRef"
      :model="logInForm"
      :rules="logInRules"
      :validate-on-rule-change="false"
      @submit.native.prevent="onFormSubmit('logInForm')"
    >
      <el-form-item prop="email">
        <el-input
          v-model="logInForm.email"
          placeholder="Email Address"
          @keyup.enter.native="onEnter"
        />
      </el-form-item>
      <el-form-item prop="password">
        <el-input
          ref="pwdFieldRef"
          v-model="logInForm.password"
          type="password"
          placeholder="Password"
          show-password
        />
      </el-form-item>
      <el-form-item>
        <bf-button
          class="log-in-dialog__container--button"
          processing-text="Signing In"
          @click="onFormSubmit('logInForm')"
          >Sign in</bf-button
        >
      </el-form-item>
    </el-form>

    <bf-button class="form" @click="onLogout"> Logout </bf-button>
  </div>
</template>

<style scoped lang="scss">
.form {
  margin: 16px;
}
</style>
