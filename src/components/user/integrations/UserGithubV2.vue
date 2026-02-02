<template>
  <div class="user-github-container">
    <div class="github-content">
      <h2>Link your GitHub account</h2>
      <p class="github-requirements">
        When you link your GitHub account to your Pennsieve account, you can
        select to track and publish repositories on Pennsieve. Each time you
        generate a release on a tracked repository, Pennsieve will archive the
        version, create a citable DOI and generate a landing page for that
        specific version of your code.
      </p>

      <div v-if="loading" class="loading">Loading...</div>
      <div v-else>
        <div v-if="!hasGithubProfile" class="github-connect">
          <p>
            Register the Pennsieve GitHub Application in your Github account,
            and authorize Pennsieve to get notified about events.
            <a href="https://docs.pennsieve.io/docs" target="_blank"
              >Learn More</a
            >
          </p>
          <el-button type="primary" @click="openGitHub">
            Register your GitHub Account
          </el-button>
        </div>

        <div v-else class="github-connected">
          <div class="github-header">
            <div class="github-header-content">
              <p class="github-success-text">
                You have successfully linked your GitHub Account and installed
                the Pennsieve Github Application.
                <a
                  href="https://docs.pennsieve.io/docs/github-integration"
                  target="_blank"
                >
                  Learn More
                </a>
              </p>
            </div>
            <div class="github-header-actions">
              <router-link
                :to="{ name: 'my-code' }"
                class="view-repositories-link"
              >
                View My Repositories
              </router-link>
            </div>
          </div>

          <div class="integration-success">
            <IconGitHub :height="30" :width="30" />
            <a
              class="link"
              :href="displayGithubProfile.html_url"
              target="_blank"
            >
              {{ displayGithubProfile.login }}
            </a>
            <button class="delete-button" @click="isDeleteDialogVisible = true">
              <IconRemove :height="10" :width="10" />
            </button>
          </div>
        </div>
      </div>

      <el-dialog
        v-model="isDeleteDialogVisible"
        title="Delete GitHub Integration?"
        width="500px"
      >
        <p style="max-width: 450px">
          Are you sure you want to remove your linked GitHub account from your
          Pennsieve user profile?
        </p>
        <ul>
          <li>
            Pennsieve will no longer track GitHub repositories in your account.
          </li>
          <li>
            GitHub releases will no longer result in Pennsieve GitHub
            Publications.
          </li>
          <li>
            You can no longer create Applications and Workflows on Pennsieve.
          </li>
        </ul>

        <template #footer>
          <el-button @click="isDeleteDialogVisible = false">Cancel</el-button>
          <el-button type="danger" @click="confirmDelete"> Confirm </el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  ref,
  onMounted,
  onBeforeUnmount,
  getCurrentInstance,
} from "vue";
import { useStore } from "vuex";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import * as siteConfig from "@/site-config/site.json";
import IconGitHub from "@/components/icons/IconGitHub.vue";
import IconRemove from "@/components/icons/IconRemove.vue";

const store = useStore();
const instance = getCurrentInstance();

const profile = computed(() => store.state.profile);
const loading = ref(false);
const isDeleteDialogVisible = ref(false);
const githubProfile = ref({});
const oauthWindow = ref(null);

const hasGithubProfile = computed(() => {
  // Check both the local githubProfile and the store's profile
  return !!(githubProfile.value?.login || profile.value?.githubProfile?.login);
});

// Get the actual GitHub profile data from either local or store
const displayGithubProfile = computed(() => {
  return githubProfile.value?.login
    ? githubProfile.value
    : profile.value?.githubProfile || {};
});

const GithubProfileUrl = `${siteConfig.api2Url}/accounts/github/user`;

onMounted(() => {
  window.addEventListener("message", messageEventListener);
  initializeGithubData();
});

onBeforeUnmount(() => {
  window.removeEventListener("message", messageEventListener);
});



async function initializeGithubData() {
  loading.value = true;

  // First try to fetch fresh GitHub data from API
  await fetchGithubProfile();

  // If API fetch fails, fall back to store data
  if (!githubProfile.value?.login && profile.value?.githubProfile) {
    githubProfile.value = profile.value.githubProfile;
  }

  loading.value = false;
}

async function fetchGithubProfile() {
  try {
    const token = await useGetToken();
    const response = await fetch(
      GithubProfileUrl,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "*/*",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();

      if (data && data.login) {
        githubProfile.value = data;

        // Update store with fresh data - ensure we're updating the githubProfile property
        const updatedProfile = {
          ...profile.value,
          githubProfile: data,
        };

        store.dispatch("updateProfile", updatedProfile);

        console.log("Updated store with GitHub profile:", data);
      }
    } else {
      console.error(
        "GitHub API response not ok:",
        response.status,
        response.statusText
      );
    }
  } catch (error) {
    console.error("Failed to fetch GitHub profile:", error);
    // We'll fall back to store data in initializeGithubData
  }
}

