<script setup>
// Connect an AWS account from the browser, or upgrade an older connection:
// Pennsieve sets up a role (name + external ID), the user creates it from
// Pennsieve's CloudFormation template in their own AWS console, then Verify
// has Pennsieve register it (or, upgrading, switch the account to it). No
// AWS keys leave AWS; no agent or CLI is needed.
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'
import { checkAccountInput, errorMessage, iamRoleConsoleUrl } from './awsConnect'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // An account to upgrade (a role made from the template replaces its
  // older one); none to connect a new account.
  account: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'connected', 'upgrade-unavailable'])

const router = useRouter()
const computeResourcesStore = useComputeResourcesStore()

const isUpgrade = computed(() => !!props.account)
const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// start → console (the user creates the stack) → done
const step = ref('start')
const name = ref('')
const setup = ref(null) // the role setup: { roleName, externalId, cloudFormation }
const unavailable = ref(false) // no template on this Pennsieve yet
const isStarting = ref(false)
const showCloudShell = ref(false)
const accountInput = ref('')
const inputError = ref('')
const verifyError = ref('')
const isVerifying = ref(false)
const connected = ref(null) // { uuid } once registered

watch(visible, (open) => {
  if (!open) return
  step.value = 'start'
  name.value = ''
  setup.value = null
  unavailable.value = false
  showCloudShell.value = false
  accountInput.value = ''
  inputError.value = ''
  verifyError.value = ''
  connected.value = null
})

async function openConsole() {
  isStarting.value = true
  try {
    // A fresh setup each time: its external ID is issued to this user, for
    // its role, for 24 hours.
    const s = await computeResourcesStore.requestRoleSetup()
    if (!s?.cloudFormation?.quickCreateUrl) {
      unavailable.value = true
      return
    }
    setup.value = s
    window.open(s.cloudFormation.quickCreateUrl, '_blank', 'noopener')
    step.value = 'console'
  } catch (e) {
    ElMessage.error(errorMessage(e?.status, e?.body))
  } finally {
    isStarting.value = false
  }
}

// CloudShell: the same stack, from a command in the AWS console's shell.
function showShell() {
  showCloudShell.value = !showCloudShell.value
}
async function copyCommand() {
  try {
    await navigator.clipboard.writeText(setup.value?.cloudFormation?.cloudShellCommand || '')
    ElMessage.success('Command copied')
  } catch {
    ElMessage.error("Couldn't copy; select the command and copy it")
  }
}

async function verify() {
  verifyError.value = ''
  const roleName = setup.value?.roleName
  const externalId = setup.value?.externalId
  const templateVersion = setup.value?.cloudFormation?.templateVersion
  isVerifying.value = true
  try {
    if (isUpgrade.value) {
      await computeResourcesStore.switchComputeAccountRole(props.account.uuid, { roleName, externalId, templateVersion })
      step.value = 'done'
      emit('connected', props.account)
      return
    }
    const parsed = checkAccountInput(accountInput.value, roleName)
    if (parsed.error) {
      inputError.value = parsed.error
      return
    }
    inputError.value = ''
    const created = await computeResourcesStore.registerComputeAccount({
      accountId: parsed.accountId,
      roleName,
      externalId,
      templateVersion,
      name: name.value.trim(),
    })
    connected.value = created || {}
    step.value = 'done'
    emit('connected', created)
  } catch (e) {
    if (isUpgrade.value && e?.status === 404) {
      // This Pennsieve can't switch roles yet
      emit('upgrade-unavailable')
      verifyError.value = "Upgrading isn't available yet. Your current connection keeps working."
      return
    }
    // The likeliest miss: the stack is still creating, or the role isn't
    // there yet. Verify stays available to try again.
    verifyError.value = e?.status && e.status < 500 && !e?.body?.message
      ? 'Pennsieve couldn\'t use the role yet. The stack may still be creating; try again in a minute.'
      : errorMessage(e?.status, e?.body)
  } finally {
    isVerifying.value = false
  }
}

