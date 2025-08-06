<template>
  <div class="app-container">
    <canvas id="gl" height="480" width="640"/>
  </div>
</template>

<script setup lang="ts">
import {defineProps, onMounted, ref} from 'vue';
import {pathOr} from "ramda";
import {useGetToken} from "@/composables/useGetToken";
import * as siteConfig from '@/site-config/site.json'
import {Niivue} from '@niivue/niivue'



const props = defineProps({
  pkg: {
    type: Object,
    default: {}
  }

})

const viewAssets = ref([])

onMounted(async () => {
  try {
    // get Viewer Assets
    const nv = new Niivue()
    await getViewerAssets()
    let presignedUrl = await getFileUrl(viewAssets.value[0].content.id)
    console.log(presignedUrl)
    await nv.attachTo('gl')
    await nv.loadVolumes([{url: presignedUrl}])

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

<style>
.app-container {
  height: 90vh;
  position: relative;
}
</style>