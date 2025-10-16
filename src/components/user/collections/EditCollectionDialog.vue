<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      title="Edit Collection"
      class="edit-collections-dialog"
      :show-close="false"
      @close="closeDialog"
    >
      <div class="bf-dialog-body">
        <el-form ref="formRef" :model="form" label-width="130px">
          <!-- Collection Name -->
          <el-form-item label="Collection Name" required>
            <el-input v-model="form.name" placeholder="Enter collection name" />
          </el-form-item>

          <!-- Collection Description -->
          <el-form-item label="Description" required>
            <el-input
              v-model="form.description"
              type="textarea"
              placeholder="Enter description"
            />
          </el-form-item>
          <el-form-item id="inputTags">
            <div v-if="workspaceTags.length > 0" class="suggested-tags">
              <p>suggested workspaces:</p>
              <el-button
                v-for="tag in workspaceTags"
                :key="tag"
                @click="addSuggestedTag(tag)"
                :disabled="isTagSelected(tag)"
              >
                {{ tag }}
              </el-button>
            </div>
            <template #label> Tags </template>
            <el-input
              ref="inputTags"
              v-model="inputTag"
              class="mb-8"
              placeholder="Add tags"
              @keyup.enter="addTag"
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
          <el-form-item>
            <el-select
              ref="inputLicense"
              v-model="form.license"
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
          <div class="delete-collection">
            <!-- <bf-button class="red" @click="deleteCollection()">Delete</bf-button> -->
          </div>
          <bf-button class="secondary" @click="closeDialog">Cancel</bf-button>
          <bf-button
            class="edit-collection-button"
            type="primary"
            :loading="isLoading"
            @click="submit"
          >
            Save
          </bf-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, defineProps, defineEmits, watch, computed } from "vue";
import { ElMessage } from "element-plus";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import { useCollectionsStore } from "@/stores/collectionStore.js";
import { useStore } from "vuex";
import { compose, defaultTo, toLower, trim } from "ramda";
import licenses from "../../datasets/settings/dataset-licenses";
import IconLicense from "../../icons/IconLicense.vue";
import IconTag from "../../icons/IconTag.vue";
import bfTag from "../../shared/BfTag/BfTag.vue";
import orgTagMap from "./orgMap.js";

const props = defineProps({
  collectionDetails: {
    type: Object,
    required: true,
  },
});
const emit = defineEmits(["close", "collectionUpdated"]);

const store = useStore();
const collectionStore = useCollectionsStore();
const orginizations = computed(() => store.state.organizations);
const inputTag = ref("");
const dialogVisible = ref(true);
const isLoading = ref(false);
const form = ref({
  name: "",
  description: "",
  tags: [],
  license: "",
});

watch(
  () => props.collectionDetails,
  (newVal) => {
    if (newVal) {
      form.value.name = newVal.name || "";
      form.value.description = newVal.description || "";
      form.value.tags = newVal.tags || [];
      form.value.license = newVal.license || "";
    }
  },
  { immediate: true }
);

const closeDialog = () => {
  dialogVisible.value = false;
  emit("close", true);
};

//Suggested tags
const workspaceTags = computed(() => [
  ...new Set(
    orginizations.value
      .map((o) => orgTagMap.get(o.organization.id))
      .filter(Boolean)
  ),
]);
const isTagSelected = (tag) => form.value.tags.includes(tag);

const addSuggestedTag = (tag) => {
  if (!isTagSelected(tag)) {
    form.value.tags.push(tag);
  }
};
const addTag = () => {
  const tag = compose(trim, toLower, defaultTo(""))(inputTag.value);
  if (tag) {
    if (tag && !form.value.tags.includes(tag)) {
      inputTag.value = "";
      form.value.tags.push(tag);
    }
  }
};
const removeTag = (tag) => {
  const idx = form.value.tags.indexOf(tag);
  if (idx > -1) {
    form.value.tags.splice(idx, 1);
  }
};

/**
 * call to edit a collection
 * collections BE
 */
async function editCollection() {
  if (!form.value.name.trim()) {
    ElMessage.error("Collection name is required");
    return;
  }
  if (!form.value.description.trim()) {
    ElMessage.error("Collection description is required");
    return;
  }
  if (!form.value.license.trim()) {
    ElMessage.error("License is required");
    return;
  }
  isLoading.value = true;

  const body = {
    name: form.value.name.trim(),
    description: form.value.description.trim(),
    license: form.value.license,
    tags: form.value.tags,
  };
  try {
    const response = await collectionStore.editCollection(
      props.collectionDetails.id,
      body
    );
    ElMessage.success(`Successfully updated collection: ${response.name}`);

    // Emit the updated collection data
    emit("collectionUpdated", response);
  } catch (error) {
    console.log(error);
    ElMessage.error("Failed to update collection");
  } finally {
    isLoading.value = false;
    closeDialog();
  }
}

/*
  Delete Collection
  */
//   async function deleteCollection() {
//    if(!confirm("Are you sure you want to perminately delete this collection?")){return}
//     try{
//       await collectionStore.deleteCollection(props.collectionDetails.id);
//       collectionStore.clearCollectionsStore();
//       ElMessage.success(`perminately deleted collection ${props.collectionDetails.id}`)
//       router.push('/workspaces/user/collections/my-collections');
//     }catch(error){
//       ElMessage.error("failed to delete collection")
//       closeDialog()
//     }
// }

/**
 * Handles form submission
 */
const submit = async () => {
  if (!form.value.name.trim()) {
    ElMessage.error("Collection name is required");
    return;
  }
  if (!form.value.description.trim()) {
    ElMessage.error("Collection description is required");
    return;
  }
  editCollection();
};
</script>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";
@use "../../../styles/element/dialog";

.edit-collection-button {
  background: #011f5b;
  border: none;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.delete-collection {
  margin-right: auto;
}
.suggested-tags {
  display: flex;
  flex-flow: row;
  width: 100%;
  justify-content: flex-end;
  p {
    padding-right: 4px;
  }
}
</style>
