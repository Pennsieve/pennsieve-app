<template>
  <div>
    <el-dialog
      v-model="isVisible"
      title="Publish Collection"
      class="publish-collections-dialog"
      :show-close="false"
      @close="closeDialog"
    >
      <div class="bf-dialog-body">
        <div v-if="showError" class="error-message">
          *enter a {{ errorMsg }} to publish
        </div>
        <el-form
          ref="formRef"
          :model="publishCollectionObject"
          label-width="130px"
        >
          <!-- Collection Name -->
          <el-form-item label="Collection Name" required>
            <el-input v-model="publishCollectionObject.name" disabled />
          </el-form-item>

          <!-- Collection Description -->
          <el-form-item label="Description" required>
            <el-input
              v-model="publishCollectionObject.description"
              type="textarea"
              disabled
            />
          </el-form-item>
          <el-form-item id="inputTags">
            <template #label> Tags </template>
            <el-input
              ref="inputTags"
              v-model="inputTag"
              class="mb-8"
              placeholder="Add tags"
              @keyup.enter.native.stop="addTag"
            >
              <template #prefix>
                <IconTag :height="20" :width="20" />
              </template>
            </el-input>
            <div class="tag-wrap">
              <bf-tag
                v-for="tag in publishCollectionObject.tags"
                :key="tag"
                :label="tag"
                class="mr-8 mb-8"
                @remove="removeTag(tag)"
              />
            </div>
          </el-form-item>
          <el-form-item>
            <el-select
              ref="inputLicense"
              v-model="publishCollectionObject.license"
              placeholder="No License Selected"
            >
              <template #prefix>
                <IconLicense :height="20" :width="20" />
              </template>
              <el-option-group
                v-for="license in licenses"
                :key="license.label"
                :label="license.label"
              >
                <el-option
                  v-for="option in license.options"
                  :key="option.label"
                  :label="option.label"
                  :value="option.value"
                />
              </el-option-group>
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <bf-button class="secondary" @click="closeDialog">Cancel</bf-button>
          <bf-button
            class="create-collection-button"
            type="primary"
            :loading="isLoading"
            @click="validateForm"
          >
            Publish Collection
          </bf-button>
        </div>
      </template>
    </el-dialog>
    <ConfirmPublishDialog
      v-if="confirmDialogVisible"
      :collection-details="collectionDetails"
      @close="closeConfirmDialog"
      @publishDatasetConfirmed="publishDataset"
    ></ConfirmPublishDialog>
  </div>
</template>
<script lang="ts" setup>
import { ref, watch } from "vue";
import { useCollectionsStore } from "@/stores/collectionStore";
import ConfirmPublishDialog from "./ConfirmPublishDialog.vue";

import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import licenses from "./select-licenses";
import IconLicense from "../../icons/IconLicense.vue";
import IconTag from "../../icons/IconTag.vue";
import bfTag from "../../shared/BfTag/BfTag.vue";
import { compose, defaultTo, toLower, trim } from "ramda";
import BfButton from "@/components/shared/bf-button/BfButton.vue";

const emit = defineEmits(["close"]);
const collectionsStore = useCollectionsStore();
const props = defineProps<{
  collectionDetails: {
    name: string;
    description: string;
    id: string;
    tags: [];
    license: string;
  };
}>();

const publishCollectionObject = ref<{
  license: string;
  tags: string[];
  name: string;
  description: string;
  nodeId: string;
}>({
  license: "",
  tags: [],
  name: props.collectionDetails.name || "",
  description: props.collectionDetails.description || "",
  nodeId: props.collectionDetails.id,
});

watch(
  () => props.collectionDetails,
  (newVal) => {
    if (newVal) {
      publishCollectionObject.value.name = newVal.name || "";
      publishCollectionObject.value.description = newVal.description || "";
      publishCollectionObject.value.tags = newVal.tags || [];
      publishCollectionObject.value.license = newVal.license || "";
    }
  },
  { immediate: true }
);

const router = useRouter();
const isVisible = ref(true);
const isLoading = ref(false);
const inputTag = ref("");
const showError = ref(false);
const errorMsg = ref("");
const confirmDialogVisible = ref(false);

const addTag = () => {
  const tag = compose(trim, toLower, defaultTo(""))(inputTag.value);
  if (tag) {
    if (tag && !publishCollectionObject.value.tags.includes(tag)) {
      inputTag.value = "";
      publishCollectionObject.value.tags.push(tag);
    }
  }
};
const removeTag = (tag: string) => {
  const idx = publishCollectionObject.value.tags.indexOf(tag);
  if (idx > -1) {
    publishCollectionObject.value.tags.splice(idx, 1);
  }
};
const validateForm = () => {
  if (publishCollectionObject.value.tags.length == 0) {
    showError.value = true;
    errorMsg.value = "tag";
    return;
  }
  if (!publishCollectionObject.value.license) {
    showError.value = true;
    errorMsg.value = "license";
    return;
  }
  openConfirmDialog();
};
const openConfirmDialog = () => {
  confirmDialogVisible.value = true;
};
const closeConfirmDialog = () => {
  confirmDialogVisible.value = false;
};
const publishDataset = async () => {
  try {
    const publishedId = await collectionsStore.publishCollection(
      publishCollectionObject.value
    );
    ElMessage.success("Successfully published your collection: " + publishedId);
    router.push({
      path: `/my-workspace/collections/${publishCollectionObject.value.nodeId}`,
    });
  } catch (x) {
    ElMessage.error("Failed to publish collection");
  }
  confirmDialogVisible.value = false;
  closeDialog();
};
const closeDialog = () => {
  isVisible.value = false;
  emit("close");
};
</script>
<style lang="scss" scoped>
@use "../../../styles/_theme.scss";
@use "../../../styles/element/dialog";
@use "../../../styles/element/input";

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.el-textarea__inner {
  resize: none;
}
.tag-wrap {
  display: flex;
  flex-direction: row;
}
.error-message {
  color: red;
  text-align: center;
  padding-bottom: 10px;
}
</style>
