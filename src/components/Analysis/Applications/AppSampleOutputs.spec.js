import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createStore } from "vuex";
import AppSampleOutputs from "./AppSampleOutputs.vue";

vi.mock("vue-router", () => ({ useRoute: () => ({ params: { orgId: "N:organization:1" } }) }));

const URL = "https://github.com/pennsieve-apps/st-niches";
const viewerStub = {
  name: "SampleOutputViewer",
  props: ["modelValue", "source", "workflowName", "version", "subtitle", "initialPage"],
  template: '<div v-if="modelValue" class="viewer-stub">{{ subtitle }}</div>',
};
const entries = [
  {
    workflow: { uuid: "wf-1", name: "Spatial Profiling" },
    indexed: true,
    example: { version: 3, runName: "Xenium demo", pages: 17, pdfUrl: "https://cdn/x.pdf", fetchedAt: Date.now() },
    steps: [{ step: "niches", app: "st-niches", sourceUrl: URL, version: "v0.1.0", figures: 3, outputs: 1, notStored: 0, pages: [4, 5, 8] }],
  },
  {
    workflow: { uuid: "wf-2", name: "Older" },
    indexed: false,
    example: { version: 1, runId: "run-9", pdfUrl: "https://cdn/y.pdf", fetchedAt: Date.now() },
    steps: [],
  },
];
const mountIt = () =>
  mount(AppSampleOutputs, {
    props: { entries, appName: "st-niches", more: 2 },
    global: {
      plugins: [createStore({ modules: { analysisModule: { namespaced: true, actions: { fetchWorkflowExample: vi.fn() } } } })],
      stubs: { SampleOutputViewer: viewerStub, "router-link": { props: ["to"], template: "<a><slot /></a>" } },
    },
  });

describe("AppSampleOutputs", () => {
  it("lists each workflow's sample with what it shows of the app's step", () => {
    const text = mountIt().text().replace(/\s+/g, " ");
    expect(text).toContain("Spatial Profiling");
    expect(text).toContain("Sample output of version 3 · run Xenium demo · 17 pages");
    expect(text).toContain("Step niches");
    expect(text).toContain("3 figures · 1 output · pages 4–5, 8");
    expect(text).toContain("made before PDFs recorded which pages");
    expect(text).toContain("2 more workflows use this app");
  });

  it("opens the PDF at the step's first page", async () => {
    const wrapper = mountIt();
    await wrapper.findAll("button").find((b) => b.text().includes("View pages 4–5, 8")).trigger("click");
    await flushPromises();
    const viewer = wrapper.findComponent(viewerStub);
    expect(viewer.props("initialPage")).toBe(4);
    expect(viewer.props("workflowName")).toBe("Spatial Profiling");
    expect(viewer.props("subtitle")).toContain("Step niches (st-niches v0.1.0) on pages 4–5, 8");
    expect(await viewer.props("source")()).toBe("https://cdn/x.pdf");
  });

  it("opens an older sample at its start", async () => {
    const wrapper = mountIt();
    await wrapper.findAll("button").find((b) => b.text() === "View PDF").trigger("click");
    expect(wrapper.findComponent(viewerStub).props("initialPage")).toBe(null);
  });
});
