<template>
  <div class="github-integration">
    <!-- Header -->
    <div class="page-header">
      <h1>GitHub Integration</h1>
      <p class="page-subtitle">
        Connect a GitHub account so Pennsieve can track and publish releases
        from your repositories.
      </p>
    </div>

    <div v-if="loading" class="loading">Loading...</div>

    <template v-else>
      <!-- Connection Status -->
      <div class="management-section">
        <div class="section-header">
          <h2>Connection</h2>
          <a
            v-if="hasGithubProfile"
            :href="displayGithubProfile.html_url"
            target="_blank"
            rel="noopener noreferrer"
            class="section-link"
          >View profile on GitHub</a>
        </div>

        <!-- Not Connected -->
        <div v-if="!hasGithubProfile" class="connection-empty">
          <div class="connection-empty-content">
            <IconGitHub :height="32" :width="32" />
            <div class="connection-empty-copy">
              <h3>GitHub account not linked</h3>
              <p>
                Register the Pennsieve GitHub Application in your GitHub
                account and authorize Pennsieve to receive release events.
                <a
                  href="https://docs.pennsieve.io/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                >Learn more &rarr;</a>
              </p>
            </div>
          </div>
          <el-button type="primary" @click="openGitHub">
            Register GitHub Account
          </el-button>
        </div>

        <!-- Connected -->
        <template v-else>
          <div class="info-content">
            <div class="info-row">
              <span class="info-label">Status</span>
              <span class="info-value">
                <span class="status-pill linked">
                  <span class="status-dot" />
                  Linked
                </span>
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">GitHub User</span>
              <span class="info-value mono">
                <IconGitHub :height="14" :width="14" color="currentColor" />
                {{ displayGithubProfile.login }}
              </span>
            </div>
            <div v-if="displayGithubProfile.html_url" class="info-row">
              <span class="info-label">Profile URL</span>
              <a
                :href="displayGithubProfile.html_url"
                target="_blank"
                rel="noopener noreferrer"
                class="info-value info-url"
              >{{ displayGithubProfile.html_url }}</a>
            </div>
          </div>
          <div class="info-actions">
            <router-link :to="{ name: 'my-code' }" class="text-link-btn">
              View my repositories &rarr;
            </router-link>
          </div>
        </template>
      </div>

      <!-- What this enables -->
      <div class="management-section">
        <div class="section-header">
          <h2>What this enables</h2>
        </div>
        <ul class="capability-list">
          <li>
            <strong>Tracked releases.</strong>
            Each tag you push triggers Pennsieve to archive that version.
          </li>
          <li>
            <strong>Citable DOIs.</strong>
            Releases get a DOI and a public landing page on Pennsieve
            Discover.
          </li>
          <li>
            <strong>App Store publishing.</strong>
            Selected repositories can be published as applications usable in
            compute workflows.
          </li>
        </ul>
      </div>

      <!-- Danger Zone -->
      <div
        v-if="hasGithubProfile"
        class="management-section danger-section"
      >
        <div class="section-header">
          <h2>Danger Zone</h2>
        </div>
        <div class="danger-content">
          <div class="danger-info">
            <p>
              Removing the GitHub link stops repository tracking, prevents
              future GitHub-driven publications, and disables creation of new
              Pennsieve applications and workflows from your code.
            </p>
          </div>
          <el-button type="danger" @click="isDeleteDialogVisible = true">
            Disconnect GitHub
          </el-button>
        </div>
      </div>
    </template>

    <!-- Disconnect Confirmation -->
    <el-dialog
      v-model="isDeleteDialogVisible"
      title="Disconnect GitHub Integration?"
      width="500px"
      :close-on-click-modal="false"
    >
      <p>
        Are you sure you want to remove your linked GitHub account from your
        Pennsieve user profile?
      </p>
      <ul>
        <li>
          Pennsieve will no longer track GitHub repositories in your
          account.
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
        <div class="dialog-footer">
          <el-button @click="isDeleteDialogVisible = false">Cancel</el-button>
          <el-button type="danger" @click="confirmDelete">Confirm</el-button>
        </div>
      </template>
    </el-dialog>
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

.github-integration {
  max-width: 900px;
  margin: 0;
  padding: 0;
}

.page-header {
  margin-bottom: 32px;

  h1 {
    font-size: 28px;
    font-weight: 300;
    color: theme.$gray_6;
    margin: 0 0 12px 0;
  }

  .page-subtitle {
    font-size: 14px;
    color: theme.$gray_5;
    margin: 0;
    line-height: 1.5;
    max-width: 700px;
  }
}

.loading {
  color: theme.$gray_4;
  padding: 32px 0;
  text-align: center;
}

.management-section {
  background: white;
  border: 1px solid theme.$gray_2;
  margin-bottom: 32px;
  padding: 28px 32px;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
    padding-bottom: 20px;
    border-bottom: 1px solid theme.$gray_2;

    h2 {
      font-size: 20px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0;
    }

    .section-link {
      color: theme.$purple_3;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  &.danger-section {
    border-color: rgba(theme.$red_2, 0.2);

    .section-header {
      border-bottom-color: rgba(theme.$red_2, 0.2);
      margin-bottom: 20px;
      padding-bottom: 16px;

      h2 {
        color: theme.$red_2;
      }
    }
  }
}

.connection-empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}

.connection-empty-content {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.connection-empty-copy {
  flex: 1;

  h3 {
    font-size: 16px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 6px 0;
  }

  p {
    margin: 0;
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;

    a {
      color: theme.$purple_3;
      text-decoration: none;
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

.info-content {
  .info-row {
    display: flex;
    padding: 14px 0;
    border-bottom: 1px solid theme.$gray_1;
    gap: 16px;

    &:last-child {
      border-bottom: none;
    }

    .info-label {
      flex: 0 0 160px;
      color: theme.$gray_5;
      font-weight: 500;
      font-size: 14px;
    }

    .info-value {
      flex: 1;
      color: theme.$gray_6;
      font-size: 14px;
      word-break: break-word;
      display: inline-flex;
      align-items: center;
      gap: 6px;

      &.mono {
        font-family: 'Courier New', monospace;
        font-size: 13px;
      }
    }

    a.info-value,
    a.info-url {
      color: theme.$purple_3;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

.info-actions {
  margin-top: 16px;
}

.text-link-btn {
  background: none;
  border: none;
  color: theme.$purple_3;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 0;
  text-decoration: none;
  display: inline-block;

  &:hover {
    text-decoration: underline;
  }
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  &.linked {
    background: rgba(theme.$status_green, 0.12);
    color: theme.$status_green;

    .status-dot {
      background: theme.$status_green;
    }
  }
}

.capability-list {
  margin: 0;
  padding-left: 20px;

  li {
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    strong {
      color: theme.$gray_6;
      font-weight: 600;
    }
  }
}

.danger-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;

  .danger-info p {
    margin: 0;
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;
  }
}

.dialog-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

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
