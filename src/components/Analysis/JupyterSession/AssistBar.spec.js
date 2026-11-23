import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, reactive } from "vue";
import AssistBar from "./AssistBar.vue";

const bar = (assist) => mount(AssistBar, { props: { assist: reactive({ mode: "write", state: "idle", steps: [], prompt: "", ...assist }) } });
const buttons = (w) => w.findAll(".nb-assist__ask .nb-assist__btn").map((b) => b.text());

describe("AssistBar follow-ups", () => {
  it("asks for a change to a proposal in its conversation", async () => {
    const w = bar({ followUps: true, conversationId: "c", state: "done", text: "df.plot()", asked: ["plot it"], prompt: "plot it" });
    expect(buttons(w)).toEqual(["Refine", "Start over"]);
    expect(w.find("input").attributes("placeholder")).toBe("Ask for a change to this code");
    expect(w.find(".nb-assist__asked").text()).toBe("Continuing: plot it");
    await w.find("input").setValue("use a log scale");
    await w.find("input").trigger("keydown.enter");
    expect(w.emitted("refine")).toEqual([["use a log scale"]]);
    expect(w.emitted("submit")).toBeUndefined();
  });

  it("after the proposal is in the cell, says so", () => {
    const w = bar({ followUps: true, conversationId: "c", used: true, asked: ["plot it"] });
    expect(w.find("input").attributes("placeholder")).toBe("Ask for a change to this cell");
    expect(buttons(w)).toEqual(["Refine", "Start over"]);
  });

  it("empties the box for each new proposal in the same conversation", async () => {
    const assist = reactive({ mode: "write", state: "done", steps: [], prompt: "", followUps: true, conversationId: "c", asked: [], turn: 1 });
    const w = mount(AssistBar, { props: { assist } });
    await w.find("input").setValue("smaller");
    assist.turn = 2;
    await nextTick();
    expect(w.find("input").element.value).toBe("");
  });

  it("starts over outside the conversation", async () => {
    const w = bar({ followUps: true, conversationId: "c", state: "done", text: "x", asked: ["a"] });
    await w.findAll(".nb-assist__btn").find((b) => b.text() === "Start over").trigger("click");
    expect(w.emitted("restart")).toHaveLength(1);
  });

  it("is a new request where the session has no follow-ups", () => {
    const w = bar({ followUps: false, conversationId: "c", state: "done", text: "x", prompt: "plot it" });
    expect(buttons(w)).toEqual(["Write"]);
  });
});

describe("AssistBar suggestions", () => {
  it("suggests with nothing typed, and with something typed offers it next to Write", async () => {
    const w = bar({ canSuggest: true });
    expect(buttons(w)).toEqual(["Suggest"]);
    await w.find("input").setValue("focus on outcomes");
    expect(buttons(w)).toEqual(["Suggest", "Write"]);
    await w.findAll(".nb-assist__ask button").find((b) => b.text() === "Suggest").trigger("click");
    expect(w.emitted("suggest")).toEqual([["focus on outcomes"]]);
    await w.find("input").trigger("keydown.enter");
    expect(w.emitted("submit")).toEqual([["focus on outcomes"]]);
  });
});
