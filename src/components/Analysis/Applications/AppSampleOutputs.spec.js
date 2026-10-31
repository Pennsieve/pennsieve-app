import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createStore } from "vuex";
import AppSampleOutputs from "./AppSampleOutputs.vue";

vi.mock("vue-router", () => ({ useRoute: () => ({ params: { orgId: "N:organization:1" } }) }));

const viewerStub = {
  name: "SampleOutputViewer",
  props: ["modelValue", "source", "workflowName", "version", "subtitle"],
  template: '<div v-if="modelValue" class="viewer-stub">{{ subtitle }}</div>',
};
const entries = [
  {
    workflow: { uuid: "wf-1", name: "Spatial Profiling" },
    example: { version: 3, runName: "Xenium demo", pages: 17, pdfUrl: "https://cdn/x.pdf", fetchedAt: Date.now() },
  },
  {
    workflow: { uuid: "wf-2", name: "Domain Mapping" },
    example: { version: 1, runId: "run-9", pdfUrl: "https://cdn/old.pdf", fetchedAt: 0 },
  },
];
const fetchWorkflowExample = vi.fn(async () => ({ version: 1, runId: "run-9", pdfUrl: "https://cdn/new.pdf" }));
const mountIt = () =>
  mount(AppSampleOutputs, {
    props: { entries: structuredClone(entries), appName: "st-niches", more: 2 },
    global: {
      plugins: [createStore({ modules: { analysisModule: { namespaced: true, actions: { fetchWorkflowExample } } } })],
      stubs: { SampleOutputViewer: viewerStub, "router-link": { props: ["to"], template: "<a><slot /></a>" } },
    },
  });
const viewButtons = (wrapper) => wrapper.findAll("button").filter((b) => b.text() === "View PDF");

describe("AppSampleOutputs", () => {
  it("lists the sample output of each workflow the app is in", () => {
    const text = mountIt().text().replace(/\s+/g, " ");
    expect(text).toContain("PDF summaries of runs of st-niches: on its own, and in the workflows that use it.");
    expect(text).toContain("Spatial Profiling");
    expect(text).toContain("Version 3 · run Xenium demo · 17 pages");
    expect(text).toContain("Domain Mapping");
    expect(text).toContain("Version 1 · run run-9");
    expect(text).toContain("2 more workflows use this app");
  });

  it("opens a workflow's PDF in the viewer", async () => {
    const wrapper = mountIt();
    await viewButtons(wrapper)[0].trigger("click");
    const viewer = wrapper.findComponent(viewerStub);
    expect(viewer.props("workflowName")).toBe("Spatial Profiling");
    expect(viewer.props("version")).toBe(3);
    expect(await viewer.props("source")()).toBe("https://cdn/x.pdf");
  });

  it("asks for a fresh link where the one in hand is old", async () => {
    const wrapper = mountIt();
    await viewButtons(wrapper)[1].trigger("click");
    expect(await wrapper.findComponent(viewerStub).props("source")()).toBe("https://cdn/new.pdf");
    expect(fetchWorkflowExample.mock.calls.at(-1)[1]).toBe("wf-2");
  });
});

describe("AppSampleOutputs, the app's own", () => {
  it("lists it first and opens it, refreshing an old link from the app", async () => {
    const fetchAppExample = vi.fn(async () => ({ app: { tag: "v0.1.0" }, runId: "r", pdfUrl: "https://cdn/own-new.pdf" }));
    const own = { own: true, workflow: null, example: { app: { sourceUrl: "https://github.com/x/st-niches", tag: "v0.1.0" }, runName: "try", pages: 9, pdfUrl: "https://cdn/own.pdf", fetchedAt: 0 } };
    const wrapper = mount(AppSampleOutputs, {
      props: { entries: [own, ...structuredClone(entries)], appName: "st-niches" },
      global: {
        plugins: [createStore({ modules: { analysisModule: { namespaced: true, actions: { fetchWorkflowExample, fetchAppExample } } } })],
        stubs: { SampleOutputViewer: viewerStub, "router-link": { props: ["to"], template: "<a><slot /></a>" } },
      },
    });
    const text = wrapper.text().replace(/\s+/g, " ");
    expect(text.indexOf("st-niches on its own")).toBeLessThan(text.indexOf("Spatial Profiling"));
    expect(text).toContain("v0.1.0 · run try · 9 pages");
    await viewButtons(wrapper)[0].trigger("click");
    const viewer = wrapper.findComponent(viewerStub);
    expect(viewer.props("workflowName")).toBe("st-niches");
    expect(await viewer.props("source")()).toBe("https://cdn/own-new.pdf");
    expect(fetchAppExample.mock.calls[0][1]).toBe("https://github.com/x/st-niches");
  });
});
