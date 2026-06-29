<template>
  <div class="public-dataset-file-details">
    <router-link :to="{ name: 'public-dataset-files', params: { datasetId } }" class="back-link">
      <IconArrowLeft :width="16" :height="16" color="currentColor" />
      <span>Files</span>
    </router-link>

    <div v-if="isLoading" class="state" v-loading="true">
      <p>Loading file...</p>
    </div>

    <div v-else-if="!file" class="state">
      <h3>File not found</h3>
      <p>This file may no longer exist in the dataset.</p>
    </div>

    <div v-else class="concept-instance-section">
      <div class="details-actions">
        <bf-button
          class="primary"
          :processing="isDownloading"
          processing-text="Preparing…"
          @click="onDownload"
        >
          Download
        </bf-button>
      </div>

      <div class="file-list">
        <concept-instance-static-property :label="'File name'">
          {{ file.name }}
        </concept-instance-static-property>

        <concept-instance-static-property :label="'File type'">
          {{ fileType }}
        </concept-instance-static-property>

        <concept-instance-static-property label="Location">
          <router-link :to="{ name: 'public-dataset-files', params: { datasetId } }">
            {{ locationPath }}
          </router-link>
        </concept-instance-static-property>

        <concept-instance-static-property label="File size">
          {{ formatBytes(file.size) }}
        </concept-instance-static-property>

        <concept-instance-static-property v-if="file.createdAt" label="Created" :date="file.createdAt" />

        <concept-instance-static-property v-if="file.sha256" label="Checksum (SHA-256)">
          {{ file.sha256 }}
        </concept-instance-static-property>
      </div>

      <!-- Preview -->
      <div class="preview-section">
        <div class="preview-header">Preview</div>

        <div v-if="isPreviewLoading" class="preview-state" v-loading="true">
          <p>{{ previewLoadingMessage }}</p>
        </div>
        <div v-else-if="previewError" class="preview-state">
          <p>Unable to load a preview for this file.</p>
        </div>
        <div v-else-if="!activeViewer" class="preview-state">
          <p>No preview available for this file type.</p>
        </div>

        <div v-else class="preview-body">
          <img
            v-if="activeViewer.component === 'img'"
            class="preview-image"
            :src="imgSourceUrl"
            :alt="file.name"
          />
          <component
            :is="viewerComponents[activeViewer.component]"
            v-else
            v-bind="currentViewerProps"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, defineAsyncComponent } from "vue";
import { useRoute } from "vue-router";
import { useReadOnlyDatasetStore } from "@/stores/readOnlyDatasetStore.js";
import ConceptInstanceStaticProperty from "@/components/datasets/explore/ConceptInstance/ConceptInstanceStaticProperty.vue";
import IconArrowLeft from "@/components/icons/IconArrowLeft.vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import { triggerBrowserDownload } from "@/utils/triggerBrowserDownload.js";
import { resolveViewer } from "./viewerRegistry.js";
import "@pennsieve-viz/core/style.css";
import "@pennsieve-viz/micro-ct/style.css";

// Reuse the same viewer components discover-app2 uses.
const viewerComponents = {
  Markdown: defineAsyncComponent(() =>
    import("@pennsieve-viz/core").then((m) => m.Markdown)
  ),
  TextViewer: defineAsyncComponent(() =>
    import("@pennsieve-viz/core").then((m) => m.TextViewer)
  ),
  OmeViewer: defineAsyncComponent(() =>
    import("@pennsieve-viz/micro-ct").then((m) => m.OmeViewer)
  ),
};

const props = defineProps({
  dataset: {
    type: Object,
    required: true,
  },
});

const route = useRoute();
const store = useReadOnlyDatasetStore();

const file = ref(null);
const isLoading = ref(false);
const isDownloading = ref(false);

// Preview state
const imgSourceUrl = ref("");
const fileContent = ref("");
const isPreviewLoading = ref(false);
const previewError = ref(false);

const activeViewer = computed(() =>
  file.value ? resolveViewer(file.value.path || file.value.name, file.value.packageType) : null
);

const previewLoadingMessage = computed(
  () => activeViewer.value?.loadingMessage || "Loading preview..."
);

const currentViewerProps = computed(() => {
  if (!activeViewer.value?.getProps) return {};
  return activeViewer.value.getProps({
    fileUri: file.value?.path || file.value?.name || "",
    imgSourceUrl: imgSourceUrl.value,
    fileContent: fileContent.value,
  });
});

const datasetId = computed(() => route.params.datasetId);
const filePath = computed(() => route.query.path || "");

const parentPath = computed(() => {
  const segments = filePath.value.split("/");
  segments.pop();
  return segments.join("/");
});

const locationPath = computed(() => {
  const parent = parentPath.value;
  return parent ? `Files / ${parent.split("/").join(" / ")}` : "Files";
});

const fileType = computed(() => {
  if (!file.value) return "";
  return file.value.fileType || file.value.packageType || "File";
});

const load = async () => {
  if (!filePath.value) return;
  isLoading.value = true;
  try {
    // Re-browse the parent folder and find the file entry by its full path.
    const result = await store.browseFiles({
      id: props.dataset.id,
      version: props.dataset.version,
      path: parentPath.value,
      limit: 500,
      offset: 0,
    });
    file.value = result.files.find((f) => f.path === filePath.value) || null;
    preparePreview();
  } catch (e) {
    console.error("Error loading file details:", e);
    file.value = null;
  } finally {
    isLoading.value = false;
  }
};

const preparePreview = async () => {
  imgSourceUrl.value = "";
  fileContent.value = "";
  previewError.value = false;

  const viewer = activeViewer.value;
  if (!viewer || !viewer.needs) return;

  isPreviewLoading.value = true;
  try {
    if (viewer.needs === "url") {
      imgSourceUrl.value = await store.getFileDownloadUrl({
        id: props.dataset.id,
        version: props.dataset.version,
        path: filePath.value,
      });
    } else if (viewer.needs === "content") {
      fileContent.value = await store.getFileContent({
        id: props.dataset.id,
        version: props.dataset.version,
        path: filePath.value,
      });
    }
  } catch (e) {
    console.error("Error preparing preview:", e);
    previewError.value = true;
  } finally {
    isPreviewLoading.value = false;
  }
};

onMounted(load);
watch(filePath, load);

const onDownload = async () => {
  if (!file.value) return;
  isDownloading.value = true;
  try {
    const url = await store.getFileDownloadUrl({
      id: props.dataset.id,
      version: props.dataset.version,
      path: filePath.value,
    });
    if (url) triggerBrowserDownload(url, file.value.name);
  } catch (e) {
    console.error("Error preparing download:", e);
  } finally {
    isDownloading.value = false;
  }
};

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: theme.$purple_2;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  margin-bottom: 24px;

  &:hover {
    text-decoration: underline;
  }
}

.state {
  padding: 32px 24px;
  text-align: center;
  color: theme.$gray_4;

  h3 {
    color: theme.$gray_5;
    font-weight: 300;
    margin: 0 0 8px 0;
  }
}

.details-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.file-list {
  border-top: 1px solid theme.$gray_2;
}

.preview-section {
  margin-top: 32px;
}

.preview-header {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
  padding-bottom: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid theme.$gray_2;
}

.preview-state {
  padding: 32px 24px;
  text-align: center;
  color: theme.$gray_4;
  background: theme.$gray_1;
  border-radius: 4px;
}

.preview-body {
  .preview-image {
    max-width: 100%;
    height: auto;
    display: block;
  }
}
</style>
