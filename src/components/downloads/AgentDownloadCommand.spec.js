import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import AgentDownloadCommand from "./AgentDownloadCommand.vue";
import EventBus from "@/utils/event-bus";

const props = { datasetId: "N:dataset:1", nodeIds: ["N:collection:1"], folderName: "study" };
const command = "pennsieve download dataset N:dataset:1 ./study --node N:collection:1";

function mountCommand() {
  return mount(AgentDownloadCommand, {
    props,
    global: { stubs: { "el-button": { template: "<button @click=\"$emit('click')\"><slot /></button>" } } },
  });
}

describe("AgentDownloadCommand", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows the command and copies it", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const wrapper = mountCommand();
    expect(wrapper.find("code").text()).toBe(command);

    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(command);
    expect(wrapper.find("button").text()).toBe("Copied");
  });

  it("asks to copy it by hand when the clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
    const emit = vi.spyOn(EventBus, "$emit");
    const wrapper = mountCommand();
    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(emit.mock.calls[0][1].detail.type).toBe("error");
    expect(wrapper.find("button").text()).toBe("Copy");
  });
});
