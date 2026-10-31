import { describe, it, expect, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createStore } from "vuex";
import AppSampleCard from "./AppSampleCard.vue";
import { useAppSample } from "./useAppSample";

const viewerStub = {
  name: "SampleOutputViewer",
  props: ["modelValue", "source", "workflowName", "subtitle"],
  template: '<div v-if="modelValue" class="viewer-stub" />',
};
const sample = {
  app: { name: "processor-fcs-prep", tag: "v0.1.3" },
  runName: "try fcs",
  pages: 6,
  createdAt: "2026-10-31T03:10:00Z",
  pdfUrl: "https://cdn/x.pdf",
};

describe("AppSampleCard", () => {
  it("says what the sample output is and opens it", async () => {
    const source = vi.fn(async () => "https://cdn/x.pdf");
    const wrapper = mount(AppSampleCard, {
      props: { sample, appName: "processor-fcs-prep", source },
      global: { stubs: { SampleOutputViewer: viewerStub, "bf-button": { template: "<button><slot /></button>" } } },
    });
    const text = wrapper.text().replace(/\s+/g, " ");
    expect(text).toContain("Sample output");
    expect(text).toContain("A PDF summary of one run of processor-fcs-prep");
    expect(text).toContain("v0.1.3 · run try fcs · 6 pages");
    expect(wrapper.find(".viewer-stub").exists()).toBe(false);
    await wrapper.findAll("button").find((b) => b.text() === "View sample output").trigger("click");
    const viewer = wrapper.findComponent(viewerStub);
    expect(viewer.props("modelValue")).toBe(true);
    expect(viewer.props("workflowName")).toBe("processor-fcs-prep");
    expect(viewer.props("source")).toBe(source);
  });

  it("opens from outside (the header's PDF button)", async () => {
    const wrapper = mount(AppSampleCard, {
      props: { sample, source: async () => "" },
      global: { stubs: { SampleOutputViewer: viewerStub, "bf-button": { template: "<button><slot /></button>" } } },
    });
    wrapper.vm.open();
    await flushPromises();
    expect(wrapper.find(".viewer-stub").exists()).toBe(true);
  });
});

describe("useAppSample", () => {
  it("loads the app's sample and refreshes an old link", async () => {
    const fetchAppExample = vi.fn(async () => sample);
    const store = createStore({ modules: { analysisModule: { namespaced: true, actions: { fetchAppExample } } } });
    let result;
    mount(
      defineComponent({
        setup() {
          result = useAppSample(ref("https://github.com/pennsieve-apps/processor-fcs-prep"));
          return () => h("div");
        },
      }),
      { global: { plugins: [store] } }
    );
    await flushPromises();
    expect(result.sample.value).toEqual(sample);
    expect(await result.pdfSource()).toBe("https://cdn/x.pdf");
    expect(fetchAppExample).toHaveBeenCalledTimes(1);
  });
});
