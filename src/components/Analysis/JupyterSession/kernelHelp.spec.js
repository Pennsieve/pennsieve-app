import { describe, it, expect, vi } from "vitest";
import { kernelReply, toCodePoints, fromCodePoints, completionResult, inspectText, completesHere, helpsHere } from "./kernelHelp";

describe("kernelReply", () => {
  it("is the reply's content when the kernel answers ok", async () => {
    const content = { status: "ok", matches: ["head"] };
    expect(await kernelReply(async () => ({ content }))).toBe(content);
  });

  it("is null on an error reply, a failed request, or no answer in time", async () => {
    expect(await kernelReply(async () => ({ content: { status: "error" } }))).toBeNull();
    expect(await kernelReply(async () => Promise.reject(new Error("closed")))).toBeNull();
    vi.useFakeTimers();
    const late = kernelReply(() => new Promise(() => {}), 50);
    vi.advanceTimersByTime(50);
    expect(await late).toBeNull();
    vi.useRealTimers();
  });
});

describe("code points", () => {
  it("count a character outside the BMP once, as Jupyter does", () => {
    const text = 's = "😀"\ndf.he';
    expect(toCodePoints(text, text.length)).toBe(text.length - 1);
    expect(fromCodePoints(text, text.length - 1)).toBe(text.length);
    expect(toCodePoints("abc", 2)).toBe(2);
    expect(fromCodePoints("abc", 2)).toBe(2);
  });
});

describe("completionResult", () => {
  it("replaces the kernel's range with its matches, typed, without duplicates", () => {
    const text = "import numpy as np\nnp.ar";
    const reply = {
      matches: ["arange", "array", "array"],
      cursor_start: 22,
      cursor_end: 24,
      metadata: { _jupyter_types_experimental: [{ text: "arange", type: "function" }, { text: "array", type: "class" }] },
    };
    const r = completionResult(text, reply);
    expect(r.from).toBe(22);
    expect(r.to).toBe(24);
    expect(r.options).toEqual([{ label: "arange", type: "function" }, { label: "array", type: "class" }]);
    expect(r.validFor.test("ray")).toBe(true);
    expect(r.validFor.test("(")).toBe(false);
  });

  it("maps the kernel's positions after an emoji", () => {
    const text = '"😀"; x.va';
    const r = completionResult(text, { matches: ["values"], cursor_start: 7, cursor_end: 9 });
    expect(text.slice(r.from, r.to)).toBe("va");
  });

  it("offers nothing without matches (an R kernel without types too)", () => {
    expect(completionResult("x", null)).toBeNull();
    expect(completionResult("x", { matches: [], cursor_start: 0, cursor_end: 1 })).toBeNull();
    expect(completionResult("pri", { matches: ["print"], cursor_start: 0, cursor_end: 3 }).options).toEqual([{ label: "print" }]);
  });
});

describe("inspectText", () => {
  it("is the help as plain text, shortened", () => {
    expect(inspectText({ found: true, data: { "text/plain": "\x1b[0;31mSignature:\x1b[0m len(obj, /)\n" } })).toBe("Signature: len(obj, /)");
    expect(inspectText({ found: true, data: { "text/plain": "x".repeat(5000) } })).toHaveLength(4002);
    expect(inspectText({ found: false, data: {} })).toBe("");
    expect(inspectText(null)).toBe("");
  });
});

describe("Tab and Shift-Tab", () => {
  it("complete after a character and indent otherwise", () => {
    expect(completesHere("df.")).toBe(true);
    expect(completesHere("    pri")).toBe(true);
    expect(completesHere("")).toBe(false);
    expect(completesHere("    ")).toBe(false);
    expect(completesHere("x = 1 ")).toBe(false);
  });

  it("help after code on the line, dedent on an indented-only line", () => {
    expect(helpsHere("pd.read_csv(")).toBe(true);
    expect(helpsHere("f(a, ")).toBe(true);
    expect(helpsHere("    ")).toBe(false);
  });
});
