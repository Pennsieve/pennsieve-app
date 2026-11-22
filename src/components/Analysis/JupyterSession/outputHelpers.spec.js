import { describe, it, expect } from "vitest";
import { applyCarriageReturns, displayIdOf, pushOutput, toNbOutputs, updateDisplay } from "./outputHelpers";

const display = (text, displayId) => ({
  output_type: "display_data",
  data: { "text/plain": text },
  metadata: {},
  ...(displayId ? { _displayId: displayId } : {}),
});

describe("stream outputs", () => {
  it("merge consecutive streams of the same name", () => {
    const cell = { outputs: [] };
    pushOutput(cell, { output_type: "stream", name: "stdout", text: "a\n" });
    pushOutput(cell, { output_type: "stream", name: "stdout", text: "b\n" });
    pushOutput(cell, { output_type: "stream", name: "stderr", text: "c\n" });
    expect(cell.outputs).toHaveLength(2);
    expect(cell.outputs[0].text).toBe("a\nb\n");
  });

  it("don't merge across a display, and an update doesn't break a merge", () => {
    const cell = { outputs: [] };
    pushOutput(cell, { output_type: "stream", name: "stdout", text: "a" });
    pushOutput(cell, display("x", "d1"));
    updateDisplay([cell], "d1", { data: { "text/plain": "y" } });
    pushOutput(cell, { output_type: "stream", name: "stdout", text: "b" });
    pushOutput(cell, { output_type: "stream", name: "stdout", text: "c" });
    expect(cell.outputs.map((o) => o.text || o.data["text/plain"])).toEqual(["a", "y", "bc"]);
  });

  it("collapse carriage returns", () => {
    expect(applyCarriageReturns("10%\r50%\r100%\ndone")).toBe("100%\ndone");
  });
});

describe("display ids", () => {
  it("are read from the message's transient data", () => {
    expect(displayIdOf({ transient: { display_id: "abc" } })).toBe("abc");
    expect(displayIdOf({ transient: {} })).toBeNull();
    expect(displayIdOf({})).toBeNull();
    expect(displayIdOf(null)).toBeNull();
  });

  it("update every output with the id, in any cell", () => {
    const a = { outputs: [display("one", "d1"), display("other", "d2")] };
    const b = { outputs: [display("one again", "d1")] };
    const n = updateDisplay([a, b], "d1", { data: { "text/html": "<b>new</b>" }, metadata: { m: 1 } });
    expect(n).toBe(2);
    expect(a.outputs[0].data).toEqual({ "text/html": "<b>new</b>" });
    expect(a.outputs[0].metadata).toEqual({ m: 1 });
    expect(b.outputs[0].data).toEqual({ "text/html": "<b>new</b>" });
    expect(a.outputs[1].data).toEqual({ "text/plain": "other" });
    // Updated in place: still a display_data with its id, no output added.
    expect(a.outputs).toHaveLength(2);
    expect(a.outputs[0]).toMatchObject({ output_type: "display_data", _displayId: "d1" });
  });

  it("ignore an update nothing shows", () => {
    const a = { outputs: [display("one", "d1"), display("plain")] };
    expect(updateDisplay([a], "nope", { data: { "text/plain": "x" } })).toBe(0);
    expect(updateDisplay([a], null, { data: { "text/plain": "x" } })).toBe(0);
    expect(a.outputs.map((o) => o.data["text/plain"])).toEqual(["one", "plain"]);
  });

  it("go once the output is cleared", () => {
    const a = { outputs: [display("one", "d1")] };
    a.outputs = []; // clear_output
    expect(updateDisplay([a], "d1", { data: { "text/plain": "x" } })).toBe(0);
  });

  it("aren't saved in the notebook", () => {
    const shown = display("one", "d1");
    const saved = toNbOutputs([shown, display("plain")]);
    expect(saved[0]).toEqual({ output_type: "display_data", data: { "text/plain": "one" }, metadata: {} });
    expect(shown._displayId).toBe("d1"); // the live output keeps it
    expect(saved[1]).toEqual(display("plain"));
    expect(toNbOutputs(undefined)).toEqual([]);
  });
});
