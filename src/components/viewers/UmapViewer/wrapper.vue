<template>
  <div class="umap-wrapper">
    <div v-if="isLoading" class="umap-placeholder">
      <div class="placeholder-content">
        <span class="loading-spinner"></span>
        <p>Loading UMAP visualization...</p>
      </div>
    </div>
    <div v-else-if="error" class="umap-placeholder umap-error">
      <div class="placeholder-content">
        <p>{{ error }}</p>
      </div>
    </div>
    <div v-else-if="!srcUrl" class="umap-placeholder">
      <div class="placeholder-content">
        <p>No parquet file available for UMAP visualization</p>
      </div>
    </div>
    <UMAP
      v-else
      :instance-id="instanceId"
      :src-url="srcUrl"
      src-file-type="parquet"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, defineProps } from 'vue';
import { pathOr } from 'ramda';
import { UMAP } from '@pennsieve-viz/core';
import { useGetToken } from '@/composables/useGetToken';
import * as siteConfig from '@/site-config/site.json';

const props = defineProps({
  pkg: {
    type: Object,
    default: () => ({})
  }
});

const srcUrl = ref('');
const isLoading = ref(true);
const error = ref('');

// Generate unique instance ID based on package ID
const instanceId = computed(() => {
  const pkgId = pathOr('', ['content', 'id'], props.pkg);
  return pkgId ? `umap-${pkgId}` : `umap-${Date.now()}`;
});

/**
 * Fetch viewer assets for the package
 */
async function getViewerAssets() {
  const pkgId = pathOr('', ['content', 'id'], props.pkg);
  if (!pkgId) {
    throw new Error('Package ID not found');
  }

  const token = await useGetToken();
  const url = `${siteConfig.apiUrl}/packages/${pkgId}/view?api_key=${token}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch viewer assets');
  }

  return await response.json();
}

/**
 * Get presigned URL for a file
 */
async function getFileUrl(fileId) {
  const pkgId = pathOr('', ['content', 'id'], props.pkg);
  const token = await useGetToken();
  const url = `${siteConfig.apiUrl}/packages/${pkgId}/files/${fileId}?api_key=${token}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch file URL');
  }

  const result = await response.json();
  return result.url;
}

/**
 * Find the parquet file from viewer assets
 */
function findParquetFile(assets) {
  if (!assets || assets.length === 0) {
    return null;
  }

  // Look for a parquet file in the assets
  const parquetAsset = assets.find(asset => {
    const fileName = pathOr('', ['content', 'name'], asset).toLowerCase();
    return fileName.endsWith('.parquet');
  });

  // If no explicit parquet file found, use the first asset
  return parquetAsset || assets[0];
}

onMounted(async () => {
  try {
    isLoading.value = true;
    error.value = '';

    const viewerAssets = await getViewerAssets();

    if (!viewerAssets || viewerAssets.length === 0) {
      error.value = 'No viewer assets found for this package';
      return;
    }

    const parquetFile = findParquetFile(viewerAssets);
    if (!parquetFile) {
      error.value = 'No parquet file found in viewer assets';
      return;
    }

    const fileId = pathOr('', ['content', 'id'], parquetFile);
    if (!fileId) {
      error.value = 'File ID not found';
      return;
    }

    srcUrl.value = await getFileUrl(fileId);
  } catch (err) {
    console.error('UMAP viewer error:', err);
    error.value = err.message || 'Failed to load UMAP visualization';
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
.umap-wrapper {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.umap-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  background: #f5f5f5;
}

.umap-error {
  background: #fff5f5;
}

.umap-error p {
  color: #c53030;
}

.placeholder-content {
  text-align: center;
  color: #666;
}

.loading-spinner {
  display: inline-block;
  width: 40px;
  height: 40px;
  border: 3px solid #e0e0e0;
  border-radius: 50%;
  border-top-color: #2760ff;
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
