<script setup>
// Thin CodeMirror 6 wrapper used for notebook code/markdown cell editing.
// Grows with its content (no inner scrollbar) so cells stack like Jupyter, and
// surfaces the notebook keyboard shortcuts (Shift-Enter / Cmd-Enter / Alt-Enter
// / Escape / Arrow-out) as events for the parent to act on.
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { EditorState, Compartment, Prec } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
} from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { markdown } from "@codemirror/lang-markdown";

const props = defineProps({
  modelValue: { type: String, default: "" },
  language: { type: String, default: "python" }, // python | markdown
  readonly: { type: Boolean, default: false },
  autofocus: { type: Boolean, default: false },
});

const emit = defineEmits([
  "update:modelValue",
  "run", // Shift-Enter: run + advance/insert below
  "run-in-place", // Cmd/Ctrl-Enter
  "run-insert-below", // Alt-Enter
  "command", // Escape: leave edit mode
  "arrow-up", // ArrowUp on first line: focus previous cell
  "arrow-down", // ArrowDown on last line: focus next cell
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
});

// Run shortcuts take precedence over CodeMirror's default Enter handling.
function notebookKeymap() {
  return Prec.highest(
    keymap.of([
      { key: "Shift-Enter", run: () => (emit("run"), true) },
      { key: "Mod-Enter", run: () => (emit("run-in-place"), true) },
      { key: "Alt-Enter", run: () => (emit("run-insert-below"), true) },
      {
        key: "Escape",
        run: (v) => {
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
      notebookKeymap(),
      lineNumbers(),
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      langCompartment.of(langExtension(props.language)),
      readonlyCompartment.of(EditorState.readOnly.of(props.readonly)),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
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
