<template>
  <!-- As the other restyled pages: the title row says where this is; a line
       on what it's for, then quiet sections under small headings. -->
  <div class="github-integration">
    <p class="gh-intro">
      Pennsieve's GitHub App reads releases of the repositories you choose, to
      publish them as apps or archive them with a DOI.
      <router-link :to="{ name: 'my-code' }" class="gh-link">My Code &rarr;</router-link>
    </p>

    <div v-if="loading" class="gh-state">
      <div class="spinner" />
      <p>Loading GitHub integration…</p>
    </div>

    <!-- Not connected: what it's for, and connect -->
    <div v-else-if="!hasGithubProfile" class="gh-state">
      <IconGitHub :width="40" :height="40" color="#9ca3af" />
      <span class="gh-state-title">GitHub isn't connected</span>
      <ul class="capability-list">
        <li><strong>Apps.</strong> Each release of a repository becomes an app that workflows can run.</li>
        <li><strong>Citable DOIs.</strong> Releases get a DOI and a landing page on Pennsieve Discover.</li>
        <li><strong>Tracked releases.</strong> Pennsieve archives each version you release.</li>
      </ul>
      <bf-button @click="openGitHub">Connect GitHub</bf-button>
      <a href="https://docs.pennsieve.io/docs" target="_blank" rel="noopener noreferrer" class="gh-link">
        Learn more &rarr;
      </a>
    </div>

    <template v-else>
      <!-- The GitHub app's permissions were updated: installations made
           before need an owner to accept them on GitHub. -->
      <div v-if="review.count" class="review-banner" role="status">
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

      <section class="gh-section">
        <h2 class="gh-heading">Connection</h2>
        <dl class="gh-rows">
          <div class="gh-row">
            <dt>Status</dt>
            <dd><span class="gh-pill is-on">Linked</span></dd>
          </div>
          <div class="gh-row">
            <dt>Account</dt>
            <dd>
              <a
                v-if="displayGithubProfile.html_url"
                :href="displayGithubProfile.html_url"
                target="_blank"
                rel="noopener noreferrer"
                class="gh-account"
              >
                <IconGitHub :height="14" :width="14" color="currentColor" />
                {{ displayGithubProfile.login }}
              </a>
              <span v-else class="gh-account">
                <IconGitHub :height="14" :width="14" color="currentColor" />
                {{ displayGithubProfile.login }}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section class="gh-section">
        <h2 class="gh-heading">Repository access</h2>
        <div class="gh-action-row">
          <p>
            Change which repositories the Pennsieve GitHub App can read, or
            update the installation's permissions on GitHub.
          </p>
          <bf-button class="secondary" @click="updateGithubIntegration">Update on GitHub</bf-button>
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
      </section>

      <section class="gh-section">
        <h2 class="gh-heading">Disconnect</h2>
        <div class="gh-action-row">
          <p>
            Pennsieve stops tracking your repositories, and new releases are no
            longer published as apps or to Discover.
          </p>
          <bf-button class="red" @click="isDeleteDialogVisible = true">Disconnect GitHub</bf-button>
        </div>
      </section>
    </template>

    <!-- Disconnect Confirmation -->
    <el-dialog
      v-model="isDeleteDialogVisible"
      title="Disconnect GitHub?"
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
          <bf-button class="secondary" @click="isDeleteDialogVisible = false">Cancel</bf-button>
          <bf-button class="red" @click="confirmDelete">Disconnect</bf-button>
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
import BfButton from "@/components/shared/bf-button/BfButton.vue";
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
@use "../../../styles/_theme.scss" as theme;

.github-integration {
  max-width: 720px;
}
.gh-intro {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 1.5;
  color: theme.$gray_5;
}
.gh-link {
  color: theme.$purple_2;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

/* Loading, or not connected: centred, as My Code's. */
.gh-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 32px;
  border: 1px solid theme.$gray_2;
  background: theme.$gray_1;
  text-align: center;

  p {
    margin: 0;
    font-size: 14px;
    color: theme.$gray_5;
  }
}
.gh-state-title {
  font-size: 16px;
  font-weight: 600;
  color: theme.$gray_6;
}
.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid theme.$gray_2;
  border-top-color: theme.$purple_2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.capability-list {
  max-width: 460px;
  margin: 0 0 4px;
  padding: 0;
  list-style: none;
  text-align: left;

  li {
    margin-bottom: 6px;
    font-size: 13px;
    line-height: 1.5;
    color: theme.$gray_5;
  }
  strong {
    font-weight: 600;
    color: theme.$gray_6;
  }
}

/* A section: a small heading (as the Notebooks sidebar's and the filter
   panel's), a thin line between sections, no box. */
.gh-section {
  padding: 20px 0;
  border-top: 1px solid theme.$gray_2;
}
.gh-heading {
  margin: 0 0 12px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_5;
}
.gh-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
}
.gh-row {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;

  dt {
    width: 96px;
    flex-shrink: 0;
    color: theme.$gray_5;
  }
  dd {
    margin: 0;
    color: theme.$gray_6;
  }
}
.gh-account {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: theme.$gray_6;
  text-decoration: none;

  &:is(a):hover {
    color: theme.$purple_3;
    text-decoration: underline;
  }
}
/* As the compute node page's status chips. */
.gh-pill {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  background: theme.$white;
  font-size: 12px;
  font-weight: 500;
  color: theme.$gray_5;

  &.is-on {
    border-color: theme.$green_1;
    background: theme.$green_tint;
    color: theme.$green_2;
  }
}
/* A line on what the action does, the button on the right. */
.gh-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;

  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: theme.$gray_5;
  }
  .bf-button {
    flex-shrink: 0;
  }
}
@media (max-width: 640px) {
  .gh-action-row {
    flex-direction: column;
    align-items: flex-start;
  }
}

/* The GitHub app was updated: installations to approve. */
.review-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
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
  margin: 16px 0 0;
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

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
