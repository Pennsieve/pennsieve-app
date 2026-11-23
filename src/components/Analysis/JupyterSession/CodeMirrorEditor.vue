<script setup>
// Thin CodeMirror 6 wrapper used for notebook code/markdown cell editing.
// Grows with its content (no inner scrollbar) so cells stack like Jupyter, and
// surfaces the notebook keyboard shortcuts (Shift-Enter / Cmd-Enter / Alt-Enter
// / Escape / Arrow-out) as events for the parent to act on. With `complete`
// and `inspect` (the kernel's), Tab completes and Shift-Tab shows help.
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { EditorState, Compartment, Prec, StateEffect, StateField } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
  showTooltip,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentMore,
  indentLess,
} from "@codemirror/commands";
import {
  autocompletion,
  startCompletion,
  acceptCompletion,
  completionStatus,
} from "@codemirror/autocomplete";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
} from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { markdown } from "@codemirror/lang-markdown";
import { completionResult, inspectText, completesHere, helpsHere, toCodePoints } from "./kernelHelp";

const props = defineProps({
  modelValue: { type: String, default: "" },
  language: { type: String, default: "python" }, // python | markdown
  readonly: { type: Boolean, default: false },
  autofocus: { type: Boolean, default: false },
  // The kernel's completions and help: (code, cursorPos in code points) =>
  // the reply's content, or null.
  complete: { type: Function, default: null },
  inspect: { type: Function, default: null },
});

const emit = defineEmits([
  "update:modelValue",
  "run", // Shift-Enter: run + advance/insert below
  "run-in-place", // Cmd/Ctrl-Enter
  "run-insert-below", // Alt-Enter
  "command", // Escape: leave edit mode
  "arrow-up", // ArrowUp on first line: focus previous cell
  "arrow-down", // ArrowDown on last line: focus next cell
  "assist", // Mod-I: ask the code assistant (Mod-K is the app's chat)
  "focus",
  "blur",
]);

const host = ref(null);
let view = null;
const langCompartment = new Compartment();
const readonlyCompartment = new Compartment();
let applyingExternal = false;

function langExtension(lang) {
  return lang === "markdown" ? markdown() : python();
}

const theme = EditorView.theme({
  "&": { fontSize: "13px", backgroundColor: "transparent" },
  ".cm-content": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    padding: "8px 0",
  },
  ".cm-scroller": { overflow: "visible", lineHeight: "1.5" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "#b0b0b0",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-line": { padding: "0 8px" },
  // Subtle brand-navy tint for the active line/gutter (CodeMirror's default is
  // a bluish highlight that clashes with the themed cell). Only show it while
  // the editor is focused so unfocused cells stay clean.
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  "&.cm-focused .cm-activeLine": { backgroundColor: "rgba(1, 31, 91, 0.05)" },
  "&.cm-focused .cm-activeLineGutter": { backgroundColor: "rgba(1, 31, 91, 0.05)" },
  // Selection highlight in brand navy tint.
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(1, 31, 91, 0.12)",
  },
  ".cm-selectionBackground": { backgroundColor: "rgba(1, 31, 91, 0.08)" },
  ".cm-tooltip": { border: "1px solid #dcdfe6", borderRadius: "4px", backgroundColor: "#fff" },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    maxHeight: "16em",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: "rgba(1, 31, 91, 0.85)", color: "#fff" },
  ".cm-kernel-help": {
    margin: 0,
    padding: "6px 8px",
    maxWidth: "640px",
    maxHeight: "300px",
    overflow: "auto",
    whiteSpace: "pre-wrap",
    fontSize: "12px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
});

// Kernel help is for code cells only.
const kernelHelp = (fn) => (props.language === "markdown" ? null : fn);
const lineBefore = (state) => {
  const { head, empty } = state.selection.main;
  return empty ? state.sliceDoc(state.doc.lineAt(head).from, head) : "";
};

// Completions are asked for (Tab or Ctrl-Space), never while typing: each is
// a request to the kernel.
async function kernelCompletions(context) {
  const complete = kernelHelp(props.complete);
  if (!complete) return null;
  const code = context.state.doc.toString();
  const reply = await complete(code, toCodePoints(code, context.pos));
  return context.aborted ? null : completionResult(code, reply);
}

