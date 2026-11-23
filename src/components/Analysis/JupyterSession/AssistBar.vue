<script setup>
// The code assistant's bar (✦ or Cmd/Ctrl-I above a cell, a file's Ask…, or
// under an error, Fix): the user says what the code should do, and the
// proposal comes back with what the assistant did to get there (the files it
// read, what it looked at in the kernel, its runs) and what it cost. They
// take it (into this cell, or a new one below) or leave it, or ask for a
// change (Refine: a follow-up in the same conversation, also after it's in
// the cell and has run). Nothing runs unless they choose Fix and run. The
// state is the cell's _assist (JupyterSession owns it).
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { cellCode, stepLabel, usageLine } from "./assistHelpers";
import AssistIcon from "./AssistIcon.vue";

const props = defineProps({
  assist: { type: Object, required: true },
  // The cell has code: taking the reply replaces it.
  cellHasCode: { type: Boolean, default: false },
});
const emit = defineEmits(["submit", "suggest", "refine", "restart", "stop", "accept", "accept-run", "use-run", "insert-below", "insert-below-run", "insert-answer", "answer-to-code", "discard", "clear-file"]);

const prompt = ref(props.assist.prompt || "");
const input = ref(null);
const asking = computed(() => props.assist.state === "asking");
const fix = computed(() => props.assist.mode === "fix");
const code = computed(() => cellCode(props.assist.text));
const fileName = computed(() => String(props.assist.file || "").split("/").pop());
// A question's answer, in Markdown, shown as the page's own HTML: sanitized.
const answerHtml = computed(() => (props.assist.answer ? DOMPurify.sanitize(marked.parse(props.assist.answer, { gfm: true, breaks: true })) : ""));
const usage = computed(() => usageLine(props.assist.usage, props.assist.budget));
const title = computed(() => {
  const a = props.assist;
  if (a.running) return a.run ? `Running the fix (try ${a.run.attempt} of ${a.run.of})…` : "Running the fix…";
  if (a.state === "failed") return "It didn't run cleanly in a few tries: its last attempt is below.";
  if (asking.value) return "Working out a fix…";
  return "Fix this error";
});

onMounted(async () => {
  await nextTick();
  input.value?.focus();
});

// A proposal (or answer) to follow up: what's typed asks for a change to it.
const refining = computed(
  () => !!props.assist.followUps && !!props.assist.conversationId && !fix.value && !asking.value && props.assist.state !== "budget"
);
const placeholder = computed(() => {
  const a = props.assist;
  if (refining.value) return a.answer ? "Ask a follow-up question" : a.used ? "Ask for a change to this cell" : "Ask for a change to this code";
  if (a.file) return `What should the code do with ${fileName.value}?`;
  return a.canSuggest ? "Describe the code this cell should have, or ask for a suggestion" : "Describe the code this cell should have";
});
// Each proposal (and the bar kept on a cell after Use) starts the box empty
// for the next follow-up.
watch(
  () => props.assist.turn,
  () => {
    if (refining.value) prompt.value = "";
  }
);

// Nothing typed: the agent may suggest the next cell instead; with something
// typed, a suggestion with that in mind is on offer next to Write.
const suggests = computed(() => !fix.value && !refining.value && !!props.assist.canSuggest && !prompt.value.trim());
const steers = computed(() => !fix.value && !refining.value && !asking.value && !!props.assist.canSuggest && !!prompt.value.trim());

function submit() {
  if (asking.value) return;
  if (refining.value) {
    if (prompt.value.trim()) emit("refine", prompt.value.trim());
    return;
  }
  if (suggests.value) return emit("suggest");
  if (!fix.value && !prompt.value.trim()) return;
  emit("submit", prompt.value.trim());
}
</script>

