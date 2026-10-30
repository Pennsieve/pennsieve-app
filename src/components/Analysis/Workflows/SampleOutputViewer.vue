<script setup>
/*
  Shows a workflow's sample output PDF over the app (a dimmed backdrop, the
  page stays where it is), with Download, Open in a new tab and Close. The
  pages are drawn with pdf.js on the platform's light background; where that
  fails, the browser's own PDF viewer shows it in a frame.
  source: the signed PDF link, or a function resolving a fresh one (null
  where there's none). The link is resolved each time the viewer opens, and
  again before a download or new tab when it's older than PDF_URL_FRESH_MS
  (signed links expire after 15 minutes).
*/
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { renderPdfPages } from "./pdfPages";
import { downloadPdf, openPdf, PDF_URL_FRESH_MS, samplePdfFilename } from "./runExamples";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  source: { type: [String, Function], default: null },
  workflowName: { type: String, default: "" },
  version: { type: Number, default: null },
  // A line under the title, e.g. "Version 3 · run brave-otter · 18 pages".
  subtitle: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);

const src = ref("");
const resolvedAt = ref(0);
const loading = ref(false);
const error = ref("");
const downloading = ref(false);
const pagesEl = ref(null);
const pagesShown = ref(false);
const useFrame = ref(false);
let seq = 0;
let rendered = null; // { destroy } of the PDF shown
const release = () => {
  rendered?.destroy();
  rendered = null;
};

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const title = computed(() =>
  props.workflowName ? `${props.workflowName}: sample output` : "Workflow sample output"
);
const filename = computed(() => samplePdfFilename(props.workflowName, props.version));

const resolve = async () => {
  const s = props.source;
  const href = typeof s === "function" ? await s() : s;
  if (!href) throw new Error("no PDF");
  src.value = href;
  resolvedAt.value = Date.now();
  return href;
};

const drawPages = async (href, mine) => {
  await nextTick();
  const host = pagesEl.value;
  if (!host || mine !== seq) return;
  host.replaceChildren();
  release();
  try {
    const result = await renderPdfPages(href, host, {
      width: Math.max(320, Math.min(host.clientWidth - 48, 960)),
      isCurrent: () => mine === seq,
      onFirstPage: () => {
        if (mine === seq) pagesShown.value = true;
      },
    });
    if (mine === seq) rendered = result;
    else result?.destroy?.();
  } catch {
    if (mine === seq) useFrame.value = true;
  }
};

const load = async () => {
  const mine = ++seq;
  src.value = "";
  error.value = "";
  pagesShown.value = false;
  useFrame.value = false;
  loading.value = true;
  try {
    const href = await resolve();
    if (mine === seq) await drawPages(href, mine);
  } catch {
    if (mine === seq) error.value = "The sample output PDF could not be loaded.";
  } finally {
    if (mine === seq) loading.value = false;
  }
};
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) load();
    else {
      seq++;
      src.value = "";
      release();
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  seq++;
  release();
});

// A link still good for a while, re-resolved where it's getting old.
const freshSrc = async () => {
  if (src.value && Date.now() - resolvedAt.value < PDF_URL_FRESH_MS) return src.value;
  if (typeof props.source !== "function") return src.value || props.source;
  return resolve();
};

const download = async () => {
  downloading.value = true;
  try {
    await downloadPdf(await freshSrc(), filename.value);
  } catch {
    error.value = "The sample output PDF could not be downloaded.";
  } finally {
    downloading.value = false;
  }
};

const openInTab = async () => {
  try {
    await openPdf(freshSrc);
  } catch {
    error.value = "The sample output PDF could not be opened.";
  }
};
</script>

<template>
  <el-dialog
    v-model="open"
    class="sample-viewer"
    modal-class="sample-viewer__backdrop"
    width="min(1100px, 94vw)"
    top="3vh"
    :show-close="false"
    append-to-body
    destroy-on-close
  >
    <template #header="{ close }">
      <div class="sample-viewer__header">
        <div class="sample-viewer__titles">
          <h2 class="sample-viewer__title">{{ title }}</h2>
          <p v-if="subtitle" class="sample-viewer__subtitle">{{ subtitle }}</p>
        </div>
        <div class="sample-viewer__actions">
          <bf-button class="primary sample-viewer__btn" :disabled="!src || downloading" @click="download">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="currentColor" d="M11 4h2v8.6l3.3-3.3 1.4 1.4L12 16.4l-5.7-5.7 1.4-1.4 3.3 3.3V4zM5 18h14v2H5z" />
            </svg>
            {{ downloading ? "Downloading…" : "Download PDF" }}
          </bf-button>
          <el-tooltip content="Open in a new tab" placement="bottom">
            <button type="button" class="sample-viewer__icon" aria-label="Open the PDF in a new tab" :disabled="!src" @click="openInTab">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="currentColor" d="M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14V3zM5 5h6v2H7v10h10v-4h2v6H5V5z" />
              </svg>
            </button>
          </el-tooltip>
          <el-tooltip content="Close" placement="bottom">
            <button type="button" class="sample-viewer__icon" aria-label="Close the PDF" @click="close">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="currentColor" d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" />
              </svg>
            </button>
          </el-tooltip>
        </div>
      </div>
    </template>

    <div class="sample-viewer__body">
      <iframe v-if="src && useFrame" class="sample-viewer__frame" :src="src" :title="title" />
      <div v-else class="sample-viewer__scroll">
        <p v-if="!pagesShown && !error" class="sample-viewer__state">Loading the PDF…</p>
        <div ref="pagesEl" class="sample-viewer__pages" role="document" :aria-label="title" />
      </div>
      <p v-if="error" class="sample-viewer__state sample-viewer__state--error" role="alert">{{ error }}</p>
    </div>
  </el-dialog>
</template>

<style lang="scss">
@use "../../../styles/theme";

// Not scoped: el-dialog renders in <body>.
// The platform's usual dialog backdrop.
.sample-viewer__backdrop {
  background-color: rgba(0, 0, 0, 0.5);
}
.el-dialog.sample-viewer {
  display: flex;
  flex-direction: column;
  height: 94vh;
  margin-bottom: 0;
  padding: 0;
  border-radius: 6px;
  overflow: hidden;

  .el-dialog__header {
    padding: 0;
    margin: 0;
  }
  .el-dialog__body {
    flex: 1;
    min-height: 0;
    padding: 0;
  }
}
.sample-viewer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid theme.$gray_2;
}
.sample-viewer__titles {
  min-width: 0;
}
.sample-viewer__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: theme.$gray_6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sample-viewer__subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: theme.$gray_5;
}
.sample-viewer__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.sample-viewer__btn svg {
  margin-right: 6px;
  vertical-align: -3px;
}
.sample-viewer__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}
.sample-viewer__body {
  position: relative;
  height: 100%;
  background: theme.$gray_1;
}
.sample-viewer__scroll {
  height: 100%;
  overflow-y: auto;
}
.sample-viewer__pages {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px;
}
.sample-viewer__page {
  display: block;
  flex-shrink: 0;
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
.sample-viewer__frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
.sample-viewer__state {
  margin: 0;
  padding: 48px 16px;
  text-align: center;
  color: theme.$gray_5;

  &--error {
    color: theme.$red_1;
  }
}
</style>
