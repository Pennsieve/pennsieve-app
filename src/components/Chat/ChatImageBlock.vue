<template>
  <div class="chat-image-block">
    <div v-if="loading" class="image-skeleton" :aria-label="alt">
      <span class="loading-text">Loading figure…</span>
    </div>

    <!-- Terminal state after the user removes the figure. The viewer-asset
         (and its S3 bytes) are gone; we don't try to re-resolve. -->
    <div v-else-if="removed" class="figure-removed">
      <span>Figure removed.</span>
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

      <!-- Hover-revealed actions. Sits top-right so it doesn't clutter the
           figure at rest. -->
      <div v-if="!confirmingRemove" class="actions">
        <button
          type="button"
          class="action-btn"
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

        <!-- Promote: detach from the chat session so the figure becomes a
             normal asset. It lands wherever its package link points: a
             package-scoped asset when the figure came from a package
             (plot_file always does), else a plain dataset asset. Only offered
             when we resolved by asset id and it hasn't been promoted yet. -->
        <button
          v-if="assetId && !promoted"
          type="button"
          class="action-btn"
          :title="promoteTitle"
          :aria-label="promoteTitle"
          :disabled="busy"
          @click="promote"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 2.5h6.8L13 5.2V13a.5.5 0 01-.5.5h-9A.5.5 0 013 13V3a.5.5 0 01.5-.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
            <path d="M5.5 2.5v3h4v-3M5.5 13.5v-4h5v4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
          </svg>
        </button>

        <!-- Remove: delete just this viewer-asset by id. Never touches the
             underlying package or dataset. Two-step (click → confirm). -->
        <button
          v-if="assetId"
          type="button"
          class="action-btn action-btn--danger"
          title="Remove figure"
          aria-label="Remove figure"
          :disabled="busy"
          @click="confirmingRemove = true"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 4.5h10M6.2 4.5V3.2a.7.7 0 01.7-.7h2.2a.7.7 0 01.7.7v1.3M4.3 4.5l.6 8a.8.8 0 00.8.7h4.6a.8.8 0 00.8-.7l.6-8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <!-- Inline confirm overlay for the destructive remove. -->
      <div v-else class="confirm-overlay">
        <span class="confirm-text">Remove this figure?</span>
        <div class="confirm-buttons">
          <button
            type="button"
            class="confirm-btn confirm-btn--danger"
            :disabled="busy"
            @click="removeFigure"
          >
            {{ busy ? 'Removing…' : 'Remove' }}
          </button>
          <button
            type="button"
            class="confirm-btn"
            :disabled="busy"
            @click="confirmingRemove = false"
          >
            Cancel
          </button>
        </div>
      </div>

      <p v-if="promoted" class="status-note">{{ promotedNote }}</p>
      <p v-if="actionError" class="status-note status-note--error">{{ actionError }}</p>
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
// workflow (currently just plot_file). The frame carries no URL — only
// viewer-asset coordinates on `source`.
//
// Resolution, in priority order:
//
//   1. By asset id (preferred). When the producing workflow reported the
//      viewer-asset UUID back as a run output, the frame carries
//      `source.assetId`. We resolve it directly via packages-service
//      `GET /packages/assets/{id}?dataset_id=…`, which returns the asset +
//      a signed CloudFront policy. This is the ONLY reliable path for
//      chat-scoped figures: those are excluded from the package/dataset
//      asset listing, so the list-and-match path (below) can't see them.
//
//   2. By coordinates (fallback). For older frames without `assetId`, list
//      the package's assets via `fetchPackageViewerAssets` and match on
//      {name, asset_type}, newest first. Works for plain (non-chat-scoped)
//      figures only.
//
// Either way we build a query-string-signed URL:
//   `${asset.asset_url}${fileName}?Policy=…&Signature=…&Key-Pair-Id=…`
// (fileName defaults to the figure-asset convention `figure.png`).
//
// Actions (when resolved by id): download, promote (detach from the chat
// session → becomes a plain dataset asset), and remove (delete just this
// viewer-asset by id — never the package or dataset).
//
// On any error — API failure, no matching asset, image-load failure — the
// component falls back to a plain text-link pointing at the package viewer.

