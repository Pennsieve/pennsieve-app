<script setup lang="ts">
import {
  updatePassword,
  type UpdatePasswordInput,
  setUpTOTP,
  verifyTOTPSetup,
  fetchMFAPreference,
  updateMFAPreference, getCurrentUser, fetchAuthSession,
} from 'aws-amplify/auth';


import type { FormInstance, FormRules } from 'element-plus'
import { reactive, ref } from 'vue'
import BfButton from "~/components/Shared/BfButton/BfButton.vue";
import QrcodeVue from 'qrcode.vue'
import type { Level, RenderAs, GradientType } from 'qrcode.vue'
import IconUpload from "~/components/Icons/IconUpload.vue";
import {pathOr} from "ramda";

const runtimeConfig = useRuntimeConfig()

const loginScope = ref('')
const loginProvider = ref('')
const loginProviders = {
  COGNITO: 'Pennsieve',
  ORCID: 'ORCID',
}

onMounted(async  () => {
  const authSession = await fetchAuthSession()
  loginScope.value = pathOr('', ['tokens','accessToken','payload','scope'], authSession)
  switch (loginScope.value){
    case 'aws.cognito.signin.user.admin':
      loginProvider.value = loginProviders.COGNITO
      break;
    case 'openid':
      loginProvider.value = loginProviders.ORCID
      break;
    default:
      loginProvider.value = ""
  }

  fetchMFAPreference()
    .then(prefs => {
      if (prefs.enabled.includes('TOTP')) {
        mfaState.value = mfaStates.ENABLED
      }
    })
})


async function handleUpdatePassword({
                                      oldPassword,
                                      newPassword
                                    }: UpdatePasswordInput) {
  try {
    await updatePassword({ oldPassword, newPassword });
    ElMessage({
      showClose: false,
      type: 'info',
      message: "Successfully updated your password",
    })
  } catch (err) {
    ElMessage({
      showClose: true,
      type: 'error',
      message: err,
      duration:0
    })
  }
}

const ruleFormRef = ref<FormInstance>()
const ruleForm = reactive({
  curPass: '',
  pass: '',
  checkPass: '',

})

const validatePassword = (rule: any, value: any, callback: any) => {

  if (value === '') {
    return callback(new Error('Please input the password'))
  }

  const { isValid, feedback } = useValidatePassword(value)

  if (!isValid) {
    callback(new Error(feedback))
  } else {
    callback()
  }
}

const validatePass2 = (rule: any, value: any, callback: any) => {
  if (value === '') {
    callback(new Error('Please input the password again'))
  } else if (value !== ruleForm.pass) {
    callback(new Error("Two inputs don't match!"))
  } else {
    callback()
  }
}

const rules = reactive<FormRules<typeof ruleForm>>({
  pass: [{ validator: validatePassword, trigger: 'blur' }],
  checkPass: [{ validator: validatePass2, trigger: 'blur' }],
})

const submitForm = (formEl: FormInstance | undefined) => {
  if (!formEl) return
  formEl.validate((valid) => {
    if (valid) {
      handleUpdatePassword({oldPassword:ruleForm.curPass, newPassword:ruleForm.pass})
      console.log('submit!')
    } else {
      console.log('error submit!')
    }
  })
}

const open1 = () => {
  ElMessage({
    showClose: true,
    message: 'This is a message.',
    duration: 0
  })
}

// ==== MFA SETUP ====
const mfaState = ref('disabled')
const mfaStates = {
  NOT_ENABLED: 'disabled',
  ENABLED: 'enabled',
  SETUP: 'setup',
}

const QRCode = ref("")
function setupMFA() {
   setUpTOTP()
    .then((result) => {
      QRCode.value = result.sharedSecret
      QRCodeValue.value = result.getSetupUri('Pennsieve')
      mfaState.value = mfaStates.SETUP
    })
}

function cancelSetup() {
  mfaState.value = mfaStates.NOT_ENABLED
  isCodeShowing.value = false
}

function validateMFA() {
  verifyTOTPSetup({ code: mfaForm.code })
    .then((response) => {
      updateMFAPreference({ totp: 'ENABLED' })
        .then((resp) => {
          mfaState.value = mfaStates.ENABLED
        })
    }).catch(err => {
      ElMessage({
        message: `Something went wrong with validation of your code`,
        type: 'error',
      })
    }

  )
}

function disableMFA() {
  updateMFAPreference({ totp: 'DISABLED' })
    .then((resp) => {
      mfaState.value = mfaStates.NOT_ENABLED
    })
    .catch(err => {
      ElMessage({
        message: `Something went wrong with disabling 2FA`,
        type: 'error',
      })
    })
}

const isCodeShowing = ref(false)
function showCode() {
  isCodeShowing.value = true
}


const QRCodeValue = ref('')
const level = ref<Level>('M')
const renderAs = ref<RenderAs>('svg')
const background = ref('#ffffff')
const foreground = ref('#000000')
const margin = ref(0)

const gradient = ref(true)
const gradientType = ref<GradientType>('linear')
const gradientStartColor = ref('#4d628c')
const gradientEndColor = ref('#011F5B')


const mfaValidationForm = ref<FormInstance>()
const mfaForm = reactive({
  code: '',
})

const showCopySuccess = ref(false)
function copyToClipboard() {
  navigator.clipboard.writeText(QRCode.value)
  showCopySuccess.value = true
}
</script>

