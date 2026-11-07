<script setup>
/*
  Who can use an App Store app: its visibility, and for a private app, the
  people, teams and workspaces it's shared with. One search for all three,
  one list. The Share dialog saves what it edits to an app that exists; the
  Add repository wizard keeps it until the app's first release creates it.
  The owner always keeps access.
*/
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";
import { useGetToken } from "@/composables/useGetToken";
import { shareCandidates, emailToLookUp } from "./appSharing";
import { useWorkspaceMembers } from "./useWorkspaceMembers";

const props = defineProps({
  // The entries: { type: "user"|"team"|"workspace", id, name, organizationId }.
  modelValue: { type: Array, default: () => [] },
  visibility: { type: String, default: "private" },
  ownerId: { type: [String, Number], default: null },
  // The workspace people and teams come from; none in My Workspace.
  organizationId: { type: [String, Number], default: null },
});
const emit = defineEmits(["update:modelValue", "update:visibility"]);

const store = useStore();

const VISIBILITY = [
  { value: "private", label: "Private", hint: "Only the people, teams and workspaces you add can find it and use it in workflows." },
  { value: "public", label: "Public", hint: "Anyone on Pennsieve can find it on the Apps tab and use it in workflows." },
];
const TYPE_LABEL = { user: "Person", team: "Team", workspace: "Workspace" };

const list = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});
const visibilityModel = computed({
  get: () => props.visibility,
  set: (v) => emit("update:visibility", v),
});

// People from all the caller's workspaces (shared with the app page).
const { allMembers, load: loadAllMembers } = useWorkspaceMembers();
watch(
  () => props.visibility,
  (v) => v === "private" && loadAllMembers(),
  { immediate: true }
);

const picked = ref(null);
const query = ref("");

const profile = computed(() => store.state.profile);
const isMe = (id) => id != null && (String(id) === String(profile.value?.id) || String(id) === String(profile.value?.intId));
const isOwner = (id) => id != null && String(id) === String(props.ownerId);

// People from all the caller's workspaces; teams only from the one being
// viewed (a team means something only inside its workspace).
const sources = computed(() => ({
  members: allMembers.value,
  teams: props.organizationId ? store.state.teams || [] : [],
  organizations: store.state.organizations || [],
}));
const candidates = computed(() => shareCandidates(query.value, sources.value, list.value, props.organizationId));
const GROUPS = [
  { type: "workspace", label: "Workspaces" },
  { type: "team", label: "Teams" },
  { type: "user", label: "People" },
];
const candidateGroups = computed(() =>
  GROUPS.map((g) => ({ ...g, items: candidates.value.filter((c) => c.type === g.type) })).filter((g) => g.items.length)
);
// Someone outside all of them: a whole email address, looked up.
const lookupEmail = computed(() => emailToLookUp(query.value, allMembers.value, list.value));
const lookingUp = ref(false);

const lookUp = async (email) => {
  lookingUp.value = true;
  try {
    const token = await useGetToken();
    const resp = await fetch(`${store.state.config.apiUrl}/user/email/${encodeURIComponent(email)}?api_key=${token}`);
    const user = resp.ok ? await resp.json() : null;
    if (!user?.id) {
      ElMessage({ type: "info", message: `No Pennsieve account uses ${email}.` });
      return;
    }
    if (list.value.some((e) => e.type === "user" && e.id === user.id)) return;
    const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || email;
    list.value = [...list.value, { type: "user", id: user.id, name, email, organizationId: props.organizationId || null }];
  } catch {
    ElMessage.error(`Couldn't look up ${email}. Please try again.`);
  } finally {
    lookingUp.value = false;
  }
};

const add = (key) => {
  if (String(key).startsWith("lookup:")) {
    lookUp(String(key).slice("lookup:".length));
    picked.value = null;
    query.value = "";
    return;
  }
  const c = candidates.value.find((x) => `${x.type}:${x.id}` === key);
  if (c) list.value = [...list.value, { type: c.type, id: c.id, name: c.name, organizationId: c.organizationId }];
  picked.value = null;
  query.value = "";
};
const remove = (entry) => {
  list.value = list.value.filter((e) => !(e.type === entry.type && e.id === entry.id));
};
</script>

<template>
  <div class="share-access-editor">
    <!-- Visibility first -->
    <div class="sa-field">
      <label class="sa-label">Who can use it</label>
      <el-radio-group v-model="visibilityModel" class="sa-visibility">
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
        fit-input-width
        popper-class="sa-dropdown"
        filterable
        :filter-method="(q) => (query = q)"
        :loading="lookingUp"
        placeholder="Add people, teams or workspaces"
        @visible-change="(open) => open || (query = '')"
        @change="add"
      >
        <el-option v-if="lookupEmail" :key="`lookup:${lookupEmail}`" :label="`Look up ${lookupEmail}`" :value="`lookup:${lookupEmail}`">
          <span class="sa-option">
            <span class="sa-option-name">Look up {{ lookupEmail }}</span>
            <span class="sa-option-detail">A Pennsieve account outside your workspaces</span>
          </span>
        </el-option>
        <!-- Grouped: workspaces, teams, people -->
        <el-option-group v-for="g in candidateGroups" :key="g.type" :label="g.label">
          <el-option v-for="c in g.items" :key="`${c.type}:${c.id}`" :label="c.name" :value="`${c.type}:${c.id}`">
            <span class="sa-option" :title="c.allWorkspaces ? `In ${c.allWorkspaces}` : undefined">
              <span class="sa-option-name">{{ c.name }}</span>
              <span v-if="c.type === 'user'" class="sa-option-detail">{{ c.detail }}</span>
            </span>
          </el-option>
        </el-option-group>
      </el-select>
      <p class="sa-hint">
        People from all your workspaces<template v-if="organizationId">, teams from this one</template>, or anyone on Pennsieve by
        their whole email address. A person you add can use the app everywhere, including their My Workspace.
      </p>

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
  </div>
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
  flex-direction: column;
  min-width: 0;
  line-height: 1.3;
}
.sa-option-name,
.sa-option-detail {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sa-option-detail {
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
</style>

<style lang="scss">
/* The dropdown is teleported, so these aren't scoped: two-line options. */
.sa-dropdown .el-select-dropdown__item {
  height: auto;
  padding-top: 6px;
  padding-bottom: 6px;
}
.sa-dropdown .el-select-group__wrap:not(:last-of-type)::after {
  margin: 4px 12px;
}
</style>
