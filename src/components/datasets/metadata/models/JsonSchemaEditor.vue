<template>
  <div ref="host" class="json-cm" />
</template>

<script setup>
// Lightweight CodeMirror 6 editor for the model's JSON Schema. Uses the
// JavaScript language mode (JSON is a subset, so it tokenizes/colors cleanly)
// plus a JSON linter that marks parse errors inline. No new dependency — every
// @codemirror/* package used here already ships with the app.
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
  foldGutter,
  foldKeymap,
} from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { linter, lintGutter } from '@codemirror/lint'
import { javascript } from '@codemirror/lang-javascript'

const props = defineProps({
  modelValue: { type: String, default: '' },
  autofocus: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const host = ref(null)
let view = null
let applyingExternal = false

// Mark JSON parse errors inline (red underline + gutter marker).
const jsonLinter = linter((v) => {
  const text = v.state.doc.toString()
  if (!text.trim()) return []
  try {
    JSON.parse(text)
    return []
  } catch (e) {
    const m = /position (\d+)/.exec(e.message || '')
    const pos = m ? Math.min(Number(m[1]), text.length) : 0
    return [
      {
        from: Math.max(0, pos - 1),
        to: Math.min(pos + 1, text.length),
        severity: 'error',
        message: e.message || 'Invalid JSON',
      },
    ]
  }
})

const cmTheme = EditorView.theme({
  '&': { fontSize: '12px', backgroundColor: 'transparent' },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    lineHeight: '1.55',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: '#b0b0b0' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
  '&.cm-focused .cm-activeLine': { backgroundColor: 'rgba(103, 88, 177, 0.06)' },
  '&.cm-focused .cm-activeLineGutter': { backgroundColor: 'rgba(103, 88, 177, 0.06)' },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(103, 88, 177, 0.15)',
  },
})

onMounted(() => {
  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      foldGutter(),
      lintGutter(),
      history(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      javascript(),
      jsonLinter,
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
      cmTheme,
      EditorView.lineWrapping,
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !applyingExternal) emit('update:modelValue', u.state.doc.toString())
      }),
    ],
  })
  view = new EditorView({ state, parent: host.value })
  if (props.autofocus) view.focus()
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

// Reflect external changes (e.g. re-derive from properties) into the editor.
watch(
  () => props.modelValue,
  (val) => {
    if (!view || val === view.state.doc.toString()) return
    applyingExternal = true
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: val ?? '' } })
    applyingExternal = false
  }
)

defineExpose({ focus: () => view?.focus() })
</script>

<style scoped lang="scss">
@use '../../../../styles/theme' as theme;

.json-cm {
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  overflow: hidden;

  :deep(.cm-editor) {
    max-height: 360px;
  }
  :deep(.cm-scroller) {
    overflow: auto;
  }
  &:focus-within {
    border-color: theme.$purple_2;
  }
}
</style>
