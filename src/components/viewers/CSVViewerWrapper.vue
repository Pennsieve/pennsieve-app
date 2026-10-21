// CSVViewerWrapper.vue - @pennsieve-viz/core CSVViewer, given its link
<template>
  <div class="csv-viewer-wrapper">
    <CSVViewer
      v-if="fileUrl"
      :src-url="fileUrl"
      :file-type="fileType"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { pathOr } from 'ramda'
import { CSVViewer } from '@pennsieve-viz/core'
import * as siteConfig from '@/site-config/site.json'
import { useGetToken } from '@/composables/useGetToken'
import EventBus from '@/utils/event-bus'
import { viewFileUrl } from '@/utils/viewFileUrl'
import { isScanPendingError, SCAN_POLL_LIMIT, SCAN_POLL_MS } from '@/utils/scan-status'

// The library can fetch its own link from pennsieve-api, given an apiUrl;
// it gets one from viewFileUrl instead, so download-service records the
// view and holds a file still being scanned (POAM-040). A held file is
// asked for again, like the static viewers do, until it is released.

const props = defineProps({
  pkg: {
    type: Object,
    default: () => ({})
  }
})

const fileUrl = ref('')
const fileType = computed(() => pathOr('', ['content', 'packageType'], props.pkg))
const packageId = computed(() => pathOr('', ['content', 'id'], props.pkg))

let viewFile = null
let retryTimer = null
let retryCount = 0

onMounted(async () => {
  try {
    const assets = await getViewerAssets(packageId.value)
    if (!assets.length) {
      console.error('[CSVViewerWrapper] No files found in /view response.')
      return
    }
    viewFile = assets[0]
    await getFileUrl()
  } catch (err) {
    console.error(err)
  }
})

onBeforeUnmount(() => clearTimeout(retryTimer))

async function getFileUrl() {
  try {
    fileUrl.value = await viewFileUrl({
      datasetId: pathOr('', ['content', 'datasetNodeId'], props.pkg),
      packageId: packageId.value,
      file: viewFile,
    })
  } catch (err) {
    if (!isScanPendingError(err)) {
      console.error(err)
      return
    }
    // Held until its malware scan finishes; the page says so.
    EventBus.$emit('download-scan-pending', { packageId: packageId.value })
    if (retryCount >= SCAN_POLL_LIMIT) return
    retryCount += 1
    retryTimer = setTimeout(getFileUrl, SCAN_POLL_MS)
  }
}

async function getViewerAssets(id: string) {
  const token = await useGetToken()
  const resp = await fetch(`${siteConfig.apiUrl}/packages/${id}/view?api_key=${token}`)
  if (!resp.ok) throw new Error(`could not list the package's files (${resp.status})`)
  return resp.json()
}
</script>

<style scoped>
.csv-viewer-wrapper {
  height: 100%;
  width: 100%;
}
</style>
