import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { ElCheckbox } from "element-plus";
import MetadataRecordsChoice from "./MetadataRecordsChoice.vue";

const mountChoice = (props) => mount(MetadataRecordsChoice, { props, global: { components: { ElCheckbox } } });
const boxes = (w) => w.findAll('input[type="checkbox"]');
const emitted = (w) => w.emitted("update:modelValue").at(-1)[0];

describe("MetadataRecordsChoice", () => {
  it("shows nothing for a version without models", () => {
    expect(mountChoice({ available: [], modelValue: [] }).text()).toBe("");
  });

  it("takes every model when switched on, and none when off", async () => {
    const w = mountChoice({ available: ["participant", "sample"], modelValue: [] });
    expect(boxes(w)).toHaveLength(1);
    await boxes(w)[0].setValue(true);
    expect(emitted(w)).toEqual(["participant", "sample"]);
    await w.setProps({ modelValue: ["participant", "sample"] });
    expect(boxes(w)).toHaveLength(3);
    await boxes(w)[0].setValue(false);
    expect(emitted(w)).toEqual([]);
  });

  it("lets a model be unticked, but not the last one", async () => {
    const w = mountChoice({ available: ["participant", "sample"], modelValue: ["participant", "sample"] });
    await boxes(w)[2].setValue(false);
    expect(emitted(w)).toEqual(["participant"]);
    await w.setProps({ modelValue: ["participant"] });
    expect(boxes(w)[1].attributes("disabled")).toBeDefined();
    expect(boxes(w)[2].attributes("disabled")).toBeUndefined();
  });

  it("lists no models when there's only one", () => {
    const w = mountChoice({ available: ["participant"], modelValue: ["participant"] });
    expect(boxes(w)).toHaveLength(1);
  });
});
