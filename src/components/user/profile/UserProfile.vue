<script setup>
import { ref, computed, onMounted, watch, getCurrentInstance } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "vuex";
import DegreeSelect from "@/components/shared/DegreeSelect/DegreeSelect.vue";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import * as siteConfig from "@/site-config/site.json";
import BfButton from "@/components/shared/bf-button/BfButton.vue";

const store = useStore();
const route = useRoute();
const instance = getCurrentInstance();

// Remove the navigation states since we're removing the left menu

const userId = computed(() => route.params.userId);
const userProfile = computed(() => store.state.profile);

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
    <div class="profile-content">
      <h2>Update your user profile</h2>
      <div class="author-note">
        Your profile is used to generate the dataset reference when datasets are
        published. Make sure your profile matches how you want to be cited in
        any dataset publication.
      </div>
      <el-form
        id="update-profile-form"
        ref="profileFormRef"
        :model="ruleForm"
        :rules="rules"
        label-position="top"
      >
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
        <el-form-item label="Title" prop="credential">
          <el-input v-model="ruleForm.credential" />
        </el-form-item>
        <el-form-item label="Degree" prop="degree">
          <degree-select v-model="ruleForm.degree" />
        </el-form-item>

        <el-form-item>
          <bf-button type="primary" @click="handleUpdateProfileSubmit">
            Update Profile
          </bf-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.user-profile-container {
  padding: 40px;
  max-width: 800px;
  margin: 0;
}

.profile-content {
  h2 {
    font-weight: 300;
    font-size: 20px;
    margin-top: 0;
    color: theme.$gray_6;
  }
}

.author-note {
  background: #fff3cd;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 16px;
  font-weight: 300;
  line-height: 21px;
  color: theme.$gray_5;
}

// Element Plus form styling
#update-profile-form {
  .el-form-item {
    margin-bottom: 22px;
  }

  .el-form-item__label {
    font-weight: 500;
    color: theme.$gray_6;
  }

  .el-input__inner {
    border-radius: 4px;
  }

  .el-button--primary {
    background-color: theme.$purple_2;
    border-color: theme.$purple_2;

    &:hover {
      background-color: theme.$purple_1;
      border-color: theme.$purple_1;
    }
  }
}
</style>
