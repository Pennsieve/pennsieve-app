<script setup>
import { ref, computed, onMounted, watch, getCurrentInstance } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "vuex";
import DegreeSelect from "@/components/shared/DegreeSelect/DegreeSelect.vue";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import * as siteConfig from "@/site-config/site.json";
import { Message } from "@element-plus/icons-vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import ChangeEmailDialog from "@/components/user/profile/ChangeEmailDialog.vue";

const store = useStore();
const route = useRoute();
const instance = getCurrentInstance();

// Remove the navigation states since we're removing the left menu

const userId = computed(() => route.params.userId);
const userProfile = computed(() => store.state.profile);
const userEmail = computed(() => userProfile.value?.email || "");
const isChangeEmailDialogVisible = ref(false);

// Profile form setup
const profileFormRef = ref(null);
const ruleForm = ref({
  firstName: "",
  middleInitial: "",
  lastName: "",
  credential: "",
  degree: null,
});

const rules = ref({
  firstName: [
    {
      required: true,
      message: "Please provide your first name",
      trigger: "blur",
    },
  ],
  lastName: [
    {
      required: true,
      message: "Please provide your last name",
      trigger: "blur",
    },
  ],
});

onMounted(async () => {
  setRuleFormData(store.state.profile);
});

watch(
  () => store.state.profile,
  (newProfile) => {
    setRuleFormData(newProfile);
  },
  { deep: true }
);

function setRuleFormData(profile) {
  if (!profile) {
    return;
  }
  const { firstName, lastName, credential, degree, middleInitial } = profile;

  ruleForm.value = {
    firstName: firstName || "",
    lastName: lastName || "",
    credential: credential || "",
    degree: degree || null,
    middleInitial: middleInitial || "",
  };
}

// Profile update functionality
async function handleUpdateProfileSubmit() {
  console.log("here");
  if (!profileFormRef.value) return;

  try {
    const valid = await profileFormRef.value.validate();
    if (!valid) {
      return;
    }

    const token = await useGetToken();
    const profileUrl = `${siteConfig.apiUrl}/user?api_key=${token}`;

    await useSendXhr(profileUrl, {
      method: "PUT",
      body: {
        ...ruleForm.value,
      },
    });

    await store.dispatch("updateProfile", {
      ...store.state.profile,
      ...ruleForm.value,
    });

    // Show success notification using the app's message system
    instance.proxy.$message({
      message: "Your profile has been updated successfully",
      type: "success",
      center: true,
      duration: 3000,
      showClose: true,
    });
  } catch (error) {
    console.error("Error updating profile:", error);

    // Show error notification using the app's message system
    instance.proxy.$message({
      message: error.message || "Failed to update profile. Please try again.",
      type: "error",
      center: true,
      duration: 5000,
      showClose: true,
    });
  }
}
</script>

<template>
  <div class="user-profile-container">
    <h2 class="page-title">Update your profile</h2>

    <div class="settings-sections">
      <section class="settings-card">
        <header class="settings-card__header">
          <h3>Profile information</h3>
          <p>
            Your profile is used to generate the dataset reference when datasets
            are published. Make sure it matches how you want to be cited in any
            dataset publication.
          </p>
        </header>

        <el-form
          id="update-profile-form"
          ref="profileFormRef"
          :model="ruleForm"
          :rules="rules"
          label-position="top"
        >
          <div class="name-grid">
            <el-form-item label="First Name" prop="firstName">
              <el-input v-model="ruleForm.firstName" />
            </el-form-item>
            <el-form-item
              id="input-middle-initial"
              label="Middle Initial"
              prop="middleInitial"
            >
              <el-input v-model="ruleForm.middleInitial" :maxlength="1" />
            </el-form-item>
            <el-form-item label="Last Name" prop="lastName">
              <el-input v-model="ruleForm.lastName" />
            </el-form-item>
          </div>
          <div class="two-column-grid">
            <el-form-item label="Title" prop="credential">
              <el-input v-model="ruleForm.credential" />
            </el-form-item>
            <el-form-item label="Degree" prop="degree">
              <degree-select v-model="ruleForm.degree" />
            </el-form-item>
          </div>
        </el-form>

        <footer class="settings-card__footer">
          <bf-button type="primary" @click="handleUpdateProfileSubmit">
            Update Profile
          </bf-button>
        </footer>
      </section>

      <section class="settings-card">
        <header class="settings-card__header">
          <h3>Email address</h3>
          <p>
            Used to sign in and receive notifications. If you change it, we'll
            send a confirmation to both your old and new addresses.
          </p>
        </header>

        <div class="email-row">
          <div class="email-row__icon">
            <el-icon :size="18"><Message /></el-icon>
          </div>
          <div class="email-row__text">
            <span class="email-row__label">Current email</span>
            <span class="email-row__address">{{ userEmail }}</span>
          </div>
        </div>

        <footer class="settings-card__footer">
          <bf-button class="secondary" @click="isChangeEmailDialogVisible = true">
            Change Email
          </bf-button>
        </footer>
      </section>
    </div>

    <change-email-dialog v-model:visible="isChangeEmailDialogVisible" />
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.user-profile-container {
  padding: 40px;
  max-width: 1200px;
  margin: 0;
  font-family: theme.$system-font;
}

// Profile gets the wider column since it holds the form
.settings-sections {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 24px;
}

@media (max-width: 1024px) {
  .settings-sections {
    grid-template-columns: 1fr;
  }
}

.page-title {
  font-weight: 500;
  font-size: 20px;
  margin: 0 0 24px;
  color: theme.$purple_3;
}

.settings-card {
  display: flex;
  flex-direction: column;
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 8px;

  &__header {
    padding: 24px 24px 16px;

    h3 {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 500;
      color: theme.$purple_3;
    }

    p {
      margin: 0;
      font-size: 14px;
      line-height: 21px;
      color: theme.$gray_5;
    }
  }

  &__footer {
    margin-top: auto;
    display: flex;
    justify-content: flex-end;
    padding: 16px 24px;
    border-top: 1px solid theme.$gray_2;
  }
}

#update-profile-form {
  padding: 0 24px 8px;

  :deep(.el-form-item__label) {
    font-weight: 500;
    color: theme.$gray_6;
  }
}

// Middle initial is a single character, so it gets a narrow column
.name-grid {
  display: grid;
  grid-template-columns: 1fr 120px 1fr;
  column-gap: 16px;
}

.two-column-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 16px;
}

@media (max-width: 640px) {
  .name-grid,
  .two-column-grid {
    grid-template-columns: 1fr;
  }
}

.email-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0 24px 24px;
  padding: 16px;
  border: 1px solid theme.$gray_2;
  border-radius: 8px;

  &__icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: theme.$purple_tint;
    color: theme.$purple_3;
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  &__label {
    font-size: 14px;
    font-weight: 500;
    color: theme.$gray_6;
  }

  &__address {
    font-size: 14px;
    color: theme.$gray_5;
    overflow-wrap: anywhere;
  }
}
</style>
