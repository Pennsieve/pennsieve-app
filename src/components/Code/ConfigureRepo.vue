<template>
  <bf-stage class="configure-repo-wrapper">
    <el-form
      :model="codeRepoForm"
      label-width="120px"
      label-position="top"
      class="form-auto-save"
    >
      <data-card
        class="mb-32 grey compact"
        title="Your code repository cannot be published until the following items have been completed:"
        :padding="false"
      >
        <checklist-item
          externalLink="https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository#creating-a-release"
          externalLinkText="Create a Release"
          :is-complete="hasRelease()"
        >
          create at least one release in your repository on GithHub
        </checklist-item>
        <checklist-item
          externalLink="https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-a-license-to-a-repository"
          externalLinkText="Add a License"
          :is-complete="hasLicense()"
        >
          add a license to your repository on GitHub
        </checklist-item>
        <checklist-item
          externalLink="https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes"
          externalLinkText="Add a README"
          :is-complete="hasReadMe()"
        >
          include a README.md file in your repo with information about your
          repository
        </checklist-item>
      </data-card>
      <el-form-item class="auto-publish-input">
        <el-checkbox
          v-model="codeRepoForm.isAutoPublished"
          @change="saveRepoConfig"
          >Automatic publication</el-checkbox
        >
        <p class="hint-text">
          Automatically publish a version on new releases from GitHub
        </p>
      </el-form-item>

      <el-form-item>
        <template #label>
          Repository Name
          <span class="label-helper"> (GitHub) </span>
        </template>
        <el-input v-model="activeRepoName" disabled />
      </el-form-item>

      <el-form-item>
        <template #label>
          Name
          <span class="label-helper"> required </span>
        </template>
        <el-input
          v-model="codeRepoForm.givenName"
          placeholder="user-test"
          @blur="saveRepoConfig"
        />
      </el-form-item>

      <el-form-item>
        <template #label>
          Subtitle
          <span class="label-helper"> required to publish </span>
        </template>
        <el-input
          v-model="codeRepoForm.description"
          :rows="3"
          placeholder="Add a description"
          @blur="saveRepoConfig"
        />
      </el-form-item>

      <div class="el-form-item">
        <dataset-settings-banner-image
          id="codeRepoBannerImage"
          :dataset="codeRepo"
          :datasetBannerURL="codeRepoBannerURL"
          :isLoadingBanner="isLoadingBanner"
          :isCodeReposDataset="true"
        />
      </div>

      <el-form-item id="inputTags">
        <template #label> Tags </template>
        <el-input
          v-model="inputTag"
          placeholder="Add tags"
          @keyup.enter.native.stop="addTag"
        >
          <template #prefix>
            <IconTag :height="20" :width="20" />
          </template>
        </el-input>

        <div class="tag-wrap">
          <bf-tag
            v-for="tag in codeRepoForm.tags"
            :key="tag"
            :label="tag"
            class="mr-8 mb-8"
            @remove="removeTag(tag)"
          />
        </div>
      </el-form-item>
    </el-form>
  </bf-stage>
</template>

<script lang="ts" setup>
import { Ref, onMounted, ref, computed } from "vue";
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import debounce from "lodash.debounce";
import { compose, defaultTo, toLower, trim, propOr, includes } from "ramda";
import DataCard from "../shared/DataCard/DataCard.vue";
import ChecklistItem from "../shared/ChecklistItem/ChecklistItem.vue";
interface CodeRepoConfig {
  isAutoPublished: boolean;
  givenName: string;
  description: string;
  tags: Array<string>;
}

const store = useStore();
const route = useRoute();

const codeRepo = computed(() => store.getters["codeReposModule/activeRepo"]);
const codeRepoBannerURL = computed(
  () => store.getters["codeReposModule/bannerURL"]
);
const isLoadingBanner = computed(
  () => store.getters["codeReposModule/isLoadingCodeRepoBanner"]
);
const activeRepoName = ref("");
const inputTag = ref("");

const codeRepoForm: Ref<CodeRepoConfig> = ref({
  isAutoPublished: false,
  givenName: "",
  description: "",
  tags: [],
});

onMounted(() => {
  if (route.params.repoId) {
    const activeRepoId = route.params.repoId;
    store.commit("codeReposModule/SET_ACTIVE_CODE_REPO", activeRepoId);
    store.dispatch("codeReposModule/fetchBanner", activeRepoId);
    store.dispatch("codeReposModule/fetchReadMe", activeRepoId);
  }
  // update initial form values from the database
  activeRepoName.value = codeRepo.value.content.name;
  codeRepoForm.value.isAutoPublished =
    codeRepo.value.content.repository.autoProcess;
  codeRepoForm.value.givenName = codeRepo.value.content.name;
  codeRepoForm.value.description = codeRepo.value.content.description;
  codeRepoForm.value.tags = codeRepo.value.content.tags;
});

const saveRepoConfig = debounce(function () {
  try {
    store.dispatch("codeReposModule/saveRepoSettings", {
      formVal: codeRepoForm.value,
      repo: codeRepo.value,
    });
  } catch (err) {
    console.error(err);
  }
}, 1000);

const checkIfTagExists = (tag) => {
  const formTags: Array<string> = propOr([], "tags", codeRepoForm.value);
  const tagExistsForm = includes(tag, formTags);

  return tagExistsForm;
};

const addTag = function () {
  const tag = compose(trim, toLower, defaultTo(""))(inputTag.value);

  if (tag) {
    inputTag.value = "";
    const tagExists = checkIfTagExists(tag);

    if (!tagExists) {
      codeRepoForm.value.tags.push(tag);
      saveRepoConfig();
    }
  }
};

/*
  Logic for the publishing checkboxes
*/
const hasRelease = () => {
  const codeRepo = computed(() => store.getters["codeReposModule/activeRepo"]);
  /*
    hasRelease condition is met when the repo has the following:
    1. The "releases" property has a value that is an array
    2. The first element in the array (the latest release) has a releaseStatus that is not "never"
    3. Has values in label and marker properties
  */
  if (codeRepo?.value) {
    const release = codeRepo?.value?.content?.releases?.[0];
    return (
      release?.releaseStatus !== "never" &&
      (release?.label?.length ?? 0) > 0 &&
      (release?.marker?.length ?? 0) > 0
    );
  }
  return false;
};

const hasLicense = () => {
  const license = codeRepo?.value?.content?.license;
  return license?.length;
};

const hasReadMe = () => {
  const codeRepo = computed(() => store.getters["codeReposModule/activeRepo"]);
  const readMe = computed(() => store.getters["codeReposModule/hasReadMe"]);
  //the presence of a Readme can be validated by the response from the GET /datasets/{id}/readme  endpoint.
  return Object.keys(readMe.value).length !== 0;
};

const removeTag = function (tag) {
  const tagId = codeRepoForm.value.tags.indexOf(tag);
  codeRepoForm.value.tags.splice(tagId, 1);
  saveRepoConfig();
};
</script>

<style lang="scss">
.configure-repo-wrapper {
  .form-auto-save .hint-text {
    margin-bottom: 0px;
  }

  .el-form-item__content {
    flex-direction: column;
    align-items: start;
  }

  .auto-publish-input .el-checkbox__label {
    font-weight: 500;
  }

  .el-input,
  .el-textarea {
    max-width: 475px;
  }

  #inputTags .el-input {
    margin-bottom: 16px;
  }

  .dataset-settings-banner-image {
    h4 {
      margin-top: 0px;
      margin-bottom: 8px;
    }
    p {
      margin-bottom: 8px;
    }
  }
}
</style>
