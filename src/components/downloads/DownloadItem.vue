<template>
  <div class="download-item" :data-status="download.status">
    <div class="details">
      <div class="name" :title="download.archiveName">{{ download.archiveName }}</div>
      <div class="status">{{ statusText }}</div>
      <el-progress
        v-if="download.status === 'RUNNING'"
        :percentage="percent"
        :show-text="false"
        :stroke-width="4"
      />
    </div>
    <div class="actions">
      <el-button
        v-if="download.status === 'READY'"
        type="primary"
        size="small"
        :loading="busy"
        @click="onDownload"
      >
        Download
      </el-button>
      <el-button v-if="active" size="small" :loading="busy" @click="onRemove">
        Cancel
      </el-button>
      <el-button v-else size="small" text :loading="busy" @click="onRemove">
        Remove
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useDownloadsStore, isActive, humanSize } from "@/stores/downloadsStore";
import EventBus from "@/utils/event-bus";

const props = defineProps({
  download: { type: Object, required: true },
});

const store = useDownloadsStore();
const busy = ref(false);

const active = computed(() => isActive(props.download));

const percent = computed(() => {
  const { bytesDone = 0, totalBytes = 0 } = props.download;
  return totalBytes > 0 ? Math.min(100, Math.round((bytesDone / totalBytes) * 100)) : 0;
});

const statusText = computed(() => {
  const d = props.download;
  const files = `${d.fileCount} ${d.fileCount === 1 ? "file" : "files"}`;
  switch (d.status) {
    case "QUEUED":
      return `Waiting to start · ${files}, ${humanSize(d.totalBytes)}`;
    case "RUNNING":
      return `Zipping ${d.filesDone} of ${files}`;
    case "READY": {
      const until = d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : "";
      const size = humanSize(d.archiveBytes || d.totalBytes);
      const ready = until ? `Ready · ${size} · until ${until}` : `Ready · ${size}`;
      const skipped = d.skippedCount || 0;
      return skipped
        ? `${ready} · ${skipped} ${skipped === 1 ? "file" : "files"} couldn't be included (listed in the zip)`
        : ready;
    }
    case "FAILED":
      return d.error || "The download failed. Try again.";
    case "CANCELLED":
      return "Cancelled";
    default:
      return d.status;
  }
});

async function run(action, failure) {
  busy.value = true;
  try {
    await action();
  } catch (e) {
    EventBus.$emit("toast", { detail: { type: "error", msg: failure } });
  } finally {
    busy.value = false;
  }
}

const onDownload = () => run(() => store.download(props.download), "Unable to download the archive. Try again.");
const onRemove = () => run(() => store.remove(props.download), "Unable to update the download. Try again.");
</script>

<style lang="scss" scoped>
@use "../../styles/theme";

.download-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;

  .details {
    flex: 1;
    min-width: 0;
  }

  .name {
    color: theme.$gray_6;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status {
    color: theme.$gray_4;
    font-size: 12px;
    margin: 2px 0 4px;
  }

  &[data-status="FAILED"] .status {
    color: theme.$red_2;
  }

  .actions {
    display: flex;
    flex-shrink: 0;
  }
}
</style>
