<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import BfButton from "~/components/Shared/BfButton/BfButton.vue";
import IconRemove from "~/components/Icons/IconRemove.vue";

import { useMainStore } from "~/store";
import { pathOr } from "ramda";
import IconGitHub from "~/components/Icons/IconGitHub.vue";
import { useGetToken } from "~/composables/useGetToken";
import DeleteGithubModal from "~/components/Account/Profile/DeleteGithubModal.vue";
import RepoListItem from "~/components/Account/Profile/Repositories/RepoListItem.vue";
import ChangeRepoTrackingDialog from "~/components/Account/Profile/Repositories/ChangeRepoTrackingDialog.vue";
import PublishingDialog from "./Repositories/PublishingDialog.vue";

const store = useMainStore();
const { profile } = storeToRefs(store);
const runtimeConfig = useRuntimeConfig();
const GithubProfileUrl = `${runtimeConfig.public.api2_host}/accounts/github/user`;

const GithubRegisterUrl = `${runtimeConfig.public.api2_host}/accounts/github/register`;
const GitHubAppUrl = runtimeConfig.public.gitHub_app_url;
const oauthWindow = ref({});
const loading = ref(false);

const { data: githubProfile, status: myProfileStatus } = await useFetch(
  GithubProfileUrl,
  {
    lazy: true,
    server: false,
    headers: { Authorization: `Bearer ${await useGetToken()}` },
  }
);

defineProps({
  hideLinkRepos: {
    type: Boolean,
    default: false,
  },
  showMyRepos: {
    type: Boolean,
    default: false,
  },
});

//  ==== REPOSITORIES ====
const totalRepoCount = ref(0);
const showPublishingDialog = ref(false);

const myRepoPage = ref(1);
const myRepoPageSize = ref(25);
const myReposUrl = computed(
  () =>
    `${runtimeConfig.public.api2_host}/repositories?page=${myRepoPage.value}&size=${myRepoPageSize.value}`
);

const {
  data: myRepos,
  status: myRepoStatus,
  refresh: refreshRepos,
} = await useFetch(myReposUrl, {
  lazy: true,
  server: false,
  headers: {
    Authorization: `Bearer ${await useGetToken()}`,
    Accept: "application/json",
  },
  onResponse({ request, response, options }) {
    // Make sure response.count exists
    if (response._data && response._data.count !== undefined) {
      totalRepoCount.value = response._data.count;
    }
  },
}).catch((error) => {
  console.log(error);
});

const hasGithubProfile = computed(() => {
  try {
    return githubProfile.value?.login.length > 0;
  } catch {
    return false;
  }
});

function handleEventListener(event) {
  if (
    event.data &&
    event.data.source &&
    event.data.source === "github-redirect-response" &&
    event.data.code
  ) {
    let oauthCode = event.data.code;
    if (oauthCode !== "") {
      useGetToken()
        .then((token) => {
          return useSendXhr(GithubRegisterUrl, {
            method: "POST",
            header: {
              Authorization: `Bearer ${token}`,
            },
            body: {
              code: oauthCode,
              installation_id: event.data.installationId,
            },
          });
        })
        .then((response) => {
          githubProfile.value = response;

          window.removeEventListener("message", handleEventListener);

          ElMessage.success("Your Github account has been successfully added!");
        })
        .catch((err) => {
          ElMessage.error(
            "Sorry! There was a problem removing your Github account."
          );
        });
    }
  }
}

function openGitHub() {
  const url = `${GitHubAppUrl}?redirect_uri=${window.location.origin}/github-redirect`;
  oauthWindow.value = window.open(
    url,
    "_blank",
    "toolbar=no, scrollbars=yes, width=600, height=800, top=200, left=500"
  );
  window.addEventListener("message", handleEventListener);
}

// ==== Delete Modal ====
const deleteModalVisible = ref(false);

function closeDeleteDialog() {
  deleteModalVisible.value = false;
}

function deleteSuccess() {
  deleteModalVisible.value = false;
  githubProfile.value = {};
}

function updatePage(event) {
  myRepoPage.value = event;
}

// ==== ENABLE / DISABLE TRACKING ====

const selectedRepo = ref({});

function openPublishingDialog(repoName) {
  selectedRepo.value = myRepos.value.repos.find(
    (repo) => repo.name === repoName
  );
  showPublishingDialog.value = true;
}

function closePublishingDialog() {
  showPublishingDialog.value = false;
}

