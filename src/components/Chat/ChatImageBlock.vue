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
      <!-- The figure renders inline here. We don't link the image to the
           package: the figure is chat-scoped until promoted, so it isn't
           viewable in the package viewer yet. The source-package router-link
           below points at where the data came from. -->
      <img
        :src="resolvedUrl"
        :alt="alt"
        loading="lazy"
        class="figure"
        @error="onImgError"
      />

      <!-- Hover-revealed actions. Sits top-right so it doesn't clutter the
           figure at rest. -->
      <div v-if="!confirmingRemove && !choosingSave" class="actions">
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

        <!-- Save: detach from the chat session so the figure becomes a normal
             asset. When it came from a package, clicking opens a choice
             (package vs dataset); otherwise it promotes straight to a dataset
             asset. Only offered when we resolved by asset id and it hasn't been
             saved yet. -->
        <button
          v-if="assetId && !promoted"
          type="button"
          class="action-btn"
          :title="saveTitle"
          :aria-label="saveTitle"
          :disabled="busy"
          @click="onSaveClick"
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

      <!-- Save-target choice overlay. Shown only for figures derived from a
           package: "Package" links it to the source package (primary), "Dataset"
           leaves it as a plain dataset asset. -->
      <div v-else-if="choosingSave" class="confirm-overlay">
        <span class="confirm-text">Save figure to…</span>
        <div class="confirm-buttons">
          <button
            type="button"
            class="confirm-btn confirm-btn--primary"
            :disabled="busy"
            @click="promote('package')"
          >
            {{ busy ? 'Saving…' : 'Package' }}
          </button>
          <button
            type="button"
            class="confirm-btn"
            :disabled="busy"
            @click="promote('dataset')"
          >
            Dataset
          </button>
          <button
            type="button"
            class="confirm-btn"
            :disabled="busy"
            @click="choosingSave = false"
          >
            Cancel
          </button>
        </div>
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

      <!-- Link to the source package (where the plotted data lives) as an
           in-app router navigation. Not "where the figure is" — the figure
           shows inline above and isn't in the package until promoted. -->
      <p v-if="packageRoute" class="source-note">
        <router-link :to="packageRoute" class="source-link">Open source package →</router-link>
      </p>
    </div>

    <!-- Figure couldn't be resolved/rendered. Fall back to a router-link to
         the source package so the user can still get there. -->
    <router-link
      v-else-if="packageRoute"
      :to="packageRoute"
      class="fallback-link"
    >
      Open source package →
    </router-link>
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
const choosingSave = ref(false)
const removed = ref(false)
const promoted = ref(false)
// Where the figure was saved, once promoted: 'package' | 'dataset'. Drives the
// confirmation note so it matches what the user actually chose.
const promotedTo = ref('')
const actionError = ref('')

const alt = computed(() => props.block.alt || 'Inline figure')
const source = computed(() => props.block.source || {})
const assetId = computed(() => source.value.assetId || '')
const datasetNodeId = computed(() => source.value.datasetNodeId || '')
const fileName = computed(() => source.value.fileName || 'figure.png')

// A chat figure carries its package link through promote (clear_chat_session
// only nulls the chat scope), so it lands as a package-scoped asset whenever
// it came from a package — which plot_file figures always do. Word the promote
// affordance to match where the figure actually ends up. Prefer the resolved
// asset's real package links; fall back to the frame's packageNodeId before
// resolution completes (and for the listing path, where we don't fetch by id).
// Whether the figure was derived from a source package (plot_file figures
// always are). When true we offer "Save to package" as the primary action and
// "Save to dataset" as a secondary option; when false there's nothing to link
// to, so saving just promotes to a dataset asset.
const fromPackage = computed(() => !!source.value.packageNodeId)

