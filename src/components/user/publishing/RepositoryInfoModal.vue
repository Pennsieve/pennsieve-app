<script setup>
import { ref, watch } from "vue";
import BfDialogHeader from "@/components/shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "@/components/shared/dialog-body/DialogBody.vue";
import MarkdownEditor from "@/components/shared/MarkdownEditor/MarkdownEditor.vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";

const { repository = {} } = defineProps({
  repository: {
    type: Object,
    default: () => ({}),
  },
});

const isDialogVisible = defineModel("dialogVisible", { type: Boolean, default: false });

const overviewText = ref("");
const isLoadingOverview = ref(false);

async function loadOverview(abortSignal) {
  const fallbackText = repository.description || "No detailed information available for this repository.";
  if (!repository.overviewDocument) {
    overviewText.value = fallbackText;
    isLoadingOverview.value = false;
    return;
  }

  isLoadingOverview.value = true;
  try {
    const response = await fetch(repository.overviewDocument, { signal: abortSignal });
    overviewText.value = response.ok ? await response.text() : fallbackText;
  } catch (error) {
    // Cancelled because the dialog closed or reopened; the newer load owns the state
    if (abortSignal.aborted) return;
    console.error("Error fetching repository overview:", error);
    overviewText.value = fallbackText;
  }
  isLoadingOverview.value = false;
}

// Only fetch when opened; the panel sets the repository and opens in one tick
watch(isDialogVisible, (isVisible, _wasVisible, onCleanup) => {
  if (!isVisible) return;

  // Cancel this fetch when the dialog closes, so a slow response for a
  // previous repository can't overwrite the one now showing
  const abortController = new AbortController();
  onCleanup(() => abortController.abort());
  loadOverview(abortController.signal);
});
</script>

<template>
  <el-dialog
    v-model="isDialogVisible"
    width="640px"
    align-center
    :show-close="false"
  >
    <template #header>
      <div class="repository-header">
        <span v-if="repository.logoFile" class="repository-logo">
          <img :src="repository.logoFile" alt="" />
        </span>
        <bf-dialog-header
          class="repository-title"
          :title="repository.displayName || 'Repository'"
        />
      </div>
    </template>

    <dialog-body>
      <div class="repository-overview">
        <el-skeleton v-if="isLoadingOverview" :rows="5" animated />
        <markdown-editor
          v-else
          :value="overviewText"
          :is-editing="false"
          :is-saving="false"
          :is-loading="false"
        />
      </div>
    </dialog-body>

    <template #footer>
      <bf-button class="secondary" @click="isDialogVisible = false">Close</bf-button>
      <a
        v-if="repository.url"
        :href="repository.url"
        target="_blank"
        rel="noopener noreferrer"
        class="ml-8"
      >
        <bf-button class="primary">Visit Repository</bf-button>
      </a>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "@/styles/theme";
@use "@/styles/element/dialog";

.repository-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.repository-title {
  flex: 1;
  min-width: 0;
}

.repository-logo {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 1px solid theme.$gray_2;
  background: theme.$white;
  overflow: hidden;

  img {
    max-width: 40px;
    max-height: 40px;
    object-fit: contain;
  }
}

// Fixed height so every repository's dialog is the same size and stays centered;
// longer overviews scroll inside it
.repository-overview {
  height: min(360px, 50vh);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 8px;

  // MarkdownEditor's sizes are built for full-page docs; scale them down for a dialog
  :deep(.content-wrap) {
    padding: 0;
  }

  :deep(h1) {
    font-size: 20px;
    line-height: 28px;
    margin: 0 0 8px;
  }

  :deep(h2) {
    font-size: 16px;
    line-height: 24px;
    margin: 24px 0 8px;
  }

  :deep(h3) {
    font-size: 14px;
    line-height: 20px;
    margin: 16px 0 8px;
  }

  :deep(p),
  :deep(li) {
    font-size: 14px;
    line-height: 22px;
    color: theme.$gray_5;
  }

  :deep(img) {
    max-width: 100%;
  }
}
</style>
