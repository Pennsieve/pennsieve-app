<template>
  <div class="neuroglancer-viewer">
    <OrthogonalFrame
      v-if="asset?.asset_url"
      :source="asset.asset_url"
      :embed-url="embedUrl"
      :cloudfront="asset.cloudfront || null"
      @error="onError"
    />
    <div v-else-if="error" class="neuroglancer-status neuroglancer-error">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { OrthogonalFrame } from '@pennsieve-viz/core'
import * as siteConfig from '@/site-config/site.json'

defineProps({
  pkg: {
    type: Object,
    default: () => ({}),
  },
  asset: {
    type: Object,
    default: null,
  },
})

const error = ref('')
const embedUrl = siteConfig.neuroglancerUrl || 'https://orthogonal-viewer.pennsieve.net'

function onError(msg) {
  error.value = msg
}
</script>

<style scoped>
.neuroglancer-viewer {
  display: flex;
  flex: 1;
  min-height: 800px;
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
