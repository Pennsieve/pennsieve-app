<template>
  <div class="chat-image-block">
    <div v-if="loading" class="image-skeleton" :aria-label="alt">
      <span class="loading-text">Loading figure…</span>
    </div>

    <a
      v-else-if="resolvedUrl"
      :href="packageHref"
      target="_blank"
      rel="noopener"
      class="image-link"
      :aria-label="alt + ' — open package'"
    >
      <img
        :src="resolvedUrl"
        :alt="alt"
        loading="lazy"
        class="figure"
        @error="onImgError"
      />
    </a>

    <a
      v-else
      :href="packageHref"
      target="_blank"
      rel="noopener"
      class="fallback-link"
    >
      View plot in package →
    </a>
  </div>
</template>

<script setup>
// ChatImageBlock — renders one inline figure produced by an MCP-triggered
// workflow (currently just plot_file). The frame carries no URL —
// (packageNodeId, datasetNodeId, assetName, assetType) coordinates only.
// This component resolves to a signed CloudFront URL by:
//
//   1. Calling the existing `fetchPackageViewerAssets` Vuex action against
//      packages-service `/packages/assets?dataset_id=…&package_id=…`.
//      Same call the package viewer uses for ome-zarr / neuroglancer
//      rendering — see ViewerPane.vue.
//   2. Picking the asset matching {name, asset_type}. When `assetName` is
//      empty, pick the most recently created asset of the requested type.
//   3. Building a query-string-signed URL:
//      `${asset.asset_url}figure.png?Policy=…&Signature=…&Key-Pair-Id=…`.
//      Query-string signing (vs. relying on the Set-Cookie machinery the
//      assets endpoint emits) works regardless of cross-domain cookie
//      attribute issues.
//
// On any error — API failure, no matching asset, image-load failure — the
// component falls back to a plain text-link pointing at the package
// viewer. Same UX older clients get from the plain-text `content` field.
//
// Filename convention: the `figure-asset` data-target writes `figure.png`
// at the asset's S3 prefix root. If a future workflow ships a different
// filename, the assets API would need to surface it; tracked as an open
// question in compute-node-chat/docs/developer/inline-image-frames.md.

import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'

const props = defineProps({
  // The image block from AssistantMessage.blocks[]. Required fields on
  // `source`: packageNodeId, datasetNodeId. Optional: assetName, assetType.
  block: { type: Object, required: true },
})

const store = useStore()

const loading = ref(true)
const resolvedUrl = ref('')

const alt = computed(() => props.block.alt || 'Inline figure')
const source = computed(() => props.block.source || {})

// Open-in-viewer fallback link. Matches the package-viewer route used
// elsewhere in the app — keep this aligned if/when that route changes.
const packageHref = computed(() => {
  const { packageNodeId, datasetNodeId } = source.value
  if (!packageNodeId || !datasetNodeId) return '#'
  // Active workspace org slug lives in the route; route name matches the
  // existing FileDetails entry point. router-link would be cleaner here
  // but we want an external anchor so users can mouse-middle-click into a
  // new tab without disrupting the chat session.
  return `/datasets/${datasetNodeId}/files/${packageNodeId}`
})

const onImgError = () => {
  // CloudFront returned an error for the signed URL — fall back to the
  // plain link by clearing resolvedUrl. Most likely cause: figure file
  // not at the expected filename (data-target convention drift).
  resolvedUrl.value = ''
}

onMounted(async () => {
  const { packageNodeId, datasetNodeId, assetName, assetType } = source.value

  if (!packageNodeId || !datasetNodeId) {
    loading.value = false
    return
  }

  try {
    const result = await store.dispatch('viewerModule/fetchPackageViewerAssets', {
      datasetId: datasetNodeId,
      packageId: packageNodeId,
    })

    if (!result?.assets?.length) {
      loading.value = false
      return
    }

    // Pick the right asset. Match on name + asset_type when both are
    // specified; fall back to asset_type only if name is empty; fall back
    // to "any ready asset" as a last resort. Sort by created_at desc so
    // the most recent run wins when a user plotted the same package
    // multiple times.
    const typeFilter = assetType || 'PNG'
    const candidates = result.assets
      .filter((a) => a.status === 'ready')
      .filter((a) => a.asset_type === typeFilter)
      .filter((a) => !assetName || a.name === assetName)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

    const asset = candidates[0]
    if (!asset || !asset.asset_url) {
      loading.value = false
      return
    }

    // Build the signed image URL. asset.asset_url ends with the asset's
    // S3-prefix slash; the figure-asset data-target writes `figure.png`
    // there. Sign with CloudFront query-string params from the API
    // response.
    const cf = result.cloudfront
    if (!cf?.policy || !cf?.signature || !cf?.key_pair_id) {
      // Asset exists but signing failed server-side — fall back.
      loading.value = false
      return
    }
    const qs = new URLSearchParams({
      Policy: cf.policy,
      Signature: cf.signature,
      'Key-Pair-Id': cf.key_pair_id,
    })
    resolvedUrl.value = `${asset.asset_url}figure.png?${qs.toString()}`
  } catch (err) {
    // Permission denied / network / shape change — log and degrade.
    // eslint-disable-next-line no-console
    console.warn('[chat] ChatImageBlock: asset resolve failed', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
.chat-image-block {
  margin: 4px 0;
}

.image-skeleton {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 480px;
  aspect-ratio: 4 / 3;
  background: #e8eaed;
  border-radius: 8px;

  .loading-text {
    color: #6b6b6b;
    font-size: 13px;
  }
}

.image-link {
  display: inline-block;
  line-height: 0; // collapse the anchor's text-baseline gap below the img
}

.figure {
  display: block;
  max-width: 480px;
  width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid #e0e2e6;
}

.fallback-link {
  display: inline-block;
  color: #5039f5;
  font-size: 13px;
  text-decoration: underline;
}
</style>