function openGitHub() {
  const redirectUri = `${window.location.origin}/github-redirect`;
  const url = `${siteConfig.githubAppUrl}?redirect_uri=${redirectUri}`;

  oauthWindow.value = window.open(
    url,
    "_blank",
    "toolbar=no, scrollbars=yes, width=600, height=800, top=200, left=500"
  );
}

const messageEventListener = async (event) => {
  if (
    event.data &&
    event.data.source &&
    event.data.source === "github-redirect-response" &&
    event.data.code
  ) {
    const oauthCode = event.data.code;
    if (oauthCode !== "") {
      try {
        const token = await useGetToken();



        const response = await useSendXhr(
          `${siteConfig.api2Url}/accounts/github/register`,
          {
            method: "POST",
            header: {
              'Authorization': `Bearer ${token}`
            },
            body: {
              code: oauthCode,
              installation_id: event.data.installationId,
            },
          }
        );

        githubProfile.value = response;
        window.removeEventListener("message", messageEventListener);

        instance.proxy.$message({
          message: "Your GitHub account has been successfully added!",
          type: "success",
          center: true,
          duration: 3000,
          showClose: true,
        });

        // Update store with fresh GitHub data
        const updatedProfile = {
          ...profile.value,
          githubProfile: response,
        };

        store.dispatch("updateProfile", updatedProfile);
        console.log(
          "Updated store with GitHub profile after registration:",
          response
        );
      } catch (error) {
        console.error("GitHub registration error:", error);
        instance.proxy.$message({
          message: "Failed to connect GitHub account. Please try again.",
          type: "error",
          center: true,
          duration: 5000,
          showClose: true,
        });
      }
    }
  }
};

async function confirmDelete() {
  try {
    const token = await useGetToken();
    await useSendXhr(GithubProfileUrl, {
      method: "DELETE",
      header: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    githubProfile.value = {};
    isDeleteDialogVisible.value = false;

    // Update store
    store.dispatch("updateProfile", {
      ...profile.value,
      githubProfile: null,
    });

    instance.proxy.$message({
      message: "Your GitHub account has been successfully removed",
      type: "success",
      center: true,
      duration: 3000,
      showClose: true,
    });
  } catch (error) {
    console.error("GitHub deletion error:", error);
    instance.proxy.$message({
      message: "Failed to remove GitHub account. Please try again.",
      type: "error",
      center: true,
      duration: 5000,
      showClose: true,
    });
  }
}
</script>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.user-github-container {
  margin: 0;
}

.github-content {
  h2 {
    font-weight: 300;
    font-size: 20px;
    margin-top: 0;
    color: theme.$gray_6;
    margin-bottom: 8px;
  }

  h3 {
    font-weight: 500;
    font-size: 18px;
    color: theme.$gray_6;
    margin: 32px 0 16px 0;
  }

  p {
    margin-bottom: 20px;
    font-weight: 300;
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;

    a {
      color: theme.$purple_2;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

.loading {
  color: theme.$gray_4;
  padding: 16px 0;
  text-align: center;
}

.github-connect {
  margin: 32px 0;
}

.github-connected {
  margin: 32px 0;
}

.github-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 16px;

  .github-header-content {
    flex: 1;

    .github-success-text {
      margin: 0;
    }
  }

  .github-header-actions {
    flex-shrink: 0;

    .view-repositories-link {
      color: theme.$purple_2;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;

      &:hover {
        color: theme.$purple_1;
        text-decoration: underline;
      }

      &:active {
        color: theme.$purple_3;
      }
    }
  }
}

.integration-success {
  border: 1px solid theme.$gray_2;
  padding: 16px;
  display: flex;
  align-items: center;
  background: white;
  border-radius: 4px;
  max-width: 500px;

  .link {
    margin-left: 16px;
    color: theme.$purple_2;
    text-decoration: none;
    flex: 1;
    font-family: monospace;
    font-size: 14px;

    &:hover {
      text-decoration: underline;
    }
  }

  .delete-button {
    background: none;
    border: none;
    color: theme.$gray_4;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;

    &:hover {
      color: theme.$red_1;
      background: rgba(theme.$red_1, 0.1);
    }
  }
}

// Element Plus dialog styling
:deep(.el-dialog__header) {
  padding: 20px 20px 0 20px;
}

:deep(.el-dialog__body) {
  padding: 20px;

  ul {
    margin: 16px 0;
    padding-left: 20px;

    li {
      margin-bottom: 8px;
      color: theme.$gray_5;
    }
  }
}

:deep(.el-dialog__footer) {
  padding: 0 20px 20px 20px;
}
</style>