<template>
  <div>

    <div v-if="loginProvider!==loginProviders.COGNITO">
      <h2>Login Settings</h2>
      <p>
        You are currently logged in with your <strong> {{loginProvider}}</strong> account.        Please use the ORCID website to manage your account such as changing your password and username.

      </p>
      <img
        src="assets/images/illustrations/illo-missing-models.svg"
        class="highlight"
        alt="No login configuration settings available"
      />

    </div>
    <div v-else>
      <div class="pwd-setup">
        <h2> Reset your password </h2>
        <p class="password-requirements">
          We recommend that you create a password that is more than 8 characters long and contains a combination of uppercase &amp; lowercase characters,
          numbers and symbols.
        </p>

        <el-form
          ref="ruleFormRef"
          style="max-width: 600px"
          :model="ruleForm"
          status-icon
          :rules="rules"
          label-width="auto"
          class="demo-ruleForm"
          label-position="top"
        >
          <el-form-item label="Current password" prop="curpass">
            <el-input
              v-model="ruleForm.curPass"
              type="password"
              placeholder="Provide your existing password"
              autocomplete="off"
            />
          </el-form-item>
          <el-form-item label="New password" prop="pass">
            <el-input v-model="ruleForm.pass" type="password"
                      placeholder="Type a new password"
                      autocomplete="off" />
          </el-form-item>
          <el-form-item prop="checkPass">
            <el-input
              v-model="ruleForm.checkPass"
              type="password"
              placeholder="Re-type the password"
              autocomplete="off"
            />
          </el-form-item>
          <el-form-item>
            <bf-button @click="submitForm(ruleFormRef)" :prevent-click-event="true">
              Update password
            </bf-button>
          </el-form-item>
        </el-form>
      </div>

      <div class="mfa-setup">
        <h2> Configure two-factor authentication </h2>

        <p v-if="mfaState !== mfaStates.SETUP">
          Two-factor authentication is <strong>{{ mfaState }}</strong>
        </p>
        <p v-else>

          Use the QR code to setup two-factor authentication in a TOTP-compatible authenticator app,
          such as Google Authenticator or Authy. Then, provide a validation code from your
          authenticator and click on "Enable two-factor authentication" to enable 2FA on your account.
        </p>

        <div class="qr-container" v-if="mfaState === mfaStates.SETUP">

          <div class="qr-wrapper">
            <qrcode-vue
              :value="QRCodeValue"
              :level="level"
              :render-as="renderAs"
              :background="background"
              :foreground='foreground'
              :gradient="gradient"
              :gradient-type="gradientType"
              :gradient-start-color="gradientStartColor"
              :gradient-end-color="gradientEndColor"
            />

          </div>


          <el-form
            ref="mfaValidationForm"
            :model="mfaRuleForm"
            status-icon
            label-width="auto"
            class="qr-validation-form"
            label-position="left"
          >
            <el-form-item label="Code" prop="valCode">
              <el-input
                v-model="mfaForm.code"
                placeholder="Enter validation code"
                autocomplete="off"
              />
            </el-form-item>

          </el-form>
        </div>

        <div class="show-code" v-if="mfaState === mfaStates.SETUP">
          <div class="code-string" v-if="isCodeShowing">
            <div> {{QRCode}} </div>
            <button @click="copyToClipboard">
              <IconUpload
                title="Copy To Clipboard Icon"
                class="icon-upload"
                :height="18"
                :width="18"
              />
            </button>
            <transition name="fade" @after-enter="showCopySuccess = false">
          <span v-if="showCopySuccess" class="copy-success-notification">
            Copied URL to clipboard
          </span>
            </transition>

          </div>
          <div v-else>
            <button @click="showCode">Show code</button>
          </div>

        </div>

        <div class="btn-wrapper" v-if="mfaState===mfaStates.SETUP">
          <bf-button class="secondary" @click="cancelSetup">
            Cancel configuration
          </bf-button>

          <bf-button @click="validateMFA">
            Enable two-factor authentication
          </bf-button>
        </div>
        <div v-else-if="mfaState===mfaStates.NOT_ENABLED">
          <bf-button @click="setupMFA">
            Setup two-factor authentication
          </bf-button>
        </div>
        <div v-else>
          <bf-button  @click="disableMFA" >
            Disable two-factor authentication
          </bf-button>
        </div>
      </div>
    </div>


  </div>
</template>

<style scoped lang="scss">

.highlight {
  margin-top: 16px;
  width: 500px;
  height: 100px;
}

.code-string {
  display: flex;
  flex-direction: row;
  gap: 16px;
  align-items: center;
  color: $orange_1;

  .icon-upload {
    display: flex;
    color: $purple_3;
  }
}

.show-code {
  margin: 8px 0 16px 0;

  button {
    color: $purple_3;
  }

}

.mfa-setup {
  margin-top: 48px;

}

.btn-wrapper {
  display: flex;
  gap: 8px;
}
.qr-container {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 42px;

}
.qr-validation-form {
  display: flex;
  flex-direction: column;
  margin: 0 8px;

  .el-form-item {
    margin: 0
  }
}

h2 {
  font-weight: 300;
  font-size: 20px;
}

p {
  margin-bottom: 20px;
  font-weight: 300;
  font-size: 14px;
  color: $gray_5;
  max-width: 500px;
}


</style>