<template>
  <div class="nb-assist" @click.stop @keydown.esc.stop="emit('discard')">
    <div class="nb-assist__ask">
      <AssistIcon class="nb-assist__mark" :size="15" />
      <span v-if="fix" class="nb-assist__title">{{ title }}</span>
      <input
        v-else
        ref="input"
        v-model="prompt"
        class="nb-assist__input"
        :placeholder="placeholder"
        :disabled="asking"
        aria-label="What the code should do"
        @keydown.enter.prevent="submit"
      />
      <span v-if="assist.file" class="nb-assist__file" :title="assist.file">
        {{ fileName }}
        <button v-if="!asking" class="nb-assist__x" aria-label="Leave the file out" @click="emit('clear-file')">✕</button>
      </span>
      <button v-if="asking" class="nb-assist__btn" @click="emit('stop')">Stop</button>
      <template v-else-if="refining">
        <button
          class="nb-assist__btn nb-assist__btn--go"
          :disabled="!prompt.trim()"
          title="The assistant changes its proposal as asked, in the same conversation: it sees the cell and, once it has run, what it showed"
          @click="submit"
        >
          Refine
        </button>
        <button class="nb-assist__btn" title="A new request on this cell, outside this conversation" @click="emit('restart')">Start over</button>
      </template>
      <button
        v-else-if="suggests"
        class="nb-assist__btn nb-assist__btn--go"
        title="The assistant proposes a next step from the cells above and the session's data"
        @click="submit"
      >
        Suggest
      </button>
      <template v-else-if="!fix">
        <button
          v-if="steers"
          class="nb-assist__btn"
          title="The assistant proposes a next step from the cells above and the session's data, with this in mind"
          @click="emit('suggest', prompt.trim())"
        >
          Suggest
        </button>
        <button class="nb-assist__btn nb-assist__btn--go" :disabled="!prompt.trim()" @click="submit">Write</button>
      </template>
      <button v-else-if="assist.state === 'error' || assist.state === 'idle'" class="nb-assist__btn nb-assist__btn--go" @click="submit">Try again</button>
      <button class="nb-assist__x" title="Close (Esc)" aria-label="Close" @click="emit('discard')">✕</button>
    </div>

    <!-- The conversation a follow-up continues: what was asked in it. -->
    <p v-if="refining && assist.asked && assist.asked.length" class="nb-assist__asked" :title="assist.asked.join(' → ')">
      Continuing: {{ assist.asked.join(" → ") }}
    </p>

    <!-- What the assistant did: each look or run as it happens. -->
    <ul v-if="assist.steps && assist.steps.length" class="nb-assist__steps">
      <li v-for="s in assist.steps" :key="s.id" :class="`is-${s.state}`" :title="s.detail || ''">
        <span class="nb-assist__state" aria-hidden="true">{{ s.state === "running" ? "…" : s.state === "failed" ? "✕" : "✓" }}</span>
        {{ stepLabel(s) }}
      </li>
    </ul>
    <p v-if="asking && assist.note" class="nb-assist__note nb-assist__note--model">{{ assist.note }}</p>
    <p v-if="asking && !code && !(assist.steps && assist.steps.length) && !fix" class="nb-assist__note">Writing…</p>

    <p v-if="code && !asking && assist.summary" class="nb-assist__summary">{{ assist.summary }}</p>
    <!-- The single-shot assistant's code streams in; the agent's comes whole.
         While Fix and run works, its earlier proposal is hidden. -->
    <pre v-if="code && !assist.running" class="nb-assist__code">{{ code }}</pre>
    <p v-if="assist.error" class="nb-assist__error">{{ assist.error }}</p>
    <!-- No AI budget left: a notice, not an error. -->
    <p v-if="assist.state === 'budget'" class="nb-assist__budget">{{ assist.notice }}</p>

    <!-- A question's answer: words, to keep as a Markdown cell or turn into code. -->
    <div v-if="assist.state === 'done' && assist.answer" class="nb-assist__answer markdown-body" v-html="answerHtml" />
    <div v-if="assist.state === 'done' && assist.answer" class="nb-assist__actions">
      <button class="nb-assist__btn nb-assist__btn--go" @click="emit('insert-answer')">Insert as Markdown cell</button>
      <button class="nb-assist__btn" @click="emit('answer-to-code')">Write code for this</button>
      <button class="nb-assist__btn" @click="emit('discard')">Close</button>
    </div>

    <div v-if="assist.state === 'done' && code && fix" class="nb-assist__actions">
      <button
        class="nb-assist__btn nb-assist__btn--go"
        title="Run the fix; if it still fails, the assistant looks at why and tries again (a few times)"
        @click="emit('accept-run')"
      >
        Fix and run
      </button>
      <button class="nb-assist__btn" @click="emit('accept')">Use fix</button>
      <button class="nb-assist__btn" @click="emit('discard')">Discard</button>
      <span class="nb-assist__note">Written by AI: check it before you run it.</span>
    </div>
    <div v-else-if="assist.state === 'failed' && code" class="nb-assist__actions">
      <button class="nb-assist__btn nb-assist__btn--go" @click="emit('accept')">Use this attempt</button>
      <button class="nb-assist__btn" @click="emit('discard')">Discard</button>
    </div>
    <!-- Written code: its main action puts it in and runs it. A suggestion for
         a cell with code is its next step, so it goes below. -->
    <!-- A reply stopped part-way can be used, never run in one click. -->
    <div v-else-if="assist.state === 'done' && code && assist.partial" class="nb-assist__actions">
      <button class="nb-assist__btn nb-assist__btn--go" @click="emit(cellHasCode ? 'insert-below' : 'accept')">{{ cellHasCode ? "Insert below" : "Use" }}</button>
      <button class="nb-assist__btn" @click="emit('discard')">Discard</button>
      <span class="nb-assist__note">Stopped part-way: read it before you run it.</span>
    </div>
    <div v-else-if="assist.state === 'done' && code && assist.mode === 'suggest' && cellHasCode" class="nb-assist__actions">
      <button class="nb-assist__btn nb-assist__btn--go" @click="emit('insert-below-run')">Insert below and run</button>
      <button class="nb-assist__btn" @click="emit('insert-below')">Insert below</button>
      <button class="nb-assist__btn" @click="emit('discard')">Discard</button>
      <span class="nb-assist__note">Written by AI from your session's data: read it before you run it.</span>
    </div>
    <div v-else-if="assist.state === 'done' && code" class="nb-assist__actions">
      <button class="nb-assist__btn nb-assist__btn--go" @click="emit('use-run')">{{ cellHasCode ? "Replace and run" : "Use and run" }}</button>
      <button class="nb-assist__btn" @click="emit('insert-below')">Insert below</button>
      <button class="nb-assist__btn" @click="emit('discard')">Discard</button>
      <span class="nb-assist__note">Written by AI: read it before you run it.</span>
    </div>

    <!-- What it used: tokens, and the cost as the run's governor prices it. -->
    <p v-if="usage" class="nb-assist__usage" title="Tokens as the node's LLM governor counted them; the cost is the run's AI spend before and after this request.">{{ usage }}</p>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