// Shift-Tab help, shown below the cursor until the next edit, cursor move or
// Escape.
const setHelp = StateEffect.define();
const helpField = StateField.define({
  create: () => null,
  update(help, tr) {
    for (const e of tr.effects) if (e.is(setHelp)) return e.value;
    return tr.docChanged || tr.selection ? null : help;
  },
  provide: (f) => showTooltip.from(f),
});
function helpTooltip(pos, text) {
  return {
    pos,
    above: false,
    create: () => {
      const dom = document.createElement("pre");
      dom.className = "cm-kernel-help";
      dom.textContent = text;
      return { dom };
    },
  };
}
async function showHelp(v) {
  const inspect = kernelHelp(props.inspect);
  if (!inspect) return;
  const { state } = v;
  const code = state.doc.toString();
  const pos = state.selection.main.head;
  const text = inspectText(await inspect(code, toCodePoints(code, pos)));
  // Not if the cell changed meanwhile (or the editor went away).
  if (!text || view !== v || v.state.doc !== state.doc || v.state.selection.main.head !== pos) return;
  v.dispatch({ effects: setHelp.of(helpTooltip(pos, text)) });
}

const tabKeymap = keymap.of([
  {
    key: "Tab",
    run: (v) => {
      // A list just opened takes a moment before it accepts: Tab does nothing
      // meanwhile (it would otherwise leave the editor).
      if (completionStatus(v.state) === "active") return acceptCompletion(v) || true;
      if (kernelHelp(props.complete) && completesHere(lineBefore(v.state))) return startCompletion(v);
      return indentMore(v);
    },
    shift: (v) => {
      if (kernelHelp(props.inspect) && helpsHere(lineBefore(v.state))) {
        showHelp(v);
        return true;
      }
      return indentLess(v);
    },
  },
]);

// Run shortcuts take precedence over CodeMirror's default Enter handling.
function notebookKeymap() {
  return Prec.highest(
    keymap.of([
      { key: "Shift-Enter", run: () => (emit("run"), true) },
      { key: "Mod-Enter", run: () => (emit("run-in-place"), true) },
      { key: "Alt-Enter", run: () => (emit("run-insert-below"), true) },
      { key: "Mod-i", run: () => (emit("assist"), true) },
      {
        key: "Escape",
        run: (v) => {
          if (v.state.field(helpField, false)) {
            v.dispatch({ effects: setHelp.of(null) });
            return true;
          }
          emit("command");
          v.contentDOM.blur();
          return true;
        },
      },
      {
        key: "ArrowUp",
        run: (v) => {
          const line = v.state.doc.lineAt(v.state.selection.main.head);
          if (line.number === 1) {
            emit("arrow-up");
            return true;
          }
          return false;
        },
      },
      {
        key: "ArrowDown",
        run: (v) => {
          const { doc, selection } = v.state;
          const line = doc.lineAt(selection.main.head);
          if (line.number === doc.lines) {
            emit("arrow-down");
            return true;
          }
          return false;
        },
      },
    ])
  );
}

onMounted(() => {
  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      // Before the notebook's keys, so Escape and the arrows act on an open
      // list of completions first.
      autocompletion({ override: [kernelCompletions], activateOnTyping: false }),
      notebookKeymap(),
      helpField,
      lineNumbers(),
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      langCompartment.of(langExtension(props.language)),
      readonlyCompartment.of(EditorState.readOnly.of(props.readonly)),
      tabKeymap,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      theme,
      EditorView.lineWrapping,
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !applyingExternal) {
          emit("update:modelValue", u.state.doc.toString());
        }
        if (u.focusChanged) emit(u.view.hasFocus ? "focus" : "blur");
      }),
    ],
  });
  view = new EditorView({ state, parent: host.value });
  if (props.autofocus) view.focus();
});

onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});

watch(
  () => props.modelValue,
  (val) => {
    if (!view || val === view.state.doc.toString()) return;
    applyingExternal = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: val ?? "" },
    });
    applyingExternal = false;
  }
);

watch(
  () => props.language,
  (lang) => {
    view?.dispatch({ effects: langCompartment.reconfigure(langExtension(lang)) });
  }
);

watch(
  () => props.readonly,
  (ro) => {
    view?.dispatch({
      effects: readonlyCompartment.reconfigure(EditorState.readOnly.of(ro)),
    });
  }
);

defineExpose({
  focus: () => view?.focus(),
});
</script>

<template>
  <div ref="host" class="cm-host" />
</template>

<style scoped>
.cm-host {
  width: 100%;
}
</style>