import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'

const props = defineProps({
  // The image block from AssistantMessage.blocks[]. Required on `source`:
  // datasetNodeId, plus EITHER assetId OR packageNodeId. Optional: assetName,
  // assetType, fileName.
  block: { type: Object, required: true },
})

const store = useStore()

const loading = ref(true)
const resolvedUrl = ref('')
const downloading = ref(false)

// Action state.
const busy = ref(false)
const confirmingRemove = ref(false)
const removed = ref(false)
const promoted = ref(false)
const actionError = ref('')

const alt = computed(() => props.block.alt || 'Inline figure')
const source = computed(() => props.block.source || {})
const assetId = computed(() => source.value.assetId || '')
const datasetNodeId = computed(() => source.value.datasetNodeId || '')
const fileName = computed(() => source.value.fileName || 'figure.png')

// A chat figure carries its package link through promote (clear_chat_session
// only nulls the chat scope), so it lands as a package-scoped asset whenever
// it came from a package — which plot_file figures always do. Word the promote
// affordance to match where the figure actually ends up.
const hasPackage = computed(() => !!source.value.packageNodeId)
const promoteTitle = computed(() =>
  hasPackage.value ? 'Save to package' : 'Save to dataset assets'
)
const promotedNote = computed(() =>
  hasPackage.value ? 'Saved to package.' : 'Saved to dataset assets.'
)

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

// Promote: detach the chat session so the figure shows in the dataset's
// asset listing. Metadata-only — the bytes don't move.
const promote = async () => {
  if (!assetId.value || !datasetNodeId.value || busy.value) return
  busy.value = true
  actionError.value = ''
  try {
    await store.dispatch('viewerModule/promoteViewerAsset', {
      datasetId: datasetNodeId.value,
      assetId: assetId.value,
    })
    promoted.value = true
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[chat] ChatImageBlock: promote failed', err)
    actionError.value = 'Could not save to dataset assets.'
  } finally {
    busy.value = false
  }
}

// Remove: delete just this viewer-asset by id. The package and dataset are
// untouched. After success we show the removed state instead of re-resolving.
const removeFigure = async () => {
  if (!assetId.value || !datasetNodeId.value || busy.value) return
  busy.value = true
  actionError.value = ''
  try {
    await store.dispatch('viewerModule/deleteViewerAsset', {
      datasetId: datasetNodeId.value,
      assetId: assetId.value,
    })
    removed.value = true
    confirmingRemove.value = false
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[chat] ChatImageBlock: remove failed', err)
    actionError.value = 'Could not remove the figure.'
    confirmingRemove.value = false
  } finally {
    busy.value = false
  }
}

// Open-in-viewer fallback link. Matches the `file-record` route registered
// in router/index.js (`:orgId/datasets/:datasetId/files/:fileId/details`).
// Read the org from Vuex's activeOrganization rather than a route param —
// the chat panel can be hosted in widgets (e.g. Spotlight) where the current
// route isn't org-scoped, but activeOrganization is set globally.
const packageHref = computed(() => {
  const { packageNodeId, datasetNodeId: ds } = source.value
  if (!packageNodeId || !ds) return '#'
  const orgId = store.state?.activeOrganization?.organization?.id
  if (!orgId) return '#'
  return `/${orgId}/datasets/${ds}/files/${packageNodeId}/details`
})

const onImgError = () => {
  // CloudFront returned an error for the signed URL — fall back to the
  // plain link by clearing resolvedUrl. Most likely cause: figure file
  // not at the expected filename (data-target convention drift).
  resolvedUrl.value = ''
}

