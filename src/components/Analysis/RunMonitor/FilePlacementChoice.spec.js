import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import FilePlacementChoice from "./FilePlacementChoice.vue";

const cards = (w) => w.findAll('[role="radio"]');
const files = (card) => card.findAll(".tree-file text").map((t) => t.text());
const folders = (card) => card.findAll(".tree-folder text").map((t) => t.text());

describe("FilePlacementChoice", () => {
  it("pictures where the files land for each choice", () => {
    const w = mount(FilePlacementChoice);
    const [selected, source] = cards(w);
    expect(selected.text()).toContain("As selected");
    expect(folders(selected)).toEqual(["input/"]);
    expect(files(selected)).toEqual(["electrodes.tsv", "run-01.edf"]);
    expect(source.text()).toContain("As in the source");
    expect(folders(source)).toEqual(["input/", "sub-01/", "ieeg/"]);
    expect(files(source)).toEqual(["electrodes.tsv", "run-01.edf"]);
  });

  it("marks the choice, selection by default", async () => {
    const w = mount(FilePlacementChoice);
    expect(cards(w).map((c) => c.attributes("aria-checked"))).toEqual(["true", "false"]);
    await w.setProps({ modelValue: "source" });
    expect(cards(w).map((c) => c.attributes("aria-checked"))).toEqual(["false", "true"]);
    expect(cards(w)[1].classes()).toContain("is-chosen");
    // Only the chosen card is in the tab order.
    expect(cards(w).map((c) => c.attributes("tabindex"))).toEqual(["-1", "0"]);
  });

  it("emits a new choice on click, not the current one again", async () => {
    const w = mount(FilePlacementChoice, { props: { modelValue: "selection" } });
    await cards(w)[0].trigger("click");
    expect(w.emitted("update:modelValue")).toBeUndefined();
    await cards(w)[1].trigger("click");
    expect(w.emitted("update:modelValue")).toEqual([["source"]]);
  });

  it("moves the choice with the arrow keys", async () => {
    const w = mount(FilePlacementChoice, { props: { modelValue: "source" } });
    await w.find('[role="radiogroup"]').trigger("keydown", { key: "ArrowRight" });
    expect(w.emitted("update:modelValue")).toEqual([["selection"]]);
  });

  it("doesn't change while disabled", async () => {
    const w = mount(FilePlacementChoice, { props: { disabled: true } });
    await cards(w)[1].trigger("click");
    expect(w.emitted("update:modelValue")).toBeUndefined();
  });
});
