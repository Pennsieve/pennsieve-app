<template>
  <bf-stage slot="stage">
    <div class="section">
      <div class="section-header">
        <p class="section-description">
          Results of your runs, from any workspace and outside them, zipped by
          the runs' download targets. They're kept for 3 days; download them as
          often as you like until then.
        </p>
      </div>

      <div v-if="loading" v-loading="loading" class="loading-state">
        <p>Loading downloads...</p>
      </div>

      <div v-else-if="failed" class="empty-state">
        <h3>Downloads couldn't be loaded</h3>
        <el-button size="small" @click="load">Try again</el-button>
      </div>

      <div v-else-if="runDownloads.length === 0" class="empty-state">
        <h3>No downloads</h3>
        <p>When a run ends with a download target, its results appear here.</p>
      </div>

      <div v-else class="download-list">
        <download-item v-for="d in runDownloads" :key="d.id" :download="d" />
      </div>
    </div>
  </bf-stage>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useDownloadsStore, isRun } from "@/stores/downloadsStore";
import DownloadItem from "@/components/downloads/DownloadItem.vue";

// My Workspace's downloads: the user's run archives. download-service's
// emails for them link here.
const store = useDownloadsStore();
const loading = ref(false);
const failed = ref(false);

const runDownloads = computed(() => store.downloads.filter(isRun));

async function load() {
  loading.value = true;
  failed.value = false;
  try {
    await store.loadRuns();
  } catch (e) {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
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
