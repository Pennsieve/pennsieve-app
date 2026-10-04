import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import AgentDownloadCommand from "./AgentDownloadCommand.vue";
import EventBus from "@/utils/event-bus";
import { createSelection } from "@/utils/downloadService";

vi.mock("@/utils/downloadService", async (importOriginal) => ({
  ...(await importOriginal()),
  createSelection: vi.fn(),
}));

const props = { datasetId: "N:dataset:1", nodeIds: ["N:collection:1"], folderName: "study" };
const selectionCommand = "pennsieve download selection sel_l2uw6ebgbzymzzusdedg64i5wm ./study";
const nodeCommand = "pennsieve download dataset N:dataset:1 ./study --node N:collection:1";

function mountCommand(p = props) {
  return mount(AgentDownloadCommand, {
    props: p,
    global: {
      stubs: {
        "el-button": {
          props: ["disabled"],
          template: "<button :disabled=\"disabled\" @click=\"$emit('click')\"><slot /></button>",
        },
      },
    },
  });
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

describe("AgentDownloadCommand", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    createSelection.mockReset();
    createSelection.mockResolvedValue({ id: "sel_l2uw6ebgbzymzzusdedg64i5wm", count: 3, size: 30 });
  });

  it("saves the selection and shows its short command", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const wrapper = mountCommand();
    await flushPromises();

    expect(createSelection).toHaveBeenCalledWith({ datasetId: "N:dataset:1", nodeIds: ["N:collection:1"] });
    expect(wrapper.find("code").text()).toBe(selectionCommand);
    expect(wrapper.find(".hint").text()).toContain("2.3.0 or later");
    expect(wrapper.find(".hint").text()).toContain("works for two days");

    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(selectionCommand);
    expect(wrapper.find("button").text()).toBe("Copied");
  });

  it("can't be copied while the selection is being saved", async () => {
    const pending = deferred();
    createSelection.mockReturnValue(pending.promise);
    const wrapper = mountCommand();
    await flushPromises();
    expect(wrapper.find("code").text()).toBe("Preparing the command…");
    expect(wrapper.find("button").attributes("disabled")).toBeDefined();

    pending.resolve({ id: "sel_l2uw6ebgbzymzzusdedg64i5wm" });
    await flushPromises();
    expect(wrapper.find("button").attributes("disabled")).toBeUndefined();
  });

  it("falls back to the node ids when the selection can't be saved", async () => {
    createSelection.mockRejectedValue(new Error("download-service responded 404"));
    const wrapper = mountCommand();
    await flushPromises();
    expect(wrapper.find("code").text()).toBe(nodeCommand);
    expect(wrapper.find(".hint").text()).toContain("2.2.1 or later");
    expect(wrapper.find(".hint").text()).not.toContain("two days");
  });

  it("saves a new selection when items are removed, and ignores a late answer", async () => {
    const first = deferred();
    createSelection
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ id: "sel_bbbbbbbbbbbbbbbbbbbbbbbbbb" });
    const wrapper = mountCommand({ ...props, nodeIds: ["N:collection:1", "N:package:2"] });
    await wrapper.setProps({ nodeIds: ["N:collection:1"] });
    await flushPromises();
    expect(createSelection).toHaveBeenLastCalledWith({ datasetId: "N:dataset:1", nodeIds: ["N:collection:1"] });

    first.resolve({ id: "sel_aaaaaaaaaaaaaaaaaaaaaaaaaa" });
    await flushPromises();
    expect(wrapper.find("code").text()).toBe("pennsieve download selection sel_bbbbbbbbbbbbbbbbbbbbbbbbbb ./study");
  });

  it("asks to copy it by hand when the clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
    const emit = vi.spyOn(EventBus, "$emit");
    const wrapper = mountCommand();
    await flushPromises();
    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(emit.mock.calls[0][1].detail.type).toBe("error");
    expect(wrapper.find("button").text()).toBe("Copy");
  });
});
