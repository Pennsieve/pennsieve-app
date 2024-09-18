<template>
  <bf-stage class="configure-repo-wrapper">
    <el-form
      :model="form"
      label-width="120px"
      label-position="top"
      class="form-auto-save"
    >
      <el-form-item class="auto-publish-input">
        <el-checkbox v-model="form.isAutoPublished" @change="saveForm"
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
          @input="saveForm"
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
          @input="saveForm"
        />
      </el-form-item>

      <el-form-item id="inputTags">
        <template #label> Tags </template>
        <el-input
          ref="inputTags"
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
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useRoute } from "vue-router";
import debounce from "lodash.debounce";
import {compose, defaultTo, toLower, trim} from 'ramda'

const route = useRoute();
const form = ref({
  isAutoPublished: false,
  repoName: "",
  givenName: "",
  description: "",
  tags: "",
});
// let inputTag = ref(''); 

onMounted(() => {
  if (route.params.repoName) {
    form.value.repoName = route.params.repoName;
  }
});

const saveForm = debounce(function () {
  {
    console.log("Saving form data", form.value);
    ElMessage({
      message: "Form saved successfully!",
      type: "success",
    });
  }
}, 1000);
// Method to check if the tag exists
const checkIfTagExists = (tag) => {
  const formTags = propOr([], 'tags', form.value);
  const tagExistsForm = includes(tag, formTags);

  const datasetTags = pathOr([], ['dataset', 'tags'], dataset.value);
  const tagExistsDataset = includes(tag, datasetTags);

  return tagExistsForm || tagExistsDataset;
};

/**
 * Add tag to the dataset
 */
const addTag = function () {
  const tag = compose(trim, toLower, defaultTo(""))(this.inputTag);

  if (tag) {
    this.inputTag = "";

    const tagExists = this.checkIfTagExists(tag);
    if (tagExists === false) {
      this.form.tags.push(tag);
      // this.saveForm();
    }
  }
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

  .input-item {
    margin-bottom: 24px;
  }

  .label-helper {
    color: $gray_4;
    font-size: 12px;
    font-weight: 400;
  }

  .auto-publish-input .el-checkbox__label {
    font-weight: 500;
  }

  .el-input,
  .el-textarea {
    max-width: 475px;
  }
}
</style>
