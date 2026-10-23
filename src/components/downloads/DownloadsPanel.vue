<template>
  <div
    v-if="store.panelOpen && recent.length"
    class="downloads-panel"
    role="region"
    aria-label="Downloads"
  >
    <div class="header">
      <button class="title" type="button" :aria-expanded="!collapsed" @click="collapsed = !collapsed">
        {{ title }}
      </button>
      <router-link class="all" :to="allDownloads">
        All downloads
      </router-link>
      <button class="close" type="button" aria-label="Close downloads" @click="store.panelOpen = false">
        ×
      </button>
    </div>
    <div v-if="!collapsed" class="items">
      <download-item v-for="d in recent" :key="d.id" :download="d" />
      <p v-if="store.active.length" class="hint">We'll email you if you leave before it's ready.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import { pathOr } from "ramda";
import { useDownloadsStore } from "@/stores/downloadsStore";
import DownloadItem from "./DownloadItem.vue";

const store = useDownloadsStore();
const vuex = useStore();
const collapsed = ref(false);

// Loads the workspace's downloads whenever the active workspace is known or
// changes, including after a reload, so builds in progress and ready
// archives come back. The panel is always mounted, unlike the navigation.
const activeOrgId = computed(() => pathOr(null, ["activeOrganization", "organization", "id"], vuex.state));
watch(
  activeOrgId,
  (orgId) => {
    if (orgId) store.load(orgId).catch(() => {});
  },
  { immediate: true }
);

// The user's run archives (download targets), from every workspace and
// none: loaded once they're signed in, not per workspace.
const userId = computed(() => pathOr(null, ["profile", "id"], vuex.state));
watch(
  userId,
  (id) => {
    if (id) store.loadRuns().catch(() => {});
  },
  { immediate: true }
);

// Run results are made on the node, not asked for from this tab, so nothing
// here hears about a new one. Look again when the user comes back to the tab,
// at most once a minute.
const RUNS_REFRESH_MS = 60 * 1000;
let runsLoadedAt = 0;
function onVisible() {
  if (document.visibilityState !== "visible" || !userId.value) return;
  if (Date.now() - runsLoadedAt < RUNS_REFRESH_MS) return;
  runsLoadedAt = Date.now();
  store.loadRuns().catch(() => {});
}
onMounted(() => document.addEventListener("visibilitychange", onVisible));
onBeforeUnmount(() => document.removeEventListener("visibilitychange", onVisible));

const recent = computed(() => store.panelDownloads.slice(0, 5));

// The workspace's downloads page, or My Workspace's (run results) outside a
// workspace.
const route = useRoute();
const allDownloads = computed(() => {
  const orgId = activeOrgId.value;
  const inMyWorkspace = (route?.path || "").startsWith("/my-workspace");
  return orgId && !inMyWorkspace
    ? { name: "workspace-downloads", params: { orgId } }
    : { name: "my-downloads" };
});

const title = computed(() => {
  const n = store.active.length;
  return n ? `Preparing ${n} ${n === 1 ? "download" : "downloads"}` : "Downloads";
});
</script>

<style lang="scss" scoped>
@use "../../styles/theme";

.downloads-panel {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2000;
  width: 380px;
  max-width: calc(100vw - 32px);
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-bottom: 1px solid theme.$gray_2;
  }

  .title {
    flex: 1;
    text-align: left;
    background: none;
    border: 0;
    padding: 0;
    color: theme.$gray_6;
    font-weight: 600;
    cursor: pointer;
  }

  .all {
    color: theme.$purple_2;
    font-size: 13px;
  }

  .close {
    background: none;
    border: 0;
    font-size: 20px;
    line-height: 1;
    color: theme.$gray_4;
    cursor: pointer;
  }

  .items {
    padding: 0 16px 8px;
    max-height: 360px;
    overflow-y: auto;
  }

  .hint {
    color: theme.$gray_4;
    font-size: 12px;
    margin: 0 0 8px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
