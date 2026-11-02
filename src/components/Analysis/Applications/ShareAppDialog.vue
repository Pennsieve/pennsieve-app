<script setup>
/*
  Share an App Store app: its visibility, and for a private app, the people,
  teams and workspaces that can use it (ShareAccessEditor), saved together
  (updateApplicationPermissions takes visibility and access together). The
  owner always keeps access.
*/
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import { sharePayload } from "./appSharing";
import ShareAccessEditor from "./ShareAccessEditor.vue";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  uuid: { type: String, required: true },
  appName: { type: String, default: "" },
  isPublic: { type: Boolean, default: false },
  ownerId: { type: [String, Number], default: null },
  // The workspace people and teams come from; none in My Workspace.
  organizationId: { type: [String, Number], default: null },
  // Who has access now (accessEntries).
  entries: { type: Array, default: () => [] },
});
const emit = defineEmits(["update:modelValue", "saved"]);

const store = useStore();
const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const visibility = ref("private");
const list = ref([]);
const saving = ref(false);

// Fresh each time it opens.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    visibility.value = props.isPublic ? "public" : "private";
    list.value = props.entries.map((e) => ({ ...e }));
  },
  { immediate: true }
);

const profile = computed(() => store.state.profile);

const save = async () => {
  saving.value = true;
  try {
    const meId = profile.value?.id || profile.value?.intId;
    const orgId = props.organizationId || list.value.find((e) => e.organizationId)?.organizationId || null;
    await store.dispatch("analysisModule/updateApplicationPermissions", {
      uuid: props.uuid,
      payload: sharePayload(list.value, visibility.value, meId, orgId),
    });
    ElMessage.success(visibility.value === "public" ? "The app is public" : "Sharing saved");
    emit("saved");
    visible.value = false;
  } catch (err) {
    console.error(err);
    ElMessage.error("Couldn't save the sharing settings. Please try again.");
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <el-dialog v-model="visible" :title="appName ? `Share ${appName}` : 'Share this app'" width="560px" append-to-body class="share-app-dialog">
    <ShareAccessEditor v-model="list" v-model:visibility="visibility" :owner-id="ownerId" :organization-id="organizationId" />

    <template #footer>
      <div class="sa-footer">
        <bf-button class="secondary" @click="visible = false">Cancel</bf-button>
        <bf-button :processing="saving" :disabled="saving" @click="save">Save</bf-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.sa-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
