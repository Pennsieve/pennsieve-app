// App.vue - Main Application Component
<template>
  <div class="app-container">

    <dbduck-viewer
      :url="presignedUrl"
      :file-type=fileType
    />

  </div>
</template>

<script setup lang="ts">
import {defineProps, onMounted, ref, watch} from 'vue';
import {pathOr} from "ramda";
import {useGetToken} from "@/composables/useGetToken";
import * as siteConfig from '@/site-config/site.json'
import DbduckViewer from "./dbduckViewer.vue";


const props = defineProps({
  pkg: {
    type: Object,
    default: {}
  }

})

const viewAssets = ref([])
const fileType = ref("parquet")

const presignedUrl = ref("")

onMounted(async () => {
  try {
    // get Viewer Assets
    await getViewerAssets()
    presignedUrl.value = await getFileUrl(viewAssets.value[0].content.id)

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

<style scoped >
  .app-container {
    position: relative;
  }
</style>