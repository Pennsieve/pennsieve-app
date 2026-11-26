import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, reactive } from "vue";
import ElementPlus from "element-plus";

const datasets = [
  { content: { id: "N:dataset:a", name: "Alpha" } },
  { content: { id: "N:dataset:b", name: "Beta" } },
];
vi.mock("@/mixins/request/request_composable", () => ({
  useSendXhr: vi.fn(async (url) => (url.includes("/paginated") ? { datasets } : { children: [] })),
}));
vi.mock("@/composables/useGetToken", () => ({ useGetToken: async () => "token" }));
vi.mock("@/utils/workspaceModels", () => ({ listWorkspaceModels: async () => [] }));
vi.mock("@pennsieve/notebooks/utils/viewsService", () => ({ workspaceFilesAsViews: () => true }));
vi.mock("@pennsieve/notebooks/components/Analysis/MetadataRecordsChoice.vue", () => ({ default: { render: () => null } }));
vi.mock("@/components/FilesTable/AnalysisFilesTable.vue", () => ({ default: { render: () => null } }));
vi.mock("@/components/datasets/files/BreadcrumbNavigation/BreadcrumbNavigation.vue", () => ({ default: { render: () => null } }));
vi.mock("vuex", () => ({ useStore: () => ({ commit: vi.fn(), state: { analysisModule: { selectedFilesForAnalysis: {} } } }) }));

import WorkspaceDataPicker from "./WorkspaceDataPicker.vue";

const flush = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    await nextTick();
  }
};

// The picker bound to a selection part as PlatformPane binds it.
function mountOn(part) {
  const Host = defineComponent({
    setup() {
      return () =>
        h(WorkspaceDataPicker, {
          dataset: part.dataset,
          "onUpdate:dataset": (v) => (part.dataset = v),
          files: part.files,
          "onUpdate:files": (v) => (part.files = v),
          models: part.models,
          "onUpdate:models": (v) => (part.models = v),
        });
    },
  });
  return mount(Host, { global: { plugins: [ElementPlus] } });
}

describe("WorkspaceDataPicker", () => {
  it("opened again on a dataset, lets another be chosen", async () => {
    const part = reactive({ dataset: datasets[0], files: [], models: [] });
    const w = mountOn(part);
    await flush();
    expect(w.text()).toContain("Alpha");

    await w.findAll("button").find((b) => b.text().includes("Change dataset")).trigger("click");
    await flush();
    expect(part.dataset).toBe(null);
    const beta = w.findAll("button.wdp__dataset").find((b) => b.text().includes("Beta"));
    expect(beta).toBeTruthy();

    await beta.trigger("click");
    await flush();
    expect(part.dataset?.content.id).toBe("N:dataset:b");
  });
});