async function savePublishingSettings() {
  showPublishingDialog.value = false;
  await refreshRepos();
}
</script>

<template>
  <div class="github-integration-container">
    <div v-if="!hideLinkRepos" class="card">
      <div class="card-header">
        <h2>Link your GitHub account</h2>
      </div>
      <div class="card-content">
        <p class="github-requirements">
          When you link your GitHub account to your Pennsieve account, you can
          select to track and publish repositories on Pennsieve. Each time you
          generate a release on a tracked repository, Pennsieve will archive the
          version, create a citable DOI and generate a landing page for that
          specific version of your code.
        </p>

        <div v-if="myProfileStatus === 'pending'" class="loading">
          Loading...
        </div>
        <div v-else>
          <div v-if="!hasGithubProfile">
            <p>
              Register the Pennsieve GitHub Application in your Github account,
              and authorize Pennsieve to get notified about events.
              <a href="https://docs.pennsieve.io/docs"> Learn More </a>
            </p>
            <bf-button @click="openGitHub" :prevent-click-event="true">
              Register your GitHub Account
            </bf-button>
          </div>
          <div v-else>
            <p class="github-success-text">
              You have successfully linked your GitHub Account and installed the
              Pennsieve Github Application.
              <a
                href="https://docs.pennsieve.io/docs/github-integration"
                target="_blank"
              >
                Learn More
              </a>
            </p>
            <div class="integration-success">
              <IconGitHub :height="30" :width="30" />
              <a class="link" :href="githubProfile.html_url" target="_blank">
                {{ githubProfile.login }}
              </a>
              <button class="delete" @click="deleteModalVisible = true">
                <IconRemove :height="10" :width="10" color="black" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showMyRepos" class="card">
      <div class="card-header">
        <h2>My GitHub Repositories</h2>
      </div>
      <div class="card-content">
        <p>
          Repositories can be published publically to Discover and/ or to the
          App Store for users to include as part of analytic pipelines
        </p>

        <div v-if="myProfileStatus === 'pending'" class="loading">
          Loading...
        </div>
        <div v-else-if="!hasGithubProfile" class="note">
          No GitHub account registered
        </div>
        <div v-else>
          <div v-if="myRepoStatus === 'pending'" class="loading">
            Loading...
          </div>
          <div v-else>
            <div v-if="myRepoStatus === 'success'" class="repo-wrapper">
              <el-pagination
                :page-size="myRepoPageSize"
                :current-page="myRepoPage"
                layout="prev, pager, next"
                :total="totalRepoCount"
                @current-change="updatePage"
                class="pagination"
              />
              <RepoListItem
                v-for="(repo, index) in myRepos.repos"
                :key="repo.name"
                :repo="repo"
                @manage-settings="openPublishingDialog"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <delete-github-modal
      :visible="deleteModalVisible"
      @deleted-success="deleteSuccess"
      @close-dialog="closeDeleteDialog"
    />

    <publishing-dialog
      :repo="selectedRepo"
      :dialog-visible="showPublishingDialog"
      @save-publishing-settings="savePublishingSettings"
      @close="closePublishingDialog"
    />
  </div>
</template>

<style scoped lang="scss">
.github-integration-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1200px;
}

.card-header {
  border-bottom: none;

  h2 {
    font-size: 18px;
    font-weight: 600;
    color: #333333;
    margin: 0 0 16px 0;
  }
}

.repo-wrapper {
  margin-top: 16px;

  .pagination {
    justify-content: flex-end;
    color: #666666;
    margin-bottom: 16px;
  }
}

.loading {
  color: #999999;
  padding: 16px 0;
}

.note {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  padding: 12px 16px;
  border-radius: 4px;
  margin: 16px 0;
  font-size: 14px;
  color: #856404;
}

p {
  margin-bottom: 16px;
  font-size: 14px;
  color: #666666;
  line-height: 1.5;
}

.github-requirements {
  margin-bottom: 20px;
}

.github-success-text {
  margin-bottom: 16px;

  a {
    color: #007bff;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.integration-success {
  border: 1px solid #e5e5e5;
  padding: 16px;
  display: flex;
  align-items: center;
  background: #ffffff;
  border-radius: 4px;
  max-width: 400px;

  .link {
    margin-left: 16px;
    color: #007bff;
    text-decoration: none;
    flex: 1;

    &:hover {
      text-decoration: underline;
    }
  }

  .delete {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    border-radius: 2px;

    &:hover {
      background: #f5f5f5;
    }
  }
}
</style>
