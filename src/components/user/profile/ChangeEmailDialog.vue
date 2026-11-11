<script setup>
import { ref, computed, watch } from "vue";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";
import BfDialogHeader from "@/components/shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "@/components/shared/dialog-body/DialogBody.vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import * as siteConfig from "@/site-config/site.json";

const isDialogVisible = defineModel("visible", { type: Boolean, default: false });

const store = useStore();
const currentEmail = computed(() => store.state.profile?.email || "");

const emailFormRef = ref(null);
const isSaving = ref(false);
const emailForm = ref({ newEmail: "", confirmEmail: "" });
const newEmailServerError = ref("");

const normalizeEmail = (email) => email.trim().toLowerCase();

const emailRules = {
  newEmail: [
    { required: true, message: "Please enter a new email address", trigger: "blur" },
    { type: "email", message: "Please enter a valid email address", trigger: "blur" },
    {
      validator: (rule, value, callback) => {
        if (normalizeEmail(value) === normalizeEmail(currentEmail.value)) {
          callback(new Error("This is already your email address"));
        } else {
          callback();
        }
      },
      trigger: "blur",
    },
  ],
  confirmEmail: [
    { required: true, message: "Please confirm your new email address", trigger: "blur" },
    {
      validator: (rule, value, callback) => {
        if (normalizeEmail(value) !== normalizeEmail(emailForm.value.newEmail)) {
          callback(new Error("Email addresses do not match"));
        } else {
          callback();
        }
      },
      trigger: "blur",
    },
  ],
};

watch(isDialogVisible, (isVisible) => {
  if (isVisible) {
    emailForm.value = { newEmail: "", confirmEmail: "" };
    newEmailServerError.value = "";
    emailFormRef.value?.clearValidate();
  }
});

watch(() => emailForm.value.newEmail, () => {
  newEmailServerError.value = "";
});

async function readServerMessage(error) {
  if (typeof error?.json !== "function") return "";
  try {
    const errorBody = await error.json();
    return errorBody?.message || "";
  } catch {
    return "";
  }
}

// TEMPORARY: the API currently returns a 500 with a message for a taken email instead of a 409,
// so we match on the message text. Remove once the BE returns 409 for duplicates.
const isDuplicateEmailMessage = (message) => /unique|already/i.test(message);

async function updateEmail() {
  // Reset so a repeated identical server error still registers as a change on el-form-item
  newEmailServerError.value = "";
  try {
    await emailFormRef.value.validate();
  } catch {
    return;
  }

  isSaving.value = true;
  try {
    const accessToken = await useGetToken();
    const updatedUser = await useSendXhr(`${siteConfig.apiUrl}/user/email`, {
      method: "PUT",
      header: { Authorization: `Bearer ${accessToken}` },
      body: { email: emailForm.value.newEmail },
    });

    await store.dispatch("updateProfile", { ...store.state.profile, ...updatedUser });

    ElMessage.success("Your email address has been updated");
    isDialogVisible.value = false;
  } catch (error) {
    const serverMessage = await readServerMessage(error);
    if (error?.status === 409 || isDuplicateEmailMessage(serverMessage)) {
      newEmailServerError.value = "This email address is already used by another account";
    } else {
      ElMessage.error("Could not update your email address. Please try again.");
    }
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <el-dialog v-model="isDialogVisible" width="500px" class="change-email-dialog">
    <template #header>
      <bf-dialog-header title="Change Email Address" />
    </template>
    <dialog-body>
      <p class="current-email">
        Current email: <strong>{{ currentEmail }}</strong>
      </p>
      <p class="email-note">
        You will use your new email address to sign in to Pennsieve.
      </p>
      <el-form
        ref="emailFormRef"
        :model="emailForm"
        :rules="emailRules"
        label-position="top"
        @submit.prevent="updateEmail"
      >
        <el-form-item label="New Email" prop="newEmail" :error="newEmailServerError">
          <el-input v-model="emailForm.newEmail" type="email" autocomplete="email" />
        </el-form-item>
        <el-form-item label="Confirm New Email" prop="confirmEmail">
          <el-input v-model="emailForm.confirmEmail" type="email" autocomplete="off" />
        </el-form-item>
      </el-form>
    </dialog-body>
    <template #footer>
      <bf-button class="secondary" @click="isDialogVisible = false">Cancel</bf-button>
      <bf-button :processing="isSaving" processing-text="Updating" @click="updateEmail">
        Update Email
      </bf-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "@/styles/theme";
@use "@/styles/element/dialog";

.current-email {
  color: theme.$gray_6;
  margin-top: 0;
  word-break: break-all;
}

.email-note {
  color: theme.$gray_5;
  font-weight: 300;
  margin-bottom: 16px;
}
</style>