// The assistant's colour, on every AI action.
$assist: theme.$status_purple;
$assist_tint: #f0ebfb;

.nb-assist {
  // Below the cell's toolbar, which sits over the cell's top edge.
  margin: 22px 0 6px;

  // A fix, under the cell's error: nothing above it to clear.
  .nb-outputs + & {
    margin-top: 6px;
  }
  padding: 6px 8px;
  border: 1px solid theme.$gray_2;
  border-left: 2px solid $assist;
  border-radius: 4px;
  background: theme.$white;
  font-size: 12px;
}
.nb-assist__ask {
  display: flex;
  align-items: center;
  gap: 6px;
}
.nb-assist__mark {
  color: $assist;
}
.nb-assist__title {
  flex: 1;
  color: theme.$gray_6;
}
.nb-assist__input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  color: theme.$gray_6;
}
.nb-assist__file {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 200px;
  overflow: hidden;
  padding: 0 4px 0 8px;
  border-radius: 10px;
  background: $assist_tint;
  color: $assist;
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.nb-assist__btn {
  border: 1px solid theme.$gray_3;
  border-radius: 3px;
  background: theme.$white;
  padding: 1px 8px;
  font: inherit;
  color: theme.$gray_5;
  cursor: pointer;
}
.nb-assist__btn--go {
  border-color: $assist;
  color: $assist;
}
.nb-assist__btn--go:hover:not(:disabled) {
  background: $assist_tint;
}
.nb-assist__btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.nb-assist__x {
  border: none;
  background: none;
  padding: 0 3px;
  font-size: 10px;
  color: theme.$gray_4;
  cursor: pointer;
}
.nb-assist__code {
  margin: 6px 0 0;
  padding: 6px 8px;
  max-height: 320px;
  overflow: auto;
  border-radius: 3px;
  background: theme.$gray_0;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: theme.$gray_6;
  white-space: pre;
}
.nb-assist__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}
.nb-assist__note {
  margin: 4px 0 0;
  color: theme.$gray_4;
  font-size: 11px;
}
.nb-assist__actions .nb-assist__note {
  margin: 0 0 0 4px;
}
.nb-assist__steps {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
  font-size: 11px;
  color: theme.$gray_5;

  li {
    display: flex;
    gap: 6px;
    padding: 1px 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  li.is-failed {
    color: theme.$gray_4;
    text-decoration: line-through;
  }
}
.nb-assist__state {
  width: 10px;
  color: $assist;
}
.nb-assist__note--model {
  font-style: italic;
}
.nb-assist__asked {
  margin: 4px 0 0;
  color: theme.$gray_4;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nb-assist__summary {
  margin: 6px 0 0;
  color: theme.$gray_6;
}
.nb-assist__usage {
  margin: 6px 0 0;
  font-size: 10px;
  color: theme.$gray_4;
}
.nb-assist__answer {
  margin: 6px 0 0;
  padding: 6px 10px;
  max-height: 360px;
  overflow: auto;
  border-radius: 3px;
  background: theme.$gray_1;
  font-size: 13px;
  line-height: 1.5;
  color: theme.$gray_6;

  :deep(p) {
    margin: 0 0 6px;
  }
  :deep(ul),
  :deep(ol) {
    margin: 0 0 6px;
    padding-left: 20px;
  }
}
.nb-assist__budget {
  margin: 6px 0 0;
  padding: 6px 8px;
  background: theme.$gray_1;
  color: theme.$gray_5;
}
.nb-assist__error {
  margin: 6px 0 0;
  color: theme.$red_2;
}
</style>
