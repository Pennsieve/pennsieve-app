import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createStore } from "vuex";

vi.mock("@/utils/downloadService", () => ({
  createArchive: vi.fn(),
  getArchive: vi.fn(),
  listArchives: vi.fn(),
  getArchiveUrl: vi.fn(),
  deleteArchive: vi.fn(),
}));

import DownloadsPanel from "./DownloadsPanel.vue";
import { listArchives } from "@/utils/downloadService";

const org = (id) => ({ organization: { id } });

function mountPanel(activeOrganization) {
  const vuex = createStore({ state: { activeOrganization } });
  const pinia = createPinia();
  setActivePinia(pinia);
  return {
    vuex,
    wrapper: mount(DownloadsPanel, {
      global: { plugins: [vuex, pinia], stubs: ["router-link", "download-item"] },
    }),
  };
}

describe("DownloadsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("loads the workspace's downloads on start, so a reload brings a build in progress back", async () => {
    listArchives.mockResolvedValue([
      { id: "d1", status: "RUNNING", fileCount: 3, filesDone: 1 },
    ]);
    const { wrapper } = mountPanel(org("N:organization:1"));
    await flushPromises();
    expect(listArchives).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".downloads-panel").exists()).toBe(true);
  });

  it("waits for a workspace, and reloads when it changes", async () => {
    listArchives.mockResolvedValue([]);
    const { vuex } = mountPanel(null);
    await flushPromises();
    expect(listArchives).not.toHaveBeenCalled();

    vuex.state.activeOrganization = org("N:organization:2");
    await flushPromises();
    expect(listArchives).toHaveBeenCalledTimes(1);
  });
});
