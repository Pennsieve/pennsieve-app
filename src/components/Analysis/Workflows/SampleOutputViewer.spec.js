import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import SampleOutputViewer from "./SampleOutputViewer.vue";
import * as runExamples from "./runExamples";
import { renderPdfPages } from "./pdfPages";

vi.mock("./pdfPages", () => ({ renderPdfPages: vi.fn() }));

const stubs = {
  "el-dialog": {
    props: ["modelValue"],
    template: '<div v-if="modelValue" class="dialog-stub"><slot name="header" :close="() => {}" /><slot /></div>',
  },
  "el-tooltip": { template: "<span><slot /></span>" },
  "bf-button": { template: "<button v-bind=\"$attrs\"><slot /></button>" },
};
const mountIt = async (props) => {
  const wrapper = mount(SampleOutputViewer, { props, global: { stubs } });
  await flushPromises();
  return wrapper;
};

beforeEach(() => {
  renderPdfPages.mockReset();
  renderPdfPages.mockImplementation(async (href, host, { onFirstPage }) => {
    const page = document.createElement("canvas");
    page.className = "page";
    host.appendChild(page);
    onFirstPage();
    return { pages: 1, destroy: vi.fn() };
  });
});
afterEach(() => vi.restoreAllMocks());

describe("SampleOutputViewer", () => {
  it("draws the PDF's pages in the page, titled after the workflow", async () => {
    const source = vi.fn(async () => "https://cdn/x.pdf");
    const wrapper = await mountIt({ modelValue: true, source, workflowName: "Spatial Profiling", version: 3, subtitle: "Version 3 · run r1" });
    expect(source).toHaveBeenCalledTimes(1);
    expect(renderPdfPages.mock.calls[0][0]).toBe("https://cdn/x.pdf");
    expect(wrapper.find("canvas.page").exists()).toBe(true);
    expect(wrapper.find("iframe").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Loading the PDF");
    expect(wrapper.text()).toContain("Spatial Profiling: sample output");
    expect(wrapper.text()).toContain("Version 3 · run r1");
  });

  it("falls back to the browser's PDF viewer where the pages can't be drawn", async () => {
    renderPdfPages.mockRejectedValue(new Error("no CORS"));
    const wrapper = await mountIt({ modelValue: true, source: "https://cdn/x.pdf" });
    expect(wrapper.find("iframe").attributes("src")).toBe("https://cdn/x.pdf");
    await wrapper.setProps({ initialPage: 5 });
    expect(wrapper.find("iframe").attributes("src")).toBe("https://cdn/x.pdf#page=5");
  });

  it("asks for the link only when opened", async () => {
    const source = vi.fn(async () => "https://cdn/x.pdf");
    const wrapper = await mountIt({ modelValue: false, source });
    expect(source).not.toHaveBeenCalled();
    await wrapper.setProps({ modelValue: true });
    await flushPromises();
    expect(source).toHaveBeenCalledTimes(1);
  });

  it("says so where there's no PDF", async () => {
    const wrapper = await mountIt({ modelValue: true, source: async () => null });
    expect(wrapper.find("iframe").exists()).toBe(false);
    expect(wrapper.text()).toContain("could not be loaded");
  });

  it("downloads under a readable name", async () => {
    const spy = vi.spyOn(runExamples, "downloadPdf").mockResolvedValue("saved");
    const wrapper = await mountIt({ modelValue: true, source: "https://cdn/x.pdf", workflowName: "Spatial Profiling", version: 3 });
    await wrapper.findAll("button").find((b) => b.text().includes("Download PDF")).trigger("click");
    await flushPromises();
    expect(spy).toHaveBeenCalledWith("https://cdn/x.pdf", "Spatial Profiling - sample output v3.pdf");
  });
});
