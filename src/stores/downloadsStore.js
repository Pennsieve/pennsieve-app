import { ref, computed } from "vue";
import { defineStore } from "pinia";
import {
  createArchive,
  getArchive,
  listArchives,
  getArchiveUrl,
  deleteArchive,
  createPublicArchive,
  getPublicArchive,
  getPublicArchiveUrl,
  deletePublicArchive,
} from "@/utils/downloadService";
import { triggerBrowserDownload } from "@/utils/triggerBrowserDownload";

export const ACTIVE_STATUSES = ["QUEUED", "RUNNING"];

// How often active archives are polled while the tab is visible. A hidden
// tab stops polling; that's how the service knows nobody is watching and
// emails when the archive is ready.
export const POLL_MS = 2000;

export const isActive = (d) => ACTIVE_STATUSES.includes(d.status);

// A zip of a published dataset: reached through the /public routes, and in
// no workspace's list.
const isPublic = (d) => d.scope === "public";

const fetchArchive = (d) =>
  isPublic(d) ? getPublicArchive({ id: d.id }) : getArchive({ id: d.id, datasetId: d.datasetNodeId });
const fetchArchiveUrl = (d) =>
  isPublic(d) ? getPublicArchiveUrl({ id: d.id }) : getArchiveUrl({ id: d.id, datasetId: d.datasetNodeId });
const removeArchive = (d) =>
  isPublic(d) ? deletePublicArchive({ id: d.id }) : deleteArchive({ id: d.id, datasetId: d.datasetNodeId });

// Ready archives this browser has downloaded, so the navigation badge only
// counts new ones. A convenience: without storage the badge counts every
// ready archive.
const FETCHED_KEY = "pennsieve.downloads.fetched";

function readFetched() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FETCHED_KEY) || "[]"));
  } catch (e) {
    return new Set();
  }
}

// Enough for every workspace's archives within their 3-day lifetime.
const FETCHED_MAX = 200;

function writeFetched(ids) {
  try {
    localStorage.setItem(FETCHED_KEY, JSON.stringify([...ids].slice(-FETCHED_MAX)));
  } catch (e) {
    // private mode or blocked storage
  }
}

export function humanSize(bytes) {
  const n = Number(bytes) || 0;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return i === 0 ? `${n} B` : `${v.toFixed(1)} ${units[i]}`;
}

export const useDownloadsStore = defineStore("downloads", () => {
  // Newest first.
  const downloads = ref([]);
  const panelOpen = ref(false);
  const loaded = ref(false);
  const fetched = ref(readFetched());
  // Archives this tab requested: they start downloading once ready.
  const autoStart = new Set();
  // ...and stay in the panel afterwards, downloaded or not.
  const requested = ref(new Set());
  let timer = null;

  const active = computed(() => downloads.value.filter(isActive));

  // Needs attention: being prepared, or ready and not downloaded here yet.
  const needsAttention = (d) =>
    isActive(d) || (d.status === "READY" && !fetched.value.has(d.id));

  // The panel: what this tab asked for, and everything that needs attention,
  // so a reload doesn't lose a ready archive. Older, downloaded archives are
  // on the Downloads page.
  const panelDownloads = computed(() =>
    downloads.value.filter((d) => requested.value.has(d.id) || needsAttention(d))
  );

  // The badge.
  const attentionCount = computed(() => downloads.value.filter(needsAttention).length);

  function markFetched(id) {
    fetched.value = new Set([...fetched.value, id]);
    writeFetched(fetched.value);
  }

  function upsert(d) {
    const i = downloads.value.findIndex((x) => x.id === d.id);
    if (i >= 0) {
      downloads.value[i] = { ...downloads.value[i], ...d };
    } else {
      downloads.value.unshift(d);
    }
  }

  function drop(id) {
    downloads.value = downloads.value.filter((x) => x.id !== id);
    autoStart.delete(id);
  }

  function schedule() {
    if (timer || !active.value.length || document.hidden) return;
    timer = setTimeout(poll, POLL_MS);
  }

  async function poll() {
    timer = null;
    if (document.hidden) return;
    await Promise.all(
      active.value.map(async (d) => {
        try {
          const updated = await fetchArchive(d);
          upsert(updated);
          if (updated.status === "READY" && autoStart.has(d.id)) {
            autoStart.delete(d.id);
            await download(updated);
          }
        } catch (e) {
          if (e.status === 404) drop(d.id);
        }
      })
    );
    schedule();
  }

  function onVisibilityChange() {
    schedule();
  }

  // Loads a workspace's archives. The service lists the token's workspace;
  // right after a switch its cached authorization can still answer for the
  // previous one, so the list is filtered too. The panel stays as it is:
  // after a reload the navigation's Downloads item and its badge show what
  // needs attention, and opening the panel is the user's call.
  async function load(organizationNodeId) {
    const list = await listArchives({ organizationId: organizationNodeId });
    // Records without organizationNodeId (older service versions) are kept:
    // only one that names another workspace is dropped.
    const workspace = organizationNodeId
      ? list.filter((d) => !d.organizationNodeId || d.organizationNodeId === organizationNodeId)
      : list;
    // Public archives aren't listed: keep the ones this tab asked for.
    downloads.value = [...downloads.value.filter(isPublic), ...workspace];
    loaded.value = true;
    schedule();
  }

  // Queues an archive of a selection. Rejects with a DownloadServiceError
  // (413 too large, 403 no access, 400 nothing to download).
  async function start(selection) {
    return track(await createArchive(selection));
  }

  // Queues a zip of a published dataset's paths (createPublicArchive).
  async function startPublic(selection) {
    return track(await createPublicArchive(selection));
  }

  function track(d) {
    upsert(d);
    autoStart.add(d.id);
    requested.value = new Set([...requested.value, d.id]);
    panelOpen.value = true;
    schedule();
    return d;
  }

  async function download(d) {
    const { url } = await fetchArchiveUrl(d);
    triggerBrowserDownload(url);
    markFetched(d.id);
  }

  // Cancels an active archive, or deletes a finished one.
  async function remove(d) {
    const result = await removeArchive(d);
    autoStart.delete(d.id);
    if (result && result.id) {
      upsert(result);
    } else {
      drop(d.id);
    }
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  return {
    downloads,
    panelOpen,
    loaded,
    active,
    panelDownloads,
    attentionCount,
    load,
    start,
    startPublic,
    download,
    remove,
    poll,
  };
});
