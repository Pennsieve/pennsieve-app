import { describe, it, expect } from "vitest";
import { ansiRuns, cachedAnsiRuns, applyCarriageReturns, displayIdOf, pushOutput, streamText, toNbOutputs, updateDisplay } from "./outputHelpers";

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

describe("pip's output (\\r\\n line ends and colours)", () => {
  const notice = "\r\n\u001b[1m[\u001b[0m\u001b[34;49mnotice\u001b[0m\u001b[1;39;49m]\u001b[0m\u001b[39;49m A new release of pip is available\u001b[0m\r\n";

  it("keeps \\r\\n lines, also split across writes", () => {
    expect(applyCarriageReturns("a\r\nb\r\n")).toBe("a\nb\n");
    const cell = { outputs: [] };
    pushOutput(cell, { output_type: "stream", name: "stdout", text: "line one\r" });
    pushOutput(cell, { output_type: "stream", name: "stdout", text: "\nline two\n" });
    expect(cell.outputs[0].text).toBe("line one\nline two\n");
    // A real carriage return still overwrites.
    const bar = { outputs: [] };
    pushOutput(bar, { output_type: "stream", name: "stdout", text: "10%\r" });
    pushOutput(bar, { output_type: "stream", name: "stdout", text: "100%\n" });
    expect(bar.outputs[0].text).toBe("100%\n");
  });

  it("shows pip's notice with its colours, the codes gone", () => {
    const cell = { outputs: [] };
    pushOutput(cell, { output_type: "stream", name: "stdout", text: notice });
    const runs = ansiRuns(streamText(cell.outputs[0]));
    expect(runs.map((r) => r.text).join("")).toBe("\n[notice] A new release of pip is available\n");
    expect(runs.find((r) => r.text === "notice").cls).toBe("ansi-blue-fg");
    expect(runs.find((r) => r.text === "[").cls).toBe("ansi-bold");
  });

  it("drops other escapes and reads past 256-colour codes", () => {
    expect(ansiRuns("a\u001b[2K\u001b[1Ab").map((r) => r.text).join("")).toBe("ab");
    expect(ansiRuns("\u001b[38;5;208mo\u001b[31mr")).toEqual([{ text: "o", cls: "" }, { text: "r", cls: "ansi-red-fg" }]);
    expect(ansiRuns("\u001b]0;title\u0007x")).toEqual([{ text: "x", cls: "" }]);
  });

  it("read colon-form codes and drop charset selections", () => {
    expect(ansiRuns("\u001b[38:5:1mo\u001b[31mr")).toEqual([{ text: "o", cls: "" }, { text: "r", cls: "ansi-red-fg" }]);
    expect(ansiRuns("\u001b[38:2:10:20:30;1mb")).toEqual([{ text: "b", cls: "ansi-bold" }]);
    expect(ansiRuns("\u001b(Ba\u001b)0b\u001b(0c").map((r) => r.text).join("")).toBe("abc");
    expect(ansiRuns("\u001b[101mx")).toEqual([{ text: "x", cls: "ansi-bright-red-bg" }]);
  });

  it("are parsed again only when an output's text changes", () => {
    const o = {};
    const a = cachedAnsiRuns(o, "\u001b[31mred");
    expect(cachedAnsiRuns(o, "\u001b[31mred")).toBe(a);
    const b = cachedAnsiRuns(o, "\u001b[31mred more");
    expect(b).not.toBe(a);
    expect(b).toEqual([{ text: "red more", cls: "ansi-red-fg" }]);
    expect(cachedAnsiRuns({}, "\u001b[31mred")).not.toBe(b);
  });
});