function createNode() {
  visible.value = false
  router.push({ name: 'my-compute-nodes', query: { newNode: connected.value?.uuid || '1' } })
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isUpgrade ? 'Upgrade the connection' : 'Connect an AWS account'"
    width="560px"
    append-to-body
    class="connect-aws-dialog"
  >
    <!-- Start -->
    <div v-if="step === 'start'" class="ca-step">
      <p class="ca-text">
        <template v-if="isUpgrade">
          This replaces the role Pennsieve uses in <strong>{{ account.name || 'this account' }}</strong> with one
          made from Pennsieve's template, which you can update from your AWS console later. Its compute nodes and
          sharing stay as they are.
        </template>
        <template v-else>
          Pennsieve gets a role in your AWS account to set up and run your compute nodes there. You create it in
          your own AWS console, so you never share AWS keys.
        </template>
      </p>
      <label v-if="!isUpgrade" class="ca-field">
        <span class="ca-label">Name <span class="ca-optional">optional</span></span>
        <el-input v-model="name" placeholder="e.g. Lab AWS account" />
      </label>

      <div v-if="unavailable" class="ca-note">
        Connecting in the browser isn't available yet. Use the Pennsieve agent instead:
        <code>pennsieve account register</code>
      </div>
    </div>

    <!-- In the AWS console -->
    <div v-else-if="step === 'console'" class="ca-step">
      <p class="ca-text">The AWS console opened in a new tab. There:</p>
      <ol class="ca-list">
        <li>Sign in to the AWS account you want to use.</li>
        <li>Tick <em>I acknowledge that AWS CloudFormation might create IAM resources</em>.</li>
        <li>Click <strong>Create stack</strong>. It takes about a minute.</li>
      </ol>
      <p class="ca-muted">
        Didn't open?
        <a :href="setup.cloudFormation.quickCreateUrl" target="_blank" rel="noopener">Open the AWS console</a>
        <template v-if="setup.cloudFormation.cloudShellCommand">
          ·
          <button type="button" class="ca-link" @click="showShell">Use AWS CloudShell instead</button>
        </template>
      </p>
      <div v-if="showCloudShell" class="ca-shell">
        <p class="ca-muted">Paste this into AWS CloudShell, in the account you want to use:</p>
        <pre class="ca-command">{{ setup.cloudFormation.cloudShellCommand }}</pre>
        <bf-button class="secondary compact flex" @click="copyCommand">Copy</bf-button>
      </div>

      <label v-if="!isUpgrade" class="ca-field">
        <span class="ca-label">Your AWS account ID</span>
        <el-input
          v-model="accountInput"
          placeholder="123456789012, or the role's ARN from the stack's Outputs"
          @keyup.enter="verify"
        />
        <span v-if="inputError" class="ca-error">{{ inputError }}</span>
      </label>
      <p v-else class="ca-text">Once the stack is created, click <strong>Verify</strong>.</p>
      <p v-if="verifyError" class="ca-error">{{ verifyError }}</p>
    </div>

    <!-- Done -->
    <div v-else class="ca-step">
      <template v-if="isUpgrade">
        <p class="ca-text">The connection is upgraded. Pennsieve now uses the new role.</p>
        <p class="ca-text">
          Delete the old role <code>{{ account.roleName }}</code> in your AWS account:
          <a :href="iamRoleConsoleUrl(account.roleName)" target="_blank" rel="noopener">open it in the AWS console</a>.
        </p>
      </template>
      <template v-else>
        <p class="ca-text">Your AWS account is connected.</p>
        <p class="ca-muted">To use it in a workspace, share it from Your compute resources.</p>
      </template>
    </div>

    <template #footer>
      <div class="ca-footer">
        <template v-if="step === 'start'">
          <bf-button class="secondary" @click="visible = false">Cancel</bf-button>
          <bf-button v-if="!unavailable" :processing="isStarting" :disabled="isStarting" @click="openConsole">
            Open AWS console
          </bf-button>
        </template>
        <template v-else-if="step === 'console'">
          <bf-button class="secondary" @click="visible = false">Cancel</bf-button>
          <bf-button :processing="isVerifying" :disabled="isVerifying" @click="verify">Verify</bf-button>
        </template>
        <template v-else>
          <bf-button class="secondary" @click="visible = false">Close</bf-button>
          <bf-button v-if="!isUpgrade" @click="createNode">Create a compute node on it</bf-button>
        </template>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use '../../../styles/theme';

.ca-step {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ca-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: theme.$gray_6;
}
.ca-muted {
  margin: 0;
  font-size: 13px;
  color: theme.$gray_5;
}
.ca-list {
  margin: 0;
  padding-left: 20px;
  font-size: 14px;
  line-height: 1.7;
  color: theme.$gray_6;
}
.ca-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ca-label {
  font-size: 13px;
  font-weight: 500;
  color: theme.$gray_6;
}
.ca-optional {
  font-weight: 400;
  color: theme.$gray_4;
}
.ca-error {
  margin: 0;
  font-size: 13px;
  color: theme.$red_2;
}
.ca-note {
  padding: 12px 14px;
  border: 1px solid theme.$gray_2;
  background: theme.$gray_1;
  font-size: 13px;
  color: theme.$gray_6;
}
.ca-shell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.ca-command {
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 10px 12px;
  overflow-x: auto;
  border: 1px solid theme.$gray_2;
  background: theme.$gray_1;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
.ca-link {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: theme.$link-color;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}
a {
  color: theme.$link-color;
}
code {
  font-size: 12px;
}
.ca-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
