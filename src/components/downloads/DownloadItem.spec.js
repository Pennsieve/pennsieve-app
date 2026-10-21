import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

vi.mock("@/utils/downloadService", () => ({
  createArchive: vi.fn(),
  getArchive: vi.fn(),
  listArchives: vi.fn(),
  getArchiveUrl: vi.fn(),
  deleteArchive: vi.fn(),
}));

import DownloadItem from "./DownloadItem.vue";

function statusOf(download) {
  const wrapper = mount(DownloadItem, {
    props: { download },
    global: { stubs: ["el-button", "el-progress"] },
  });
  return wrapper.find(".status").text();
}

describe("DownloadItem", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const ready = { id: "d1", status: "READY", archiveName: "study", fileCount: 3, totalBytes: 2000 };

  it("says how many files were left out because they are still being scanned", () => {
    expect(statusOf({ ...ready, pendingCount: 2 })).toBe(
      "Ready · 2.0 KB · 2 files were left out because they are still being scanned"
    );
    expect(statusOf({ ...ready, status: "QUEUED", pendingCount: 1 })).toBe(
      "Waiting to start · 3 files, 2.0 KB · 1 file was left out because it is still being scanned"
    );
  });

  it("says nothing about scans when no file was left out", () => {
    expect(statusOf(ready)).toBe("Ready · 2.0 KB");
  });
});
