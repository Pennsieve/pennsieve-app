import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { EditorView } from "@codemirror/view";
import CodeMirrorEditor from "./CodeMirrorEditor.vue";

// The cursor at the end of the cell.
const toEnd = (w) => {
  const view = EditorView.findFromDOM(w.find(".cm-editor").element);
  view.dispatch({ selection: { anchor: view.state.doc.length } });
};
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
    w.unmount();
  });
});
