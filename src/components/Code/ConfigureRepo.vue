<template>
  <bf-stage class="configure-repo-wrapper">
    <div class="input-item">
      <el-checkbox
        v-model="isAutoPublished"
        label="Automatic publication"
        size="large"
      >
      </el-checkbox>
      <p>Automatically publish a version on new releases from GitHub</p>
    </div>
    <div class="input-item repo-name">
      <label for="repoName">Repository Name</label>
      <el-input
        v-model="repoName"
        style="width: 320px"
        placeholder="Repository Name (from GitHub)"
      />
    </div>
    <div class="input-item given-name">
      <label for="givenName">Name (Required)</label>
      <el-input
        v-model="givenName"
        style="width: 320px"
        placeholder="user-test"
      />
    </div>
    <div class="input-item subtitle">
      <label for="subtitle">Subtitle (required to publish)</label>
      <el-input
        v-model="subtitle"
        style="width: 320px"
        :rows="3"
        autosize
        type="textarea"
        placeholder="any additional details here"
      />
    </div>
    <div class="input-item tags">
      <label for="tags">Tags</label>
      <el-input
              v-model="tags"
              placeholder="Add tags"
              style="width: 320px"
            >
              <template #prefix>
                <IconTag
                  :height="20"
                  :width="20"
                  />
              </template>
            </el-input>
    </div>
  </bf-stage>
</template>

<script lang="ts" setup>
import { ref } from "vue";

defineOptions({
  name: "ConfigureRepo",
});

const isAutoPublished = ref(false);
const repoName = ref('')
const givenName = ref('')
const subtitle = ref('')
const tags = ref('')
</script>

<style lang="scss">
.configure-repo-wrapper {
  .input-item {
    margin-bottom: 24px;
  }

  span {
    font-weight: 700;
  }

  .repo-name, .given-name, .subtitle, .tags {
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 800;
    }
  }
}
</style>
