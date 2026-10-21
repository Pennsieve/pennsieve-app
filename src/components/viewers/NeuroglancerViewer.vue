<template>
  <div class="neuroglancer-viewer">
    <OrthogonalFrame
      v-if="asset?.asset_url"
      :source="asset.asset_url"
      :embed-url="embedUrl"
      :cloudfront="cloudfront"
      @error="onError"
    />
    <div v-else-if="error" class="neuroglancer-status neuroglancer-error">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import {
  OrthogonalFrame,
  useCloudfrontCredentials,
  fetchViewerAssetById,
} from '@pennsieve-viz/core'
import { useGetToken } from '@/composables/useGetToken'
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

const error = ref('')

// CloudFront policies last an hour; renew them ahead of expiry so tiles keep
// loading in a long session. OrthogonalFrame forwards each renewal to the
// embedded viewer's service worker.
const { cloudfront } = useCloudfrontCredentials({
  // A copy per asset: every asset in a package shares the listing's credentials
  // object, so returning it directly wouldn't register an asset switch, and the
  // previous asset's renewed (possibly asset-scoped) credentials would carry over.
  initial: () => (props.asset?.cloudfront ? { ...props.asset.cloudfront } : null),
  renew: async () => {
    const { cloudfront } = await fetchViewerAssetById({
      api2Url: siteConfig.api2Url,
      assetId: props.asset.id,
      datasetId: props.pkg?.content?.datasetNodeId,
      getToken: useGetToken,
    })
    return cloudfront
  },
})

const embedUrl = siteConfig.neuroglancerUrl || 'https://orthogonal-viewer.pennsieve.net'

function onError(msg) {
  error.value = msg
}
</script>

<style scoped>
.neuroglancer-viewer {
  display: flex;
  flex: 1;
  height: inherit;
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

:deep(.orthogonal-frame) {
  height: inherit !important;
}
</style>
