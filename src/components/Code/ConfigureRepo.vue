<template>
  <bf-stage class="configure-repo-wrapper">
    <el-form
      ref="updateCodeRepoForm"
      :model="form"
      label-width="120px"
      label-position="top"
      class="form-auto-save"
    >
      <el-form-item class="auto-publish-input">
        <el-checkbox v-model="form.isAutoPublished" @change="submitUpdateDatasetRequest"
          >Automatic publication</el-checkbox
        >
        <p>Automatically publish a version on new releases from GitHub</p>
      </el-form-item>

      <el-form-item>
        <template #label>
          Repository Name
          <span class="label-helper"> (GitHub) </span>
        </template>
        <el-input v-model="form.repoName" disabled />
      </el-form-item>

      <el-form-item>
        <template #label>
          Name
          <span class="label-helper"> required </span>
        </template>
        <el-input
          v-model="form.givenName"
          placeholder="user-test"
          @input="submitUpdateDatasetRequest"
        />
      </el-form-item>

      <el-form-item>
        <template #label>
          Subtitle
          <span class="label-helper"> required to publish </span>
        </template>
        <character-count-input
          v-model="form.description"
          :rows="3"
          placeholder="Add a description to help others understand what's in your code repo"
          @input="submitUpdateDatasetRequest"
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
            v-for="tag in form.tags"
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
import { Ref, onMounted, ref} from "vue";
import { mapActions } from "vuex";
import { ElMessage } from "element-plus";
import { useRoute } from "vue-router";
import debounce from "lodash.debounce";
import { compose, defaultTo, toLower, trim, propOr, includes } from "ramda";
import StaleUpdateDialog from "../datasets/stale-update-dialog/StaleUpdateDialog.vue";

interface CodeRepoConfig {
  isAutoPublished: boolean;
  repoName: string;
  givenName: string;
  description: string;
  tags: Array<string>;
}
let route = useRoute();
let inputTag = ref("");
const form: Ref<CodeRepoConfig> = ref({
  isAutoPublished: false,
  repoName: "",
  givenName: "",
  description: "",
  tags: [],
});

// mapActions(['updateDataset', 'setDatasetEtag']);
// const mapstate = mapState(['concepts','datasetEtag','dataset','datasets']);

onMounted(() => {
  if (route.params.repoName) {
    form.value.repoName = <string>route.params.repoName;
  }
});

//update the database
const updateCodeRepoForm = ref();
const saveRepo = mapActions('codeReposModule',['saveRepoSettings'])
//import codeReposModule from "../../store/codeReposModule";
const submitUpdateDatasetRequest = debounce(function () {
  updateCodeRepoForm.value?.validate(valid => {
    // only the name field is validated in this form.  if it is invalid, remove it from he payload.
    const { repoName, ...rest } = form
    const body = valid ? form : rest

     saveRepo.saveRepoSettings({ repo: body });
     //  codeReposModule.saveRepoSettings({ repo: body });
  })
}, 1000);


const onUpdateDescription= function(description) {
  this.form.description = description
  this.submitUpdateDatasetRequest()
}


const checkIfTagExists = (tag) => {
  const formTags: Array<string> = propOr([], "tags", form.value);
  const tagExistsForm = includes(tag, formTags);

  return tagExistsForm;
};

const addTag = function () {
  const tag = compose(trim, toLower, defaultTo(""))(inputTag.value);

  if (tag) {
    inputTag.value = "";

    const tagExists = checkIfTagExists(tag);
    if (tagExists === false) {
      form.value.tags.push(tag);
      submitUpdateDatasetRequest();
    }
  }
};

const removeTag = function (tag) {
  const tagId = form.value.tags.indexOf(tag);
  form.value.tags.splice(tagId, 1);
  submitUpdateDatasetRequest();
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
