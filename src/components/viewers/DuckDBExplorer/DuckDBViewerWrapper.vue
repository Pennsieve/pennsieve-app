// DuckDBViewerWrapper.vue - Updated to use @pennsieve-viz/core DataExplorer
<template>
  <div class="app-container">
    <DataExplorer
      v-if="presignedUrl"
      :instance-id="instanceId"
      :src-url="presignedUrl"
      :src-file-type="fileType"
      :src-file-id="fileId"
    />
  </div>
</template>

<script setup lang="ts">
import {defineProps, onMounted, ref, computed} from 'vue';
import {pathOr} from "ramda";
import {useGetToken} from "@/composables/useGetToken";
import * as siteConfig from '@/site-config/site.json'
import { DataExplorer } from '@pennsieve-viz/core';

const props = defineProps({
  pkg: {
    type: Object,
    default: {}
  }
})

const viewAssets = ref([])
const fileType = ref("parquet")
const presignedUrl = ref("")
const fileId = ref("")

// Generate unique instance ID based on package ID for multi-instance support
const instanceId = computed(() => {
  const pkgId = pathOr('', ['content', 'id'], props.pkg);
  return pkgId ? `data-explorer-${pkgId}` : `data-explorer-${Date.now()}`;
});

onMounted(async () => {
  try {
    // get Viewer Assets
    await getViewerAssets()
    
    // Extract stable file ID and convert to string
    fileId.value = String(viewAssets.value[0].content.id)

    // Get presigned URL
    presignedUrl.value = await getFileUrl(fileId.value)

    if (props.pkg.content.packageType === "CSV") {
      fileType.value = "csv"
    }

  } catch (err) {
    console.error(err);
  }
})

async function getViewerAssets() {
  const pkgId = pathOr('', ['content', 'id'], props.pkg)
  const token = await useGetToken()
  const url = `${siteConfig.apiUrl}/packages/${pkgId}/view?api_key=${token}`
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      viewAssets.value = await response.json()
      return
    }

    if (!response.ok) {
      return;
    }
  } catch (err) {
    console.error(err)
    throw err;
  }
}

async function getFileUrl(fileId) {
  const pkgId = pathOr('', ['content', 'id'], props.pkg)
  const token = await useGetToken()
  const url = `${siteConfig.apiUrl}/packages/${pkgId}/files/${fileId}?api_key=${token}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const result = await response.json()
      return result.url;
    }

    if (!response.ok) {
      return;
    }

  } catch (err) {
    console.error(err)
    throw err;
  }
}
</script>

<style scoped>
.app-container {
  position: relative;
}
</style>