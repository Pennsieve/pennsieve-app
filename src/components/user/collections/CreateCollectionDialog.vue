<template>
  <el-dialog
    :model-value="visible"
    title="Create New Collection"
    class="create-new-collections-dialog"
    :show-close="false"
    @close="onClose"
  >
    <div class="bf-dialog-body">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="130px"
        status-icon
      >
        <!-- Collection Name -->
        <el-form-item label="Collection Name" prop="name" required>
          <el-input
            v-model="form.name"
            placeholder="Enter collection name"
            maxlength="150"
            @keyup.enter="submit"
          />
        </el-form-item>

        <!-- Collection Description (REQUIRED to match the first component) -->
        <el-form-item label="Description" prop="description" required>
          <el-input
            v-model="form.description"
            type="textarea"
            placeholder="Enter description"
            maxlength="255"
            show-word-limit
            rows="4"
            @keyup.enter="submit"
          />
        </el-form-item>

        <!-- Tags (with suggested workspace tags) -->
        <el-form-item prop="tagsList">
          <div v-if="workspaceTags.length > 0" class="suggested-tags">
            <p>suggested workspaces:</p>
            <el-button
              v-for="tag in workspaceTags"
              :key="tag"
              size="small"
              @click="addSuggestedTag(tag)"
              :disabled="isTagSelected(tag)"
            >
              {{ tag }}
            </el-button>
          </div>

          <template #label>Tags</template>

          <el-input
            ref="inputTagsRef"
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
              v-for="tag in form.tagsList"
              :key="tag"
              :label="tag"
              class="mr-8 mb-8"
              @remove="removeTag(tag)"
            />
          </div>
        </el-form-item>

        <!-- License Select -->
        <el-form-item label="License" prop="license">
          <el-select
            ref="inputLicenseRef"
            v-model="form.license"
            placeholder="No License Selected"
            clearable
          >
            <template #prefix>
              <IconLicense :height="20" :width="20" />
            </template>

            <el-option-group
              v-for="group in licenses"
              :key="group.label"
              :label="group.label"
            >
              <el-option
                v-for="opt in group.options"
                :key="opt.label"
                :label="opt.label"
                :value="opt.value"
              />
            </el-option-group>
          </el-select>
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="onClose">Cancel</el-button>
        <el-button
          class="create-collection-button"
          type="primary"
          :loading="isLoading"
          :disabled="isSubmitDisabled"
          @click="submit"
        >
          {{ isLoading ? "Creating..." : "Create Collection" }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { useCollectionsStore } from "@/stores/collectionStore";
import licenses from "../../datasets/settings/dataset-licenses";
import IconLicense from "../../icons/IconLicense.vue";
import IconTag from "../../icons/IconTag.vue";
import bfTag from "../../shared/BfTag/BfTag.vue";
import orgTagMap from "./orgMap.js";

/**
 * v-model from parent (default model)
 * Parent uses: <create-collection-dialog v-model="createDialogVisible" ... />
 */
const props = defineProps<{
  modelValue: boolean;
  orgs?: Array<any>;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "close"): void;
  (e: "collectionAdded", id: string): void;
}>();

const router = useRouter();
const store = useCollectionsStore();

// Bridge to v-model
const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

// Form + validation
const formRef = ref();
const form = reactive({
  name: "",
  description: "",
  tagsList: [] as string[],
  license: "",
});

const rules = {
  name: [
    {
      validator: (_: any, v: string, cb: (err?: Error) => void) => {
        const val = (v || "").trim();
        if (!val) return cb(new Error("Collection name is required"));
        if (val.length < 2)
          return cb(new Error("Collection name must be at least 2 characters"));
        cb();
      },
      trigger: ["blur", "change"],
    },
  ],
  description: [
    {
      validator: (_: any, v: string, cb: (err?: Error) => void) => {
        const val = (v || "").trim();
        if (!val) return cb(new Error("Collection description is required"));
        cb();
      },
      trigger: ["blur", "change"],
    },
  ],
};

const isLoading = ref(false);
const isSubmitDisabled = computed(() => {
  const name = form.name?.trim() || "";
  const desc = form.description?.trim() || "";
  return isLoading.value || name.length < 2 || !desc;
});

// Suggested workspace tags from orgs
const workspaceTags = computed<string[]>(() => {
  const arr = (props.orgs || [])
    .map((o: any) => orgTagMap.get(o?.organization?.id))
    .filter(Boolean);
  return Array.from(new Set(arr));
});
const isTagSelected = (tag: string) => form.tagsList.includes(tag);

// Tag input
const inputTag = ref("");
const inputTagsRef = ref();
const inputLicenseRef = ref();

function addSuggestedTag(tag: string) {
  if (!isTagSelected(tag)) form.tagsList.push(tag);
}
function addTag() {
  const t = (inputTag.value || "").toLowerCase().trim();
  if (t && !form.tagsList.includes(t)) {
    form.tagsList.push(t);
  }
  inputTag.value = "";
}
function removeTag(tag: string) {
  const i = form.tagsList.indexOf(tag);
  if (i > -1) form.tagsList.splice(i, 1);
}

// Reset when opened
function resetForm() {
  form.name = "";
  form.description = "";
  form.tagsList = [];
  form.license = "";
  formRef.value?.clearValidate?.();
}
watch(visible, (v) => {
  if (v) resetForm();
});

function onClose() {
  visible.value = false;
  emit("close");
}

// API call (Pinia action) — matches the first component
async function createCollection() {
  try {
    isLoading.value = true;
    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      license: form.license,
      tags: form.tagsList,
    };
    const newId = await store.createNewCollection(body);
    ElMessage.success("Collection created successfully!");
    return newId as string;
  } catch (err) {
    ElMessage.error("Failed to create collection");
    throw err;
  } finally {
    isLoading.value = false;
  }
}

async function submit() {
  if (isLoading.value) return;

  // Element Plus async validate
  try {
    await formRef.value?.validate?.();
  } catch {
    return;
  }

  try {
    const newCollectionId = await createCollection();
    emit("collectionAdded", newCollectionId);
    onClose();
    // path aligned with the first component
    router.push({ path: `/my-workspace/collections/${newCollectionId}` });
  } catch {
    /* toast already shown */
  }
}
</script>

<style scoped lang="scss">
.create-collection-button {
  background: #011f5b;
  border: none;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.suggested-tags {
  display: flex;
  flex-flow: row;
  width: 100%;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  p {
    padding-right: 4px;
    margin: 0;
  }
}
.tag-wrap {
  display: flex;
  flex-wrap: wrap;
}
</style>

<style lang="scss">
.create-new-collections-dialog {
  .el-dialog__title {
    color: white;
  }
}
</style>
