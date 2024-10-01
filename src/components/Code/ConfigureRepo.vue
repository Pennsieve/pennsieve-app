<template>
  <bf-stage class="configure-repo-wrapper">
    <el-form
      :model="codeRepoForm"
      label-width="120px"
      label-position="top"
      class="form-auto-save"
    >
      <el-form-item class="auto-publish-input">
        <el-checkbox
          v-model="codeRepoForm.isAutoPublished"
          @change="saveRepoConfig"
          >Automatic publication</el-checkbox
        >
        <p>Automatically publish a version on new releases from GitHub</p>
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
        <character-count-input
          v-model="codeRepoForm.description"
          :rows="3"
          placeholder="Add a description to help others understand what's in your code repo"
          @blur="saveRepoConfig"
        />
      </el-form-item>

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
import { Ref, onMounted, ref } from "vue";
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import debounce from "lodash.debounce";
import { compose, defaultTo, toLower, trim, propOr, includes } from "ramda";

interface CodeRepoConfig {
  isAutoPublished: boolean;
  givenName: string;
  description: string;
  tags: Array<string>;
}

const store = useStore();
let route = useRoute();

let activeRepoName = ref("");
let inputTag = ref("");
let repo = ref({});

const codeRepoForm: Ref<CodeRepoConfig> = ref({
  isAutoPublished: false,
  givenName: "",
  description: "",
  tags: [],
});

onMounted(() => {
  if (route.params.repoId) {
    const activeRepoId = route.params.repoId;
    console.log("activeRepoId", activeRepoId);
    store.commit("codeReposModule/SET_ACTIVE_CODE_REPO", activeRepoId);
  }
  repo.value = store.getters["codeReposModule/activeRepo"];

  // update initial form values from the database
  if (repo.value && repo.value.content) {
    console.log("repo", repo);
    activeRepoName.value = repo.value.content.name;
    codeRepoForm.value.givenName = repo.value.content.name;
    codeRepoForm.value.description = repo.value.content.description;
    codeRepoForm.value.tags = repo.value.content.tags;
  }
});

const saveRepoConfig = debounce(function () {
  store.dispatch("codeReposModule/saveRepoSettings", {
    formVal: codeRepoForm.value,
    repo,
  });
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

    if (tagExists === false) {
      codeRepoForm.value.tags.push(tag);
      saveRepoConfig();
    }
  }
};

const removeTag = function (tag) {
  const tagId = codeRepoForm.value.tags.indexOf(tag);
  codeRepoForm.value.tags.splice(tagId, 1);
  saveRepoConfig();
};
</script>

<style lang="scss">
.configure-repo-wrapper {
  .form-auto-save p {
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
}
</style>
