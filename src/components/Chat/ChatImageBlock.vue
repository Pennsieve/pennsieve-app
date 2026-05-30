<template>
  <div class="chat-image-block">
    <div v-if="loading" class="image-skeleton" :aria-label="alt">
      <span class="loading-text">Loading figure…</span>
    </div>

    <div v-else-if="resolvedUrl" class="figure-wrap">
      <a
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
      <!-- Download to the browser's downloads folder. Revealed on hover so
           it doesn't clutter the figure at rest. -->
      <button
        type="button"
        class="download-btn"
        :title="`Download ${downloadName}`"
        :aria-label="`Download ${downloadName}`"
        :disabled="downloading"
        @click="downloadImage"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 1.5v7.4m0 0L4.8 5.7M8 8.9l3.2-3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M2.5 11v2a1 1 0 001 1h9a1 1 0 001-1v-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

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
const downloading = ref(false)

const alt = computed(() => props.block.alt || 'Inline figure')
const source = computed(() => props.block.source || {})

// Filename for the downloaded file. Prefer the asset's own name; fall back
// to the figure-asset convention (figure.png). Ensure a .png extension so
// the OS treats it as an image.
const downloadName = computed(() => {
  const name = (source.value.assetName || '').trim()
  if (!name) return 'figure.png'
  return /\.[a-z0-9]+$/i.test(name) ? name : `${name}.png`
})

// Download the figure to the browser's downloads folder. The signed
// CloudFront URL is cross-origin, so a plain <a download> would be ignored
// (the browser would navigate instead). Fetch the bytes and save via an
// object URL. If the fetch is blocked (e.g. CORS), fall back to opening the
// image in a new tab so the user can still save it manually.
const downloadImage = async () => {
  if (!resolvedUrl.value || downloading.value) return
  downloading.value = true
  try {
    const resp = await fetch(resolvedUrl.value)
    if (!resp.ok) throw new Error(`status ${resp.status}`)
    const blob = await resp.blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = downloadName.value
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objUrl)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[chat] ChatImageBlock: download failed, opening in new tab', err)
    window.open(resolvedUrl.value, '_blank', 'noopener')
  } finally {
    downloading.value = false
  }
}

// Open-in-viewer fallback link. Matches the `file-record` route registered
// in router/index.js (`:orgId/datasets/:datasetId/files/:fileId/details`).
// Two pieces routinely missed when this was first built:
//   - the org slug at the start (a /datasets/... URL with no org 404s)
//   - the /details suffix (the route is FileDetails, not the dataset-files
//     index)
// Read the org from Vuex's activeOrganization rather than a route param —
// the chat panel can be hosted in widgets (e.g. Spotlight) where the
// current route isn't org-scoped, but activeOrganization is set globally.
const packageHref = computed(() => {
  const { packageNodeId, datasetNodeId } = source.value
  if (!packageNodeId || !datasetNodeId) return '#'
  const orgId = store.state?.activeOrganization?.organization?.id
  if (!orgId) return '#'
  return `/${orgId}/datasets/${datasetNodeId}/files/${packageNodeId}/details`
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

// Positioning context for the hover download button, sized to the image
// (inline-block) so the button hugs the figure's top-right, not the bubble.
.figure-wrap {
  position: relative;
  display: inline-block;
  line-height: 0;
}

.image-link {
  display: inline-block;
  line-height: 0; // collapse the anchor's text-baseline gap below the img
}

.download-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: rgba(28, 28, 28, 0.6);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease, background 0.12s ease;

  svg { width: 16px; height: 16px; display: block; }

  &:hover { background: rgba(28, 28, 28, 0.8); }
  &:disabled { cursor: default; opacity: 0.5; }
}

.figure-wrap:hover .download-btn,
.download-btn:focus-visible { opacity: 1; }

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
