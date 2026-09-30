<template>
  <bf-stage slot="stage">
    <div class="section">
      <div class="section-header">
        <p class="section-description">
          Archives you asked for in this workspace. They're kept for 3 days;
          download them as often as you like until then.
        </p>
      </div>

      <div v-if="loading" v-loading="loading" class="loading-state">
        <p>Loading downloads...</p>
      </div>

      <div v-else-if="failed" class="empty-state">
        <h3>Downloads couldn't be loaded</h3>
        <el-button size="small" @click="load">Try again</el-button>
      </div>

      <div v-else-if="store.downloads.length === 0" class="empty-state">
        <h3>No downloads</h3>
        <p>When you download several files or a folder, the archive appears here.</p>
      </div>

      <div v-else class="download-list">
        <download-item v-for="d in store.downloads" :key="d.id" :download="d" />
      </div>
    </div>
  </bf-stage>
</template>

<script setup>
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useDownloadsStore } from "@/stores/downloadsStore";
import DownloadItem from "@/components/downloads/DownloadItem.vue";

const route = useRoute();
const store = useDownloadsStore();
const loading = ref(false);
const failed = ref(false);

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    await store.load(route.params.orgId);
  } catch (e) {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.orgId, load, { immediate: true });
</script>

<style scoped lang="scss">
@use "../../styles/theme";

.section-header {
  margin-bottom: 24px;

  .section-description {
    font-size: 14px;
    color: theme.$gray_4;
    margin: 0;
    max-width: 600px;
  }
}

.loading-state,
.empty-state {
  padding: 48px 0;
  text-align: center;
  color: theme.$gray_4;

  h3 {
    color: theme.$gray_6;
    margin-bottom: 8px;
  }
}

.download-list {
  max-width: 720px;

  :deep(.download-item) {
    border-bottom: 1px solid theme.$gray_2;
  }
}
</style>
