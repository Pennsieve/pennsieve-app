<script setup>
/*
  Share an App Store app: its visibility, and for a private app, the people,
  teams and workspaces that can use it. One search for all three, one list,
  one save (updateApplicationPermissions takes visibility and access
  together). The owner always keeps access.
*/
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import { shareCandidates, sharePayload } from "./appSharing";

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

const VISIBILITY = [
  { value: "private", label: "Private", hint: "Only the people, teams and workspaces you add can find it and use it in workflows." },
  { value: "public", label: "Public", hint: "Anyone on Pennsieve can find it on the Apps tab and use it in workflows." },
];
const TYPE_LABEL = { user: "Person", team: "Team", workspace: "Workspace" };

const visibility = ref("private");
const list = ref([]);
const picked = ref(null);
const query = ref("");
const saving = ref(false);

// Fresh each time it opens.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    visibility.value = props.isPublic ? "public" : "private";
    list.value = props.entries.map((e) => ({ ...e }));
    query.value = "";
    picked.value = null;
  },
  { immediate: true }
);

const profile = computed(() => store.state.profile);
const isMe = (id) => id != null && (String(id) === String(profile.value?.id) || String(id) === String(profile.value?.intId));
const isOwner = (id) => id != null && String(id) === String(props.ownerId);

const sources = computed(() => ({
  members: props.organizationId ? store.state.orgMembers || [] : [],
  teams: props.organizationId ? store.state.teams || [] : [],
  organizations: store.state.organizations || [],
}));
const candidates = computed(() => shareCandidates(query.value, sources.value, list.value, props.organizationId));
const noPeople = computed(() => !props.organizationId);

const add = (key) => {
  const c = candidates.value.find((x) => `${x.type}:${x.id}` === key);
  if (c) list.value.push({ type: c.type, id: c.id, name: c.name, organizationId: c.organizationId });
  picked.value = null;
  query.value = "";
};
const remove = (entry) => {
  list.value = list.value.filter((e) => !(e.type === entry.type && e.id === entry.id));
};

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
    <!-- Visibility first -->
    <div class="sa-field">
      <label class="sa-label">Who can use it</label>
      <el-radio-group v-model="visibility" class="sa-visibility">
        <div v-for="v in VISIBILITY" :key="v.value" class="sa-visibility-option">
          <el-radio :value="v.value">{{ v.label }}</el-radio>
          <span class="sa-hint">{{ v.hint }}</span>
        </div>
      </el-radio-group>
    </div>

    <!-- Private: who it's shared with -->
    <div v-if="visibility === 'private'" class="sa-field">
      <label class="sa-label">Shared with</label>
      <el-select
        v-model="picked"
        class="sa-search"
        filterable
        :filter-method="(q) => (query = q)"
        :placeholder="noPeople ? 'Add a workspace' : 'Add people, teams or workspaces'"
        @visible-change="(open) => open || (query = '')"
        @change="add"
      >
        <el-option v-for="c in candidates" :key="`${c.type}:${c.id}`" :label="c.name" :value="`${c.type}:${c.id}`">
          <span class="sa-option">
            <span class="sa-option-name">{{ c.name }}</span>
            <span class="sa-option-type">{{ c.type === "user" ? c.detail : TYPE_LABEL[c.type] }}</span>
          </span>
        </el-option>
      </el-select>
      <p v-if="noPeople" class="sa-hint">To add people or teams, open this app from the workspace they're in.</p>

      <ul class="sa-list">
        <li v-for="e in list" :key="`${e.type}:${e.id}`" class="sa-entry">
          <span class="sa-entry-type">{{ TYPE_LABEL[e.type] }}</span>
          <span class="sa-entry-name">{{ e.name }}</span>
          <span v-if="isOwner(e.id)" class="sa-tag">owner</span>
          <span v-else-if="isMe(e.id)" class="sa-tag">you</span>
          <button
            v-if="!isOwner(e.id) && !isMe(e.id)"
            type="button"
            class="sa-remove"
            :title="`Remove ${e.name}`"
            @click="remove(e)"
          >&times;</button>
        </li>
        <li v-if="!list.length" class="sa-empty">Only you, so far.</li>
      </ul>
    </div>

    <template #footer>
      <div class="sa-footer">
        <bf-button class="secondary" @click="visible = false">Cancel</bf-button>
        <bf-button :processing="saving" :disabled="saving" @click="save">Save</bf-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.sa-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}
.sa-label {
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_6;
}
.sa-visibility {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}
.sa-visibility-option {
  display: flex;
  flex-direction: column;
  :deep(.el-radio) {
    height: auto;
  }
}
.sa-hint {
  margin: 0 0 0 24px;
  font-size: 12px;
  line-height: 1.4;
  color: theme.$gray_4;
}
p.sa-hint {
  margin-left: 0;
}
.sa-search {
  width: 100%;
}
.sa-option {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.sa-option-type {
  font-size: 12px;
  color: theme.$gray_4;
}
.sa-list {
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  max-height: 260px;
  overflow-y: auto;
}
.sa-entry,
.sa-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  font-size: 13px;
  border-bottom: 1px solid theme.$gray_2;
  &:last-child {
    border-bottom: none;
  }
}
.sa-empty {
  color: theme.$gray_4;
}
.sa-entry-type {
  min-width: 72px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: theme.$gray_4;
}
.sa-entry-name {
  flex: 1;
  color: theme.$gray_6;
}
.sa-tag {
  padding: 0 6px;
  border-radius: 3px;
  background: theme.$gray_1;
  font-size: 11px;
  color: theme.$gray_5;
}
.sa-remove {
  border: none;
  background: none;
  font-size: 16px;
  line-height: 1;
  color: theme.$gray_4;
  cursor: pointer;
  &:hover {
    color: theme.$red_1;
  }
}
.sa-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