// Build a query-string-signed image URL from an { asset, cloudfront }
// response. Returns true on success.
const buildSignedUrl = (result) => {
  const asset = result?.asset
  if (!asset?.asset_url) return false
  const cf = result.cloudfront
  if (!cf?.policy || !cf?.signature || !cf?.key_pair_id) return false
  const qs = new URLSearchParams({
    Policy: cf.policy,
    Signature: cf.signature,
    'Key-Pair-Id': cf.key_pair_id,
  })
  resolvedUrl.value = `${asset.asset_url}${fileName.value}?${qs.toString()}`
  return true
}

// Preferred path: resolve directly by asset id. Works for chat-scoped
// figures, which the listing endpoint deliberately excludes.
const resolveByAssetId = async () => {
  const result = await store.dispatch('viewerModule/fetchViewerAssetById', {
    datasetId: datasetNodeId.value,
    assetId: assetId.value,
  })
  return buildSignedUrl(result)
}

// Fallback path: list the package's assets and match on {name, asset_type},
// newest first. Only finds plain (non-chat-scoped) figures.
const resolveByListing = async () => {
  const { packageNodeId, assetName, assetType } = source.value
  if (!packageNodeId) return false

  const result = await store.dispatch('viewerModule/fetchPackageViewerAssets', {
    datasetId: datasetNodeId.value,
    packageId: packageNodeId,
  })
  if (!result?.assets?.length) return false

  const typeFilter = assetType || 'PNG'
  const candidates = result.assets
    .filter((a) => a.status === 'ready')
    .filter((a) => a.asset_type === typeFilter)
    .filter((a) => !assetName || a.name === assetName)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  const asset = candidates[0]
  if (!asset) return false
  return buildSignedUrl({ asset, cloudfront: result.cloudfront })
}

onMounted(async () => {
  // datasetNodeId is required for both paths.
  if (!datasetNodeId.value) {
    loading.value = false
    return
  }
  // Need at least one resolution key.
  if (!assetId.value && !source.value.packageNodeId) {
    loading.value = false
    return
  }

  try {
    if (assetId.value) {
      if (await resolveByAssetId()) return
    }
    // Fall back to the coordinate listing path (older frames / no assetId,
    // or an asset-id lookup that returned nothing).
    await resolveByListing()
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

.figure-removed {
  display: inline-flex;
  align-items: center;
  padding: 10px 14px;
  border: 1px dashed #d0d3d8;
  border-radius: 8px;
  color: #6b6b6b;
  font-size: 13px;
  font-style: italic;
}

// Positioning context for the hover actions, sized to the image
// (inline-block) so the buttons hug the figure's top-right, not the bubble.
.figure-wrap {
  position: relative;
  display: inline-block;
  line-height: 0;
}

.image-link {
  display: inline-block;
  line-height: 0; // collapse the anchor's text-baseline gap below the img
}

.actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.action-btn {
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
  transition: background 0.12s ease;

  svg { width: 16px; height: 16px; display: block; }

  &:hover { background: rgba(28, 28, 28, 0.8); }
  &:disabled { cursor: default; opacity: 0.5; }

  &--danger:hover { background: rgba(197, 48, 48, 0.9); }
}

.figure-wrap:hover .actions,
.actions:focus-within { opacity: 1; }

.confirm-overlay {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(28, 28, 28, 0.85);
  line-height: normal;
}

.confirm-text {
  color: #fff;
  font-size: 12px;
}

.confirm-buttons {
  display: inline-flex;
  gap: 6px;
}

.confirm-btn {
  padding: 3px 10px;
  border: none;
  border-radius: 5px;
  background: #e8eaed;
  color: #1c1c1c;
  font-size: 12px;
  cursor: pointer;

  &:hover { background: #fff; }
  &:disabled { cursor: default; opacity: 0.6; }

  &--danger {
    background: #c53030;
    color: #fff;

    &:hover { background: #b02525; }
  }
}

.figure {
  display: block;
  max-width: 480px;
  width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid #e0e2e6;
}

.status-note {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b6b6b;
  line-height: normal;

  &--error { color: #c53030; }
}

.fallback-link {
  display: inline-block;
  color: #5039f5;
  font-size: 13px;
  text-decoration: underline;
}
</style>
