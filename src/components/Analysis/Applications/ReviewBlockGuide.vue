<script setup>
/*
  For the owner of an app whose release declares no test inputs (app.yml has
  no review block): a warning line on the version, and a dialog with why
  that leaves the release report without figures or results and a review
  block to paste, built from the app's own inputs and parameters, for the
  way of declaring test inputs the owner picks (reviewGuide.js).
*/
import { computed, ref } from "vue";
import EventBus from "../../../utils/event-bus";
import { REVIEW_GUIDE_URL, REVIEW_SOURCES, reviewSnippet, reviewSteps } from "./reviewGuide";

const props = defineProps({
  // The app's parsed app.yml ports and parameters ([] when it has none).
  inputs: { type: Array, default: () => [] },
  parameters: { type: Array, default: () => [] },
  tag: { type: String, default: "" },
});

const open = ref(false);
const kind = ref("generate");
const source = computed(() => REVIEW_SOURCES.find((s) => s.id === kind.value));
const snippet = computed(() => reviewSnippet(kind.value, { inputs: props.inputs, parameters: props.parameters }));
const steps = computed(() => reviewSteps(kind.value));
const noPorts = computed(() => !props.inputs.some((p) => p?.name));

const copy = async () => {
  try {
    await navigator.clipboard.writeText(snippet.value);
    EventBus.$emit("toast", { detail: { type: "info", msg: "Review block copied" } });
  } catch {
    EventBus.$emit("toast", { detail: { type: "error", msg: "Could not copy; select the text instead" } });
  }
};
</script>

<template>
  <button type="button" class="review-warning" title="Without test inputs the release report has no figures or results" @click="open = true">
    <span class="review-warning__icon" aria-hidden="true">!</span>
    <span class="review-warning__text">No test inputs declared</span>
    <span class="review-warning__sep" aria-hidden="true">·</span>
    <span class="review-warning__open">Add test inputs ›</span>
  </button>

  <el-dialog
    v-model="open"
    :title="`Add test inputs${tag ? ` for releases after ${tag}` : ''}`"
    width="min(920px, 96vw)"
    append-to-body
    class="review-guide-dialog"
  >
    <div class="review-guide">
      <div class="review-guide__text">
        <p class="review-guide__why">
          {{ tag ? `Release ${tag}` : "This release" }} declares no test inputs: app.yml has no
          <code>review</code> block. Its release report describes the app but shows no figures or results.
          Declare a few small test inputs, and Pennsieve runs each release on them and puts what the app
          produced in its report.
        </p>
        <p v-if="noPorts" class="review-guide__warn">
          app.yml declares no input ports either. Add them under <code>inputs:</code> first (a name and
          <code>mediaTypes</code> for each), so the test inputs can be checked against them.
        </p>
        <div class="review-guide__label">Where the test inputs come from</div>
        <div class="review-guide__sources" role="radiogroup" aria-label="Where the test inputs come from">
          <button
            v-for="s in REVIEW_SOURCES"
            :key="s.id"
            type="button"
            role="radio"
            :aria-checked="kind === s.id"
            class="review-guide__source"
            :class="{ 'is-active': kind === s.id }"
            @click="kind = s.id"
          >
            {{ s.label }}
          </button>
        </div>
        <p class="review-guide__when">{{ source.when }}</p>
        <ol class="review-guide__steps">
          <li v-for="(step, i) in steps" :key="i">{{ step }}</li>
        </ol>
      </div>
      <div class="review-guide__code">
        <div class="review-guide__code-head">
          <span class="review-guide__label">Add to the end of app.yml</span>
          <button type="button" class="review-guide__copy" @click="copy">Copy</button>
        </div>
        <pre>{{ snippet }}</pre>
        <p class="review-guide__more">
          Fill in the &lt;placeholders&gt;. Every field, and how the platform checks the block:
          <a :href="REVIEW_GUIDE_URL" target="_blank" rel="noopener">Review inputs in app.yml</a>.
        </p>
      </div>
    </div>
    <template #footer>
      <bf-button @click="open = false">Close</bf-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.review-warning {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  color: theme.$gray_5;
  text-align: left;
  cursor: pointer;

  &:hover .review-warning__open {
    text-decoration: underline;
  }
}
.review-warning__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border-radius: 50%;
  background: theme.$yellow_2;
  color: theme.$white;
  font-size: 10px;
  font-weight: 700;
}
.review-warning__sep {
  color: theme.$gray_4;
}
.review-warning__open {
  color: theme.$purple_2;
  font-weight: 600;
  white-space: nowrap;
}

.review-guide {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 24px;
  font-size: 14px;
  line-height: 1.5;
  color: theme.$gray_6;

  @media (max-width: 760px) {
    grid-template-columns: minmax(0, 1fr);
  }
  p {
    margin: 0 0 12px;
  }
  code {
    font-size: 13px;
  }
}
.review-guide__warn {
  color: theme.$red_2;
}
.review-guide__label {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_5;
}
.review-guide__sources {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.review-guide__source {
  padding: 4px 12px;
  border: 1px solid theme.$gray_3;
  border-radius: 3px;
  background: theme.$white;
  color: theme.$gray_6;
  font: inherit;
  font-size: 13px;
  cursor: pointer;

  &.is-active {
    border-color: theme.$purple_3;
    background: theme.$purple_3;
    color: theme.$white;
  }
}
.review-guide__when {
  color: theme.$gray_5;
}
.review-guide__steps {
  margin: 0;
  padding-left: 20px;

  li {
    margin-bottom: 6px;
  }
}
.review-guide__code {
  min-width: 0;

  pre {
    margin: 0 0 10px;
    padding: 12px 14px;
    overflow-x: auto;
    border: 1px solid theme.$gray_2;
    border-radius: 3px;
    background: theme.$gray_1;
    font-size: 12.5px;
    line-height: 1.5;
  }
}
.review-guide__code-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;

  .review-guide__label {
    margin-bottom: 0;
  }
}
.review-guide__copy {
  padding: 2px 12px;
  border: 1px solid theme.$gray_3;
  border-radius: 3px;
  background: theme.$white;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_2;
  }
}
.review-guide__more {
  color: theme.$gray_5;
  font-size: 12px;
}
</style>
