import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { EditorView } from "@codemirror/view";
import CodeMirrorEditor from "./CodeMirrorEditor.vue";

// The cursor at the end of the cell.
const toEnd = (w) => {
  const view = EditorView.findFromDOM(w.find(".cm-editor").element);
  view.dispatch({ selection: { anchor: view.state.doc.length } });
};
const view = (w) => EditorView.findFromDOM(w.find(".cm-editor").element);
// Typing at the cursor, as a user does (CodeMirror's input.type event).
const type = (w, text) => {
  const v = view(w);
  const at = v.state.selection.main.head;
  v.dispatch({ changes: { from: at, insert: text }, selection: { anchor: at + text.length }, userEvent: "input.type" });
};
const labels = () => [...document.querySelectorAll(".cm-tooltip-autocomplete li")].map((li) => li.textContent);
const tab = (w, shiftKey = false) =>
  w.find(".cm-content").element.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", keyCode: 9, shiftKey, bubbles: true, cancelable: true }));

describe("CodeMirrorEditor kernel help", () => {
  it("asks the kernel for completions on Tab after a name, with the cursor in code points", async () => {
    const complete = vi.fn(async () => ({ status: "ok", matches: ["head"], cursor_start: 3, cursor_end: 4, metadata: {} }));
    const w = mount(CodeMirrorEditor, { props: { modelValue: "df.h", complete }, attachTo: document.body });
    toEnd(w);
    tab(w);
    await vi.waitFor(() => expect(complete).toHaveBeenCalled());
    expect(complete.mock.calls[0]).toEqual(["df.h", 4]);
    w.unmount();
  });

  it("lists the kernel's matches, and a second Tab takes the selected one", async () => {
    const complete = vi.fn(async () => ({ status: "ok", matches: ["head", "hist"], cursor_start: 3, cursor_end: 4, metadata: {} }));
    const w = mount(CodeMirrorEditor, { props: { modelValue: "df.h", complete }, attachTo: document.body });
    toEnd(w);
    tab(w);
    await vi.waitFor(() => expect(document.querySelectorAll(".cm-tooltip-autocomplete li")).toHaveLength(2));
    // A list accepts after a moment (CodeMirror's interactionDelay).
    await new Promise((r) => setTimeout(r, 100));
    tab(w);
    expect(w.emitted("update:modelValue").at(-1)[0]).toBe("df.head");
    w.unmount();
  });

  it("shows the kernel's matches in its order, ones that don't spell what's typed too", async () => {
    const complete = vi.fn(async () => ({ status: "ok", matches: ["n=", "zeta", "abs"], cursor_start: 0, cursor_end: 0, metadata: {} }));
    const w = mount(CodeMirrorEditor, { props: { modelValue: "x=\\alpha", complete }, attachTo: document.body });
    complete.mockResolvedValueOnce({ status: "ok", matches: ["α"], cursor_start: 2, cursor_end: 8, metadata: {} });
    toEnd(w);
    tab(w);
    await vi.waitFor(() => expect(labels()).toEqual(["α"]));
    w.unmount();
    const w2 = mount(CodeMirrorEditor, { props: { modelValue: "f(", complete }, attachTo: document.body });
    toEnd(w2);
    tab(w2);
    await vi.waitFor(() => expect(labels()).toEqual(["n=", "zeta", "abs"]));
    w2.unmount();
  });

  it("narrows the list as a name is typed, and closes it on anything else without asking again", async () => {
    const complete = vi.fn(async () => ({ status: "ok", matches: ["head", "hist", "shape"], cursor_start: 3, cursor_end: 4, metadata: {} }));
    const w = mount(CodeMirrorEditor, { props: { modelValue: "df.h", complete }, attachTo: document.body });
    toEnd(w);
    tab(w);
    // The kernel's list as it sent it, then narrowed as the name grows.
    await vi.waitFor(() => expect(labels()).toEqual(["head", "hist", "shape"]));
    type(w, "e");
    await vi.waitFor(() => expect(labels()).toEqual(["head"]));
    type(w, "(");
    await vi.waitFor(() => expect(labels()).toEqual([]));
    await new Promise((r) => setTimeout(r, 50));
    expect(complete).toHaveBeenCalledTimes(1);
    // Tab asks again.
    tab(w);
    await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(2));
    expect(complete.mock.calls[1]).toEqual(["df.he(", 6]);
    w.unmount();
  });

  it("keeps the arrows for the cell while the kernel is still answering", async () => {
    const complete = vi.fn(() => new Promise(() => {}));
    const w = mount(CodeMirrorEditor, { props: { modelValue: "a\ndf.h", complete }, attachTo: document.body });
    toEnd(w);
    tab(w);
    await vi.waitFor(() => expect(complete).toHaveBeenCalled());
    w.find(".cm-content").element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", keyCode: 38, bubbles: true, cancelable: true }));
    expect(view(w).state.doc.lineAt(view(w).state.selection.main.head).number).toBe(1);
    w.unmount();
  });

  it("indents on Tab at the start of a line, without asking the kernel", async () => {
    const complete = vi.fn();
    const w = mount(CodeMirrorEditor, { props: { modelValue: "", complete }, attachTo: document.body });
    tab(w);
    await flushPromises();
    expect(complete).not.toHaveBeenCalled();
    expect(w.emitted("update:modelValue")?.at(-1)?.[0]).toMatch(/^\s+$/);
    w.unmount();
  });

  it("asks for nothing in a markdown cell", async () => {
    const complete = vi.fn();
    const w = mount(CodeMirrorEditor, { props: { modelValue: "# Ti", language: "markdown", complete }, attachTo: document.body });
    toEnd(w);
    tab(w);
    await flushPromises();
    expect(complete).not.toHaveBeenCalled();
    w.unmount();
  });

  it("shows the kernel's help on Shift-Tab", async () => {
    const inspect = vi.fn(async () => ({ status: "ok", found: true, data: { "text/plain": "Signature: len(obj, /)" } }));
    const w = mount(CodeMirrorEditor, { props: { modelValue: "len(", inspect }, attachTo: document.body });
    toEnd(w);
    tab(w, true);
    await vi.waitFor(() => expect(document.querySelector(".cm-kernel-help")?.textContent).toBe("Signature: len(obj, /)"));
    // Kept while focus is in it (selecting its text), closed when focus leaves.
    const help = () => document.querySelector(".cm-kernel-help");
    const outside = document.body.appendChild(document.createElement("button"));
    w.find(".cm-content").element.focus();
    help().focus();
    await flushPromises();
    expect(help()).not.toBeNull();
    outside.focus();
    await vi.waitFor(() => expect(help()).toBeNull());
    outside.remove();
    w.unmount();
  });
});
