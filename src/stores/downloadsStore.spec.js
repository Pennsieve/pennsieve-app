import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@/utils/downloadService", () => ({
  createArchive: vi.fn(),
  getArchive: vi.fn(),
  listArchives: vi.fn(),
  getArchiveUrl: vi.fn(),
  deleteArchive: vi.fn(),
}));
vi.mock("@/utils/triggerBrowserDownload", () => ({ triggerBrowserDownload: vi.fn() }));

import { useDownloadsStore, humanSize, POLL_MS } from "./downloadsStore";
import {
  createArchive,
  getArchive,
  listArchives,
  getArchiveUrl,
  deleteArchive,
} from "@/utils/downloadService";
import { triggerBrowserDownload } from "@/utils/triggerBrowserDownload";

const queued = { id: "d1", status: "QUEUED", datasetNodeId: "N:dataset:1", fileCount: 2, filesDone: 0 };

function setHidden(hidden) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
}

describe("downloads store", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.clearAllMocks();
    setHidden(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queues an archive, opens the panel and polls until it is ready, then downloads it", async () => {
    const store = useDownloadsStore();
    createArchive.mockResolvedValue(queued);
    getArchive
      .mockResolvedValueOnce({ ...queued, status: "RUNNING", filesDone: 1 })
      .mockResolvedValueOnce({ ...queued, status: "READY", filesDone: 2 });
    getArchiveUrl.mockResolvedValue({ url: "https://s3/zip" });

    await store.start({ datasetId: "N:dataset:1", nodeIds: ["N:collection:1"] });
    expect(store.panelOpen).toBe(true);
    expect(store.downloads[0].status).toBe("QUEUED");

    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(store.downloads[0]).toMatchObject({ status: "RUNNING", filesDone: 1 });

    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(store.downloads[0].status).toBe("READY");
    expect(getArchiveUrl).toHaveBeenCalledWith({ id: "d1", datasetId: "N:dataset:1" });
    expect(triggerBrowserDownload).toHaveBeenCalledWith("https://s3/zip");

    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    expect(getArchive).toHaveBeenCalledTimes(2);
  });

  it("stops polling while the tab is hidden, so the service knows to email", async () => {
    const store = useDownloadsStore();
    createArchive.mockResolvedValue(queued);
    getArchive.mockResolvedValue({ ...queued, status: "RUNNING" });
    await store.start({ datasetId: "N:dataset:1", nodeIds: ["N:collection:1"] });

    setHidden(true);
    await vi.advanceTimersByTimeAsync(POLL_MS * 5);
    expect(getArchive).not.toHaveBeenCalled();

    setHidden(false);
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(getArchive).toHaveBeenCalledTimes(1);
  });

  it("doesn't start downloads it didn't request in this tab", async () => {
    const store = useDownloadsStore();
    listArchives.mockResolvedValue([{ ...queued, id: "old" }]);
    getArchive.mockResolvedValue({ ...queued, id: "old", status: "READY" });
    await store.load();
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(store.downloads[0].status).toBe("READY");
    expect(triggerBrowserDownload).not.toHaveBeenCalled();
  });

  it("keeps only the workspace's archives, even if the service answers for another", async () => {
    const store = useDownloadsStore();
    listArchives.mockResolvedValue([
      { ...queued, id: "mine", status: "READY", organizationNodeId: "N:organization:1" },
      { ...queued, id: "other", status: "READY", organizationNodeId: "N:organization:2" },
    ]);
    await store.load("N:organization:1");
    expect(store.downloads.map((d) => d.id)).toEqual(["mine"]);
  });

  it("keeps records that don't name a workspace", async () => {
    const store = useDownloadsStore();
    listArchives.mockResolvedValue([{ ...queued, id: "unnamed", status: "READY" }]);
    await store.load("N:organization:1");
    expect(store.downloads.map((d) => d.id)).toEqual(["unnamed"]);
    expect(store.panelDownloads.map((d) => d.id)).toEqual(["unnamed"]);
  });

  it("counts archives being prepared and ready ones not downloaded yet", async () => {
    const store = useDownloadsStore();
    listArchives.mockResolvedValue([
      { ...queued, id: "a", status: "RUNNING" },
      { ...queued, id: "b", status: "READY" },
      { ...queued, id: "c", status: "FAILED" },
    ]);
    getArchiveUrl.mockResolvedValue({ url: "https://s3/zip" });
    await store.load();
    expect(store.attentionCount).toBe(2);
    expect(store.panelOpen).toBe(true);

    await store.download(store.downloads.find((d) => d.id === "b"));
    expect(store.attentionCount).toBe(1);
    expect(JSON.parse(localStorage.getItem("pennsieve.downloads.fetched"))).toContain("b");
  });

  it("shows in the panel what this tab asked for and what needs attention, not archives already downloaded", async () => {
    localStorage.setItem("pennsieve.downloads.fetched", JSON.stringify(["gone"]));
    const store = useDownloadsStore();
    listArchives.mockResolvedValue([
      { ...queued, id: "gone", status: "READY" },
      { ...queued, id: "old", status: "READY" },
      { ...queued, id: "building", status: "RUNNING" },
      { ...queued, id: "failed", status: "FAILED" },
    ]);
    await store.load();
    createArchive.mockResolvedValue({ ...queued, id: "new" });
    await store.start({ datasetId: "N:dataset:1", nodeIds: ["N:collection:1"] });
    expect(store.panelDownloads.map((d) => d.id)).toEqual(["new", "old", "building"]);
  });

  it("after a reload, brings back ready archives that weren't downloaded", async () => {
    localStorage.setItem("pennsieve.downloads.fetched", JSON.stringify(["done"]));
    const store = useDownloadsStore();
    listArchives.mockResolvedValue([
      { ...queued, id: "ready", status: "READY" },
      { ...queued, id: "done", status: "READY" },
    ]);
    await store.load();
    expect(store.panelOpen).toBe(true);
    expect(store.panelDownloads.map((d) => d.id)).toEqual(["ready"]);
  });

  it("drops an archive the service no longer has", async () => {
    const store = useDownloadsStore();
    listArchives.mockResolvedValue([queued]);
    getArchive.mockRejectedValue(Object.assign(new Error("download not found"), { status: 404 }));
    await store.load();
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(store.downloads).toEqual([]);
  });

  it("cancels an active archive and deletes a finished one", async () => {
    const store = useDownloadsStore();
    listArchives.mockResolvedValue([queued, { ...queued, id: "d2", status: "READY" }]);
    await store.load();

    deleteArchive.mockResolvedValueOnce({ ...queued, status: "CANCELLED" });
    await store.remove(store.downloads[0]);
    expect(store.downloads.find((d) => d.id === "d1").status).toBe("CANCELLED");

    deleteArchive.mockResolvedValueOnce({});
    await store.remove(store.downloads.find((d) => d.id === "d2"));
    expect(store.downloads.map((d) => d.id)).toEqual(["d1"]);
  });
});

describe("humanSize", () => {
  it("uses decimal units", () => {
    expect(humanSize(999)).toBe("999 B");
    expect(humanSize(4024644)).toBe("4.0 MB");
    expect(humanSize(21474836480)).toBe("21.5 GB");
  });
});
