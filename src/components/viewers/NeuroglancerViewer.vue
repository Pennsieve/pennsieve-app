<template>
  <div class="neuroglancer-viewer">
    <div v-if="loading" class="neuroglancer-status">
      Loading viewer assets...
    </div>
    <div v-else-if="error" class="neuroglancer-status neuroglancer-error">
      {{ error }}
    </div>
    <iframe
      v-else-if="iframeSrc"
      :src="iframeSrc"
      class="neuroglancer-iframe"
      allow="fullscreen"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import * as siteConfig from '@/site-config/site.json'

const props = defineProps({
  pkg: {
    type: Object,
    default: () => ({}),
  },
  asset: {
    type: Object,
    default: null,
  },
})

const iframeSrc = ref('')
const loading = ref(false)
const error = ref('')

const resolveSource = async (asset) => {
  if (!asset?.asset_url) {
    error.value = 'No viewer asset provided.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const cf = asset.cloudfront
    if (cf) {
      // Send signing params to the dev proxy
      const cfParamStr = `Policy=${cf.policy}&Signature=${cf.signature}&Key-Pair-Id=${cf.key_pair_id}`
      await fetch('/neuroglancer-cf-params', {
        method: 'POST',
        body: cfParamStr,
      }).catch(() => {})
    }

    // Use the proxy URL for dev, direct URL for production
    const assetPath = new URL(asset.asset_url).pathname
    const sourceUrl = siteConfig.environment === 'local'
      ? `http://localhost:3000/neuroglancer-cf-proxy${assetPath}`
      : asset.asset_url

    const state = JSON.stringify({
      layers: [
        {
          type: 'image',
          source: `zarr3://${sourceUrl}`,
          name: asset.name || 'data',
        },
      ],
      layout: 'xy',
    })
    iframeSrc.value = `/neuroglancer/index.html#!${state}`
  } catch (err) {
    console.error('NeuroglancerViewer:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

watch(() => props.asset, (asset) => {
  if (asset) {
    resolveSource(asset)
  }
}, { immediate: true })
</script>

<style scoped>
.neuroglancer-viewer {
  display: flex;
  flex: 1;
  min-height: 0;
}

.neuroglancer-iframe {
  width: 100%;
  height: 100%;
  border: none;
  flex: 1;
}

.neuroglancer-status {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #71747C;
  font-size: 14px;
}

.neuroglancer-error {
  color: #b91c1c;
}
</style>
