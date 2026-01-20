<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useStore } from 'vuex'
import {
  updatePassword,
  setUpTOTP,
  verifyTOTPSetup,
  fetchMFAPreference,
  updateMFAPreference,
  fetchAuthSession,
} from 'aws-amplify/auth'
import { pathOr } from 'ramda'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import IconUpload from '@/components/icons/IconUpload.vue'
import QrcodeVue from 'qrcode.vue'

const store = useStore()

const loginScope = ref('')
const loginProvider = ref('')
const loginProviders = {
  COGNITO: 'Pennsieve',
  ORCID: 'ORCID',
}

onMounted(async () => {
  try {
    const authSession = await fetchAuthSession()
    loginScope.value = pathOr('', ['tokens','accessToken','payload','scope'], authSession)
    
    switch (loginScope.value) {
      case 'aws.cognito.signin.user.admin':
        loginProvider.value = loginProviders.COGNITO
        break
      case 'openid':
        loginProvider.value = loginProviders.ORCID
        break
      default:
        loginProvider.value = ""
    }

    const prefs = await fetchMFAPreference()
    if (prefs && prefs.enabled && prefs.enabled.includes('TOTP')) {
      mfaState.value = mfaStates.ENABLED
    }
  } catch (error) {
    console.error('Failed to initialize security settings:', error)
  }
})

async function handleUpdatePassword({ oldPassword, newPassword }) {
  try {
    await updatePassword({ oldPassword, newPassword })
    console.log('Successfully updated your password')
    // Reset form
    ruleForm.curPass = ''
    ruleForm.pass = ''
    ruleForm.checkPass = ''
  } catch (err) {
    console.error('Password update error:', err)
  }
}

const ruleFormRef = ref()
const ruleForm = reactive({
  curPass: '',
  pass: '',
  checkPass: '',
})

const validatePassword = (rule, value, callback) => {
  if (value === '') {
    return callback(new Error('Please input the password'))
  }
  
  // Basic password validation - you can enhance this
  if (value.length < 8) {
    callback(new Error('Password must be at least 8 characters long'))
  } else {
    callback()
  }
}

const validatePass2 = (rule, value, callback) => {
  if (value === '') {
    callback(new Error('Please input the password again'))
  } else if (value !== ruleForm.pass) {
    callback(new Error("Two inputs don't match!"))
  } else {
    callback()
  }
}

const rules = reactive({
  pass: [{ validator: validatePassword, trigger: 'blur' }],
  checkPass: [{ validator: validatePass2, trigger: 'blur' }],
})

const submitForm = (formEl) => {
  if (!formEl) return
  formEl.validate((valid) => {
    if (valid) {
      handleUpdatePassword({
        oldPassword: ruleForm.curPass, 
        newPassword: ruleForm.pass
      })
    }
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
const QRCodeValue = ref('')

async function setupMFA() {
  try {
    const result = await setUpTOTP()
    QRCode.value = result.sharedSecret
    QRCodeValue.value = result.getSetupUri('Pennsieve')
    mfaState.value = mfaStates.SETUP
  } catch (error) {
    console.error('Failed to setup MFA:', error)
  }
}

function cancelSetup() {
  mfaState.value = mfaStates.NOT_ENABLED
  isCodeShowing.value = false
}

async function validateMFA() {
  try {
    await verifyTOTPSetup({ code: mfaForm.code })
    await updateMFAPreference({ totp: 'ENABLED' })
    mfaState.value = mfaStates.ENABLED
    console.log('MFA enabled successfully')
  } catch (err) {
    console.error('Something went wrong with validation of your code:', err)
  }
}

async function disableMFA() {
  try {
    await updateMFAPreference({ totp: 'DISABLED' })
    mfaState.value = mfaStates.NOT_ENABLED
    console.log('MFA disabled successfully')
  } catch (err) {
    console.error('Something went wrong with disabling 2FA:', err)
  }
}

const isCodeShowing = ref(false)
function showCode() {
  isCodeShowing.value = true
}

const mfaValidationForm = ref()
const mfaForm = reactive({
  code: '',
})

const showCopySuccess = ref(false)
function copyToClipboard() {
  navigator.clipboard.writeText(QRCode.value)
  showCopySuccess.value = true
  setTimeout(() => {
    showCopySuccess.value = false
  }, 2000)
}
</script>

<template>
  <div class="user-security-container">
    <div v-if="loginProvider !== loginProviders.COGNITO">
      <h2>Login Settings</h2>
      <p>
        You are currently logged in with your <strong>{{ loginProvider }}</strong> account. 
        Please use the ORCID website to manage your account such as changing your password and username.
      </p>
    </div>
    
    <div v-else>
      <div class="pwd-setup">
        <h2>Reset your password</h2>
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
            <el-input 
              v-model="ruleForm.pass" 
              type="password"
              placeholder="Type a new password"
              autocomplete="off" 
            />
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
            <bf-button @click="submitForm(ruleFormRef)">
              Update password
            </bf-button>
          </el-form-item>
        </el-form>
      </div>

      <div class="mfa-setup">
        <h2>Configure two-factor authentication</h2>

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
              :size="200"
              level="M"
              render-as="svg"
              background="#ffffff"
              foreground="#000000"
              :margin="0"
            />
          </div>

          <el-form
            ref="mfaValidationForm"
            :model="mfaForm"
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
            <div>{{ QRCode }}</div>
            <button @click="copyToClipboard">
              <IconUpload
                title="Copy To Clipboard Icon"
                class="icon-upload"
                :height="18"
                :width="18"
              />
            </button>
            <transition name="fade">
              <span v-if="showCopySuccess" class="copy-success-notification">
                Copied code to clipboard
              </span>
            </transition>
          </div>
          <div v-else>
            <button @click="showCode">Show code</button>
          </div>
        </div>

        <div class="btn-wrapper" v-if="mfaState === mfaStates.SETUP">
          <bf-button class="secondary" @click="cancelSetup">
            Cancel configuration
          </bf-button>
          <bf-button @click="validateMFA">
            Enable two-factor authentication
          </bf-button>
        </div>
        <div v-else-if="mfaState === mfaStates.NOT_ENABLED">
          <bf-button @click="setupMFA">
            Setup two-factor authentication
          </bf-button>
        </div>
        <div v-else>
          <bf-button @click="disableMFA">
            Disable two-factor authentication
          </bf-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.user-security-container {
  padding: 40px;
  max-width: 800px;
  margin: 0;
}

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
  color: theme.$orange_1;

  .icon-upload {
    display: flex;
    color: theme.$purple_3;
  }
}

.show-code {
  margin: 8px 0 16px 0;

  button {
    color: theme.$purple_3;
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: underline;
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

.qr-placeholder {
  border: 2px dashed theme.$gray_3;
  padding: 20px;
  text-align: center;
  background: theme.$gray_1;
  
  p {
    margin: 0;
    font-size: 12px;
    color: theme.$gray_4;
  }
}

.qr-validation-form {
  display: flex;
  flex-direction: column;
  margin: 0 8px;

  .el-form-item {
    margin: 0;
  }
}

h2 {
  font-weight: 300;
  font-size: 20px;
  color: theme.$gray_6;
  margin-bottom: 8px;
}

p {
  margin-bottom: 20px;
  font-weight: 300;
  font-size: 14px;
  color: theme.$gray_5;
  max-width: 500px;
  line-height: 1.5;
}

.copy-success-notification {
  color: theme.$green_1;
  font-size: 12px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>