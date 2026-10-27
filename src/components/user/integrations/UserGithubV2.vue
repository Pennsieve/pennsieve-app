<template>
  <div class="github-integration">
    <!-- Back link -->
    <router-link :to="{ name: 'my-code' }" class="back-link">
      <IconArrowLeft :height="10" :width="10" color="currentColor" />
      My Repositories
    </router-link>

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
      <!-- The GitHub app's permissions were updated: installations made
           before need an owner to accept them on GitHub. -->
      <div v-if="hasGithubProfile && review.count" class="review-banner" role="status">
        <span>
          Pennsieve's GitHub app was updated —
          {{ review.count }} installation{{ review.count === 1 ? "" : "s" }} need{{ review.count === 1 ? "s" : "" }} your approval.
        </span>
        <!-- One review link per installation (named when there are several). -->
        <span class="review-actions">
          <a
            v-for="inst in review.pending"
            :key="inst.id"
            :href="inst.review_url"
            target="_blank"
            rel="noopener noreferrer"
            class="review-btn"
            >{{ review.single ? "Review on GitHub" : `Review ${inst.name}` }}</a
          >
        </span>
      </div>

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
            >View profile on GitHub</a
          >
        </div>

        <!-- Not Connected -->
        <div v-if="!hasGithubProfile" class="connection-empty">
          <div class="connection-empty-content">
            <IconGitHub :height="32" :width="32" />
            <div class="connection-empty-copy">
              <h3>GitHub account not linked</h3>
              <p>
                Register the Pennsieve GitHub Application in your GitHub account
                and authorize Pennsieve to receive release events.
                <a
                  href="https://docs.pennsieve.io/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  >Learn more &rarr;</a
                >
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
                >{{ displayGithubProfile.html_url }}</a
              >
            </div>
          </div>
          <div class="info-actions">
            <router-link :to="{ name: 'my-code' }" class="text-link-btn">
              View my repositories &rarr;
            </router-link>
          </div>
        </template>
      </div>

      <!-- Update GitHub App Permissions -->
      <div v-if="hasGithubProfile" class="management-section">
        <div class="section-header">
          <h2>Repository Access</h2>
        </div>
        <div class="danger-content">
          <div class="danger-info">
            <p>
              Change which repositories the Pennsieve GitHub App can read, or
              update the installation's permissions on GitHub.
            </p>
          </div>
          <el-button @click="updateGithubIntegration">
            Update Integration
          </el-button>
        </div>
        <!-- Installations that haven't accepted the updated permissions -->
        <ul v-if="review.count" class="review-list">
          <li v-for="inst in review.pending" :key="inst.id" class="review-item">
            <div class="review-copy">
              <span class="review-name">
                <img v-if="inst.avatar_url" :src="inst.avatar_url" alt="" class="review-avatar" />
                {{ inst.name }}
              </span>
              <p>
                Pennsieve's GitHub permissions were updated. Approve them to let
                Pennsieve open pull requests, such as adding an app.yml.
              </p>
              <p v-if="isOrganization(inst)" class="review-note">
                Only owners of {{ inst.name }} can approve.
              </p>
            </div>
            <a
              :href="inst.review_url"
              target="_blank"
              rel="noopener noreferrer"
              class="review-btn"
              >Review on GitHub</a
            >
          </li>
        </ul>
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
            Releases get a DOI and a public landing page on Pennsieve Discover.
          </li>
          <li>
            <strong>App Store publishing.</strong>
            Selected repositories can be published as applications usable in
            compute workflows.
          </li>
        </ul>
      </div>

      <!-- Danger Zone -->
      <div v-if="hasGithubProfile" class="management-section danger-section">
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
          Pennsieve will no longer track GitHub repositories in your account.
        </li>
        <li>
          GitHub releases will no longer result in Pennsieve GitHub
          Publications.
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
import { computed, ref, onMounted, onBeforeUnmount, getCurrentInstance } from "vue";
import { useStore } from "vuex";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import { useGithubOAuth } from "@/composables/useGithubOAuth";
import * as siteConfig from "@/site-config/site.json";
import IconGitHub from "@/components/icons/IconGitHub.vue";
import IconArrowLeft from "@/components/icons/IconArrowLeft.vue";
import { reviewSummary, isOrganization } from "./githubInstallations";

const store = useStore();
const instance = getCurrentInstance();

const profile = computed(() => store.state.profile);
const loading = ref(false);
const isDeleteDialogVisible = ref(false);

const displayGithubProfile = computed(() => profile.value?.githubProfile || {});
const hasGithubProfile = computed(() => !!displayGithubProfile.value.login);

const GithubProfileUrl = `${siteConfig.api2Url}/accounts/github/user`;

const {
  openGithubOAuth: updateGithubIntegration,
  fetchGithubProfile,
} = useGithubOAuth({
  refreshRepos: true,
});
const openGitHub = updateGithubIntegration;

// The Pennsieve app's installations, and which still have to accept its
// updated permissions on GitHub (github-service's needs_review).
const installations = ref([]);
const review = computed(() => reviewSummary(installations.value));
async function fetchInstallations() {
  if (!hasGithubProfile.value) return;
  try {
    const token = await useGetToken();
    const res = await useSendXhr(`${siteConfig.api2Url}/github/installations`, {
      header: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    installations.value = res?.installations || [];
  } catch (error) {
    // The notice is extra: without the list, the card works as before.
    installations.value = [];
  }
}
// Back from GitHub (approved in another tab): check again, so the notice clears.
function onVisible() {
  if (document.visibilityState === "visible") fetchInstallations();
}

onMounted(async () => {
  loading.value = true;
  await fetchGithubProfile();
  loading.value = false;
  fetchInstallations();
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", fetchInstallations);
});
onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", onVisible);
  window.removeEventListener("focus", fetchInstallations);
});

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

    isDeleteDialogVisible.value = false;

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

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: theme.$purple_3;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 16px;

  &:hover {
    text-decoration: underline;
  }
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

/* The GitHub app was updated: installations to approve. */
.review-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  padding: 12px 16px;
  border: 1px solid theme.$orange_1;
  border-radius: 3px;
  background: theme.$orange_tint;
  font-size: 14px;
  color: theme.$gray_6;
}
.review-actions {
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
  gap: 8px;
}
.review-list {
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid theme.$gray_2;
}
.review-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid theme.$gray_2;

  p {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: theme.$gray_5;
  }
}
.review-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: theme.$gray_6;
}
.review-avatar {
  width: 20px;
  height: 20px;
  border-radius: 3px;
}
.review-note {
  color: theme.$gray_4 !important;
}
.review-btn {
  flex-shrink: 0;
  padding: 4px 12px;
  border: 1px solid theme.$gray_3;
  border-radius: 3px;
  background: theme.$white;
  font-size: 13px;
  white-space: nowrap;
  color: theme.$gray_6;
  text-decoration: none;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
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
        font-family: "Courier New", monospace;
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
