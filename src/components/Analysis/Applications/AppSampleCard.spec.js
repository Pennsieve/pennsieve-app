import { describe, it, expect, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { createStore } from "vuex";
import AppSampleCard from "./AppSampleCard.vue";
import { useAppSample } from "./useAppSample";

const viewerStub = {
  name: "SampleOutputViewer",
  props: ["modelValue", "source", "workflowName", "subtitle", "kind"],
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

  it("shows the pipeline's sample document with its first page as a thumbnail", async () => {
    const pipeline = {
      pipeline: true,
      app: { tag: "v0.1.5" },
      pages: 9,
      createdAt: "2026-11-11T23:10:24Z",
      pdfUrl: "https://assets/public/apps/a/v0.1.5/x.pdf",
      previewUrl: "https://assets/public/apps/a/v0.1.5/x.preview.png",
    };
    const wrapper = mount(AppSampleCard, {
      props: { sample: pipeline, appName: "nwb-inspect", source: () => pipeline.pdfUrl },
      global: { stubs: { SampleOutputViewer: viewerStub, "bf-button": { template: "<button><slot /></button>" } } },
    });
    const text = wrapper.text().replace(/\s+/g, " ");
    expect(text).toContain("Release report");
    expect(wrapper.findAll("button").some((b) => b.text() === "View report")).toBe(true);
    expect(text).toContain("Pennsieve ran nwb-inspect v0.1.5 on its test inputs at release");
    expect(text).toContain("v0.1.5 · 9 pages");
    expect(text).not.toContain("run ");
    expect(wrapper.find("img.app-sample-card__preview").attributes("src")).toBe(pipeline.previewUrl);
    await wrapper.find("button.app-sample-card__icon").trigger("click");
    expect(wrapper.findComponent(viewerStub).props("modelValue")).toBe(true);
    expect(wrapper.findComponent(viewerStub).props("kind")).toBe("release report");
  });

  it("shows a workflow's example report with its note and actions", async () => {
    const wrapper = mount(AppSampleCard, {
      props: {
        sample: { pages: 4, createdAt: "2026-11-13T19:00:00Z" },
        appName: "Scalp EEG",
        source: async () => "",
        title: "Example report from version 2",
        ledeText: "A PDF of one run of Scalp EEG: its inputs, results and figures.",
        metaText: "4 pages · Nov 13, 2026",
        note: "Apps updated since this report",
        noteDetail: "eeg-spikes v0.1.0 → v0.1.1",
        compact: true,
      },
      slots: { actions: '<button class="remove">Remove example</button>' },
      global: { stubs: { SampleOutputViewer: viewerStub, "bf-button": { template: "<button><slot /></button>" } } },
    });
    const text = wrapper.text().replace(/\s+/g, " ");
    expect(text).toContain("Example report from version 2");
    expect(text).not.toContain("A PDF of one run of Scalp EEG");
    expect(text).toContain("4 pages · Nov 13, 2026");
    expect(wrapper.find(".app-sample-card__note").attributes("title")).toBe("eeg-spikes v0.1.0 → v0.1.1");
    expect(wrapper.find(".app-sample-card--compact").exists()).toBe(true);
    expect(wrapper.find("button.remove").exists()).toBe(true);
    await wrapper.findAll("button").find((b) => b.text() === "View report").trigger("click");
    expect(wrapper.findComponent(viewerStub).props("kind")).toBe("example report from version 2");
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
