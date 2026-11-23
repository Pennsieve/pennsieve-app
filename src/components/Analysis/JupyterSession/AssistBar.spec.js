import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import AssistBar from "./AssistBar.vue";

const bar = (assist) => mount(AssistBar, { props: { assist: reactive({ mode: "write", state: "idle", steps: [], prompt: "", ...assist }) } });
const buttons = (w) => w.findAll(".nb-assist__ask .nb-assist__btn").map((b) => b.text());

describe("AssistBar follow-ups", () => {
  it("asks for a change under the proposal, with the request as the heading", async () => {
    const w = bar({ followUps: true, conversationId: "c", state: "done", text: "df.plot()", asked: ["plot it", "log scale"], prompt: "log scale" });
    // The top: the request, no box or buttons but close.
    expect(w.find(".nb-assist__ask input").exists()).toBe(false);
    expect(w.find(".nb-assist__request").text()).toBe("plot it → log scale");
    expect(buttons(w)).toEqual([]);
    expect(w.find(".nb-assist__asked").exists()).toBe(false);
    // Under the proposal and its actions: the box.
    const refine = w.find(".nb-assist__refine");
    expect(refine.find("input").attributes("placeholder")).toBe("Ask for a change to this code");
    expect(refine.findAll(".nb-assist__btn").map((b) => b.text())).toEqual(["Refine", "Start over"]);
    expect(w.html().indexOf("nb-assist__actions")).toBeLessThan(w.html().indexOf("nb-assist__refine"));
    await refine.find("input").setValue("use a log scale");
    await refine.find("input").trigger("keydown.enter");
    expect(w.emitted("refine")).toEqual([["use a log scale"]]);
    expect(w.emitted("submit")).toBeUndefined();
  });

  it("while a follow-up works, heads the bar with the request and offers Stop", () => {
    const w = bar({ followUps: true, conversationId: "c", state: "asking", asked: ["plot it", "smaller"] });
    expect(w.find(".nb-assist__request").text()).toBe("plot it → smaller");
    expect(buttons(w)).toEqual(["Stop"]);
    expect(w.find(".nb-assist__refine").exists()).toBe(false);
  });

  it("after the proposal is in the cell, says so", () => {
    // Nothing shown (the bar kept on the cell after Use): one line, the box in it.
    const w = bar({ followUps: true, conversationId: "c", used: true, asked: ["plot it"] });
    expect(w.find(".nb-assist__ask input").attributes("placeholder")).toBe("Ask for a change to this cell");
    expect(buttons(w)).toEqual(["Refine", "Start over"]);
    expect(w.find(".nb-assist__asked").text()).toBe("Continuing: plot it");
    expect(w.find(".nb-assist__refine").exists()).toBe(false);
  });

  it("empties the box for each new proposal in the same conversation", async () => {
    const assist = reactive({ mode: "write", state: "done", steps: [], prompt: "", text: "df.plot()", followUps: true, conversationId: "c", asked: ["plot"], turn: 1 });
    const w = mount(AssistBar, { props: { assist }, attachTo: document.body });
    const box = () => w.find(".nb-assist__refine input");
    await box().setValue("smaller");
    assist.text = "df.plot(figsize=(4, 3))";
    assist.turn = 2;
    await nextTick();
    await nextTick();
    expect(box().element.value).toBe("");
    // Ready to type the next change in.
    expect(document.activeElement).toBe(box().element);
    w.unmount();
  });

  it("leaves the focus where the user went meanwhile", async () => {
    const elsewhere = document.body.appendChild(document.createElement("textarea"));
    const assist = reactive({ mode: "write", state: "done", steps: [], prompt: "", text: "x", followUps: true, conversationId: "c", asked: ["a"], turn: 1 });
    const w = mount(AssistBar, { props: { assist }, attachTo: document.body });
    elsewhere.focus();
    assist.turn = 2;
    await nextTick();
    await nextTick();
    expect(document.activeElement).toBe(elsewhere);
    w.unmount();
    elsewhere.remove();
  });

  it("starts over outside the conversation", async () => {
    const w = bar({ followUps: true, conversationId: "c", state: "done", text: "x", asked: ["a"] });
    await w.findAll(".nb-assist__refine .nb-assist__btn").find((b) => b.text() === "Start over").trigger("click");
    expect(w.emitted("restart")).toHaveLength(1);
  });

  it("is a new request where the session has no follow-ups", () => {
    const w = bar({ followUps: false, conversationId: "c", state: "done", text: "x", prompt: "plot it" });
    expect(buttons(w).slice(0, 1)).toEqual(["Ask"]);
  });
});

const chips = (w) => w.findAll(".nb-assist__chip").map((c) => c.text());
const actions = (w) => w.findAll(".nb-assist__actions .nb-assist__btn").map((b) => b.text());
const mountBar = (assist, props = {}) => mount(AssistBar, { props: { assist: reactive({ mode: "write", state: "idle", steps: [], prompt: "", ...assist }), ...props } });

describe("AssistBar: one box", () => {
  it("has one Ask button, and starters while nothing is typed", async () => {
    const w = mountBar({ agent: true, canSuggest: true }, { cellHasCode: true, cellHasError: true });
    expect(buttons(w)).toEqual(["Ask"]);
    expect(w.find("input").attributes("placeholder")).toBe("Ask a question, or say what the code should do");
    expect(chips(w)).toEqual(["Suggest a next step", "Explain this cell", "Fix the error"]);
    await w.findAll(".nb-assist__chip")[0].trigger("click");
    expect(w.emitted("suggest")).toHaveLength(1);
    await w.findAll(".nb-assist__chip")[1].trigger("click");
    expect(w.emitted("submit")).toEqual([["Explain what this cell does."]]);
    await w.findAll(".nb-assist__chip")[2].trigger("click");
    expect(w.emitted("fix")).toHaveLength(1);
    await w.find("input").setValue("plot by sex");
    expect(chips(w)).toEqual([]);
    await w.find("input").trigger("keydown.enter");
    expect(w.emitted("submit").at(-1)).toEqual(["plot by sex"]);
  });

  it("offers only what fits the cell and the session", () => {
    expect(chips(mountBar({ agent: true, canSuggest: true }))).toEqual(["Suggest a next step"]);
    // The single-shot assistant: no starters it can't do.
    expect(chips(mountBar({ agent: false }, { cellHasCode: true }))).toEqual([]);
    expect(chips(mountBar({ agent: true, canSuggest: true, state: "done", text: "x" }))).toEqual([]);
  });
});

describe("AssistBar: where the code goes", () => {
  it("puts a next step below, with replacing a click away", () => {
    const w = mountBar({ agent: true, state: "done", text: "df.describe()", placement: "below" }, { cellHasCode: true });
    expect(actions(w)).toEqual(["Insert below and run", "Insert below", "Replace this cell", "Discard"]);
  });

  it("replaces the cell for a change, with inserting below a click away", () => {
    const w = mountBar({ agent: true, state: "done", text: "df.plot()", placement: "replace" }, { cellHasCode: true });
    expect(actions(w)).toEqual(["Replace and run", "Insert below", "Discard"]);
  });

  it("uses an empty cell whatever the placement", () => {
    const w = mountBar({ agent: true, state: "done", text: "x", placement: "below" }, { cellHasCode: false });
    expect(actions(w)[0]).toBe("Use and run");
  });

  it("a suggestion from a session without placements goes below", () => {
    const w = mountBar({ agent: true, mode: "suggest", state: "done", text: "x" }, { cellHasCode: true });
    expect(actions(w)[0]).toBe("Insert below and run");
  });
});