const saveTitle = computed(() =>
  fromPackage.value ? 'Save figure' : 'Save to dataset assets'
)
const promotedNote = computed(() =>
  promotedTo.value === 'package' ? 'Saved to package.' : 'Saved to dataset assets.'
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

// Save-button click. When the figure came from a package, open the choice
// overlay (package vs dataset). Otherwise there's nothing to link to — promote
// straight to a dataset asset.
const onSaveClick = () => {
  if (busy.value) return
  if (fromPackage.value) {
    choosingSave.value = true
  } else {
    promote('dataset')
  }
}

// Promote: detach the chat session so the figure stops being chat-scoped.
// target='package' links it to the source package (becomes a package asset);
// target='dataset' leaves it unlinked (becomes a plain dataset asset).
// Metadata-only — the bytes don't move.
const promote = async (target) => {
  if (!assetId.value || !datasetNodeId.value || busy.value) return
  busy.value = true
  actionError.value = ''
  try {
    const packageIds =
      target === 'package' && source.value.packageNodeId
        ? [source.value.packageNodeId]
        : []
    await store.dispatch('viewerModule/promoteViewerAsset', {
      datasetId: datasetNodeId.value,
      assetId: assetId.value,
      packageIds,
    })
    promoted.value = true
    promotedTo.value = target
    choosingSave.value = false
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[chat] ChatImageBlock: promote failed', err)
    actionError.value =
      target === 'package'
        ? 'Could not save to package.'
        : 'Could not save to dataset assets.'
    choosingSave.value = false
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

// vue-router target for the source package (the `file-record` route, same one
// ChatMessage's attachment chips use). Returns null when we can't build it —
// the template degrades by hiding the link rather than rendering a dead one.
// Read the org from Vuex's activeOrganization rather than a route param: the
// chat panel can be hosted in widgets (e.g. Spotlight) where the current route
// isn't org-scoped, but activeOrganization is set globally.
const packageRoute = computed(() => {
  const { packageNodeId, datasetNodeId: ds } = source.value
  if (!packageNodeId || !ds) return null
  const orgId = store.state?.activeOrganization?.organization?.id
  if (!orgId) return null
  return {
    name: 'file-record',
    params: { orgId, datasetId: ds, fileId: packageNodeId },
  }
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

  // The presence of chat_session_id tells us whether it's still a chat figure
  // (offer save) or already promoted (don't — re-promoting would 404 once the
  // chat link is gone).
  if (!asset.chat_session_id) promoted.value = true

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
@use '../../styles/theme';

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
  background: theme.$gray_2;
  border-radius: 8px;

  .loading-text {
    color: theme.$gray_5;
    font-size: 13px;
  }
}

.figure-removed {
  display: inline-flex;
  align-items: center;
  padding: 10px 14px;
  border: 1px dashed theme.$gray_3;
  border-radius: 8px;
  color: theme.$gray_5;
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
  background: rgba(theme.$black, 0.6);
  color: theme.$white;
  cursor: pointer;
  transition: background 0.12s ease;

  svg { width: 16px; height: 16px; display: block; }

  &:hover { background: rgba(theme.$black, 0.8); }
  &:disabled { cursor: default; opacity: 0.5; }

  &--danger:hover { background: rgba(theme.$red_1, 0.9); }
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
  background: rgba(theme.$black, 0.85);
  line-height: normal;
}

.confirm-text {
  color: theme.$white;
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
  background: theme.$gray_2;
  color: theme.$gray_6;
  font-size: 12px;
  cursor: pointer;

  &:hover { background: theme.$white; }
  &:disabled { cursor: default; opacity: 0.6; }

  &--primary {
    background: theme.$purple_2;
    color: theme.$white;

    &:hover { background: theme.$purple_3; }
  }

  &--danger {
    background: theme.$red_1;
    color: theme.$white;

    &:hover { background: theme.$red_2; }
  }
}

.figure {
  display: block;
  max-width: 480px;
  width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid theme.$gray_2;
}

.status-note {
  margin: 4px 0 0;
  font-size: 12px;
  color: theme.$gray_5;
  line-height: normal;

  &--error { color: theme.$red_2; }
}

// Source-package link beneath the figure. line-height reset because the
// .figure-wrap container collapses it to 0 to hug the image.
.source-note {
  margin: 4px 0 0;
  line-height: normal;
}

.source-link {
  color: theme.$purple_3;
  font-size: 12px;
  text-decoration: none;

  &:hover { text-decoration: underline; }
}

.fallback-link {
  display: inline-block;
  color: theme.$purple_3;
  font-size: 13px;
  text-decoration: underline;
}
</style>
