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
import EventBus from '@/utils/event-bus'
import { viewFileUrl } from '@/utils/viewFileUrl'
import { isScanPendingError } from '@/utils/scan-status'

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
    presignedUrl.value = await viewFileUrl({
      datasetId: pathOr('', ['content', 'datasetNodeId'], props.pkg),
      packageId: pathOr('', ['content', 'id'], props.pkg),
      file: viewAssets.value[0],
    })

    if (props.pkg.content.packageType === "CSV") {
      fileType.value = "csv"
    }

  } catch (err) {
    if (isScanPendingError(err)) {
      // Held until its malware scan finishes; the page says so.
      EventBus.$emit('download-scan-pending', { packageId: pathOr('', ['content', 'id'], props.pkg) })
      return
    }
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
</script>

<style scoped>
.app-container {
  position: relative;
}
</style>