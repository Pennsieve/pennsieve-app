<template>
  <div class="public-dataset-files">
    <!-- Breadcrumbs -->
    <div class="breadcrumbs">
      <span class="crumb" :class="{ active: !currentPath }" @click="navigateTo('')">
        Files
      </span>
      <template v-for="(crumb, i) in pathCrumbs" :key="i">
        <span class="sep">/</span>
        <span
          class="crumb"
          :class="{ active: i === pathCrumbs.length - 1 }"
          @click="navigateTo(crumb.path)"
        >
          {{ crumb.name }}
        </span>
      </template>
    </div>

    <div v-show="selectedFiles.length > 0" class="selection-bar">
      <span class="selection-count">{{ selectedFiles.length }} selected</span>
      <div class="selection-actions">
        <button
          class="selection-action-btn"
          :disabled="isDownloading"
          @click="onDownloadSelected"
        >
          <IconUpload :height="14" :width="14" />
          {{ isDownloading ? "Preparing…" : "Download" }}
        </button>
      </div>
      <button class="selection-action-btn selection-clear" @click="clearSelection">
        Clear
      </button>
    </div>

    <files-table
      ref="filesTable"
      :data="rows"
      :table-loading="isLoading"
      @click-file-label="onClickFile"
      @selection-change="onSelectionChange"
    />

    <div v-if="totalCount > pageSize" class="pagination-container">
      <el-pagination
        :page-size="pageSize"
        :current-page="currentPage"
        layout="prev, pager, next"
        :total="totalCount"
        @current-change="onPageChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useReadOnlyDatasetStore } from "@/stores/readOnlyDatasetStore.js";
import { useDownloadsStore } from "@/stores/downloadsStore.js";
import { triggerBrowserDownload } from "@/utils/triggerBrowserDownload.js";
import EventBus from "@/utils/event-bus";
import FilesTable from "@/components/FilesTable/FilesTable.vue";
import IconUpload from "@/components/icons/IconUpload.vue";

const props = defineProps({
  dataset: {
    type: Object,
    required: true,
  },
});

const store = useReadOnlyDatasetStore();
const router = useRouter();

const filesTable = ref(null);
const selectedFiles = ref([]);
const isDownloading = ref(false);

const onSelectionChange = (selection) => {
  selectedFiles.value = selection || [];
};

const clearSelection = () => {
  filesTable.value?.clearAllSelected();
  selectedFiles.value = [];
};

const files = ref([]);
const totalCount = ref(0);
const currentPath = ref("");
const currentPage = ref(1);
const pageSize = ref(100);
const isLoading = ref(false);

const pathCrumbs = computed(() => {
  if (!currentPath.value) return [];
  const segments = currentPath.value.split("/");
  return segments.map((name, i) => ({
    name,
    path: segments.slice(0, i + 1).join("/"),
  }));
});

const isDirectory = (file) => file.type === "Directory";

// Map a Discover file-browse entry onto the shape FilesTable / BfFileLabel expect.
const rows = computed(() =>
  files.value.map((f) => {
    const dir = isDirectory(f);
    return {
      content: {
        id: f.path,
        nodeId: f.path,
        name: f.name,
        packageType: dir ? "Collection" : f.packageType || "Unsupported",
        state: "READY",
        createdAt: f.createdAt || null,
      },
      icon: dir ? "Folder" : f.icon || "Generic",
      storage: f.size || 0,
      subtype: dir ? "Folder" : f.fileType || "",
      type: f.type,
      _path: f.path,
      _isDir: dir,
    };
  })
);

const load = async () => {
  isLoading.value = true;
  try {
    const result = await store.browseFiles({
      id: props.dataset.id,
      version: props.dataset.version,
      path: currentPath.value,
      limit: pageSize.value,
      offset: (currentPage.value - 1) * pageSize.value,
    });
    files.value = result.files;
    totalCount.value = result.totalCount;
  } catch (e) {
    console.error("Error loading files:", e);
    files.value = [];
    totalCount.value = 0;
  } finally {
    isLoading.value = false;
  }
};

const navigateTo = (path) => {
  if (path === currentPath.value) return;
  currentPath.value = path;
  currentPage.value = 1;
  load();
};

const onClickFile = (row) => {
  if (row._isDir) {
    navigateTo(row._path);
  } else {
    router.push({
      name: "public-dataset-file-details",
      params: { datasetId: props.dataset.id },
      query: { path: row._path },
    });
  }
};

const onDownloadSelected = async () => {
  const selection = selectedFiles.value;
  if (!selection.length) return;

  // A single file downloads directly through its link; anything else
  // (several files, or a folder) is zipped by download-service, and the
  // downloads panel follows it.
  const isSingleFile = selection.length === 1 && !selection[0]._isDir;

  isDownloading.value = true;
  try {
    if (isSingleFile) {
      const path = selection[0]._path;
      const url = await store.getFileDownloadUrl({
        id: props.dataset.id,
        version: props.dataset.version,
        path,
      });
      if (url) triggerBrowserDownload(url, selection[0].content?.name);
    } else {
      await useDownloadsStore().startPublic({
        datasetId: props.dataset.id,
        version: props.dataset.version,
        paths: selection.map((f) => f._path),
        rootPath: currentPath.value || undefined,
        archiveName: selection.length === 1 ? selection[0].content?.name : props.dataset.name,
      });
    }
  } catch (e) {
    // Too large, no access, over a daily allowance: the service says why.
    const reason = e.status >= 400 && e.status < 500 && e.message
      ? e.message.charAt(0).toUpperCase() + e.message.slice(1)
      : "The download couldn't be started. Try again.";
    EventBus.$emit("toast", { detail: { type: "error", msg: reason } });
  } finally {
    isDownloading.value = false;
  }
};

const onPageChange = (page) => {
  currentPage.value = page;
  load();
};

onMounted(load);
watch(
  () => props.dataset.id,
  () => {
    currentPath.value = "";
    currentPage.value = 1;
    load();
  }
);
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.public-dataset-files {
  display: flex;
  flex-direction: column;
}

.breadcrumbs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.crumb {
  color: theme.$purple_2;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &.active {
    color: theme.$gray_5;
    cursor: default;

    &:hover {
      text-decoration: none;
    }
  }
}

.sep {
  color: theme.$gray_3;
}

.selection-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: theme.$gray_1;
  gap: 8px;

  .selection-count {
    font-size: 12px;
    font-weight: 600;
    color: theme.$gray_6;
    white-space: nowrap;
    margin-right: 8px;
  }

  .selection-actions {
    display: flex;
    align-items: center;
    gap: 0;
  }
}

.selection-action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: theme.$gray_5;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s ease, color 0.15s ease;
  white-space: nowrap;

  &:hover {
    background: white;
    color: theme.$purple_3;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.selection-clear {
    margin-left: auto;
    color: theme.$gray_4;
    &:hover {
      color: theme.$gray_6;
    }
  }
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
</style>
