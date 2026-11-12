<script setup>
/*
  For the owner of an app whose release declares no test inputs (app.yml has
  no review block): why that leaves the release report without figures or
  results, and a review block to paste, built from the app's own inputs and
  parameters, for the way of declaring test inputs the owner picks
  (reviewGuide.js).
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
  <div class="review-guide" :class="{ 'is-open': open }">
    <button type="button" class="review-guide__toggle" :aria-expanded="open" @click="open = !open">
      <span class="review-guide__title">Add test inputs for a full release report</span>
      <span class="review-guide__chevron" aria-hidden="true">{{ open ? "▾" : "▸" }}</span>
    </button>
    <div v-if="open" class="review-guide__body">
      <p class="review-guide__why">
        {{ tag ? `Release ${tag}` : "This release" }} declares no test inputs: app.yml has no <code>review</code> block.
        Its release report can describe the app, but shows no figures or results. Declare small test inputs and
        Pennsieve runs each release on them and puts what the app produced in its report. Only you see this.
      </p>
      <p v-if="noPorts" class="review-guide__warn">
        app.yml declares no input ports either. Add them under <code>inputs:</code> first (a name and
        <code>mediaTypes</code> for each), so the test inputs can be checked against them.
      </p>
      <div class="review-guide__sources" role="radiogroup" aria-label="How to declare test inputs">
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
      <div class="review-guide__code">
        <pre>{{ snippet }}</pre>
        <button type="button" class="review-guide__copy" @click="copy">Copy</button>
      </div>
      <p class="review-guide__more">
        Placeholders are in &lt;angle brackets&gt;. Every field, and how the platform checks the block:
        <a :href="REVIEW_GUIDE_URL" target="_blank" rel="noopener">Review inputs in app.yml</a>.
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.review-guide {
  margin-top: 8px;
  border: 1px solid theme.$yellow_2;
  border-left-width: 4px;
  background: theme.$yellow_tint;
  border-radius: 4px;
}
.review-guide__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  border: 0;
  background: transparent;
  color: theme.$gray_6;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.review-guide__title {
  font-size: 13px;
  font-weight: 600;
}
.review-guide__chevron {
  color: theme.$gray_5;
}
.review-guide__body {
  padding: 0 12px 12px;
  font-size: 13px;
  line-height: 1.5;
  color: theme.$gray_6;

  p {
    margin: 0 0 8px;
  }
  code {
    font-size: 12px;
  }
}
.review-guide__warn {
  color: theme.$red_2;
}
.review-guide__sources {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 4px 0 6px;
}
.review-guide__source {
  padding: 4px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 14px;
  background: theme.$white;
  color: theme.$gray_6;
  font: inherit;
  font-size: 12px;
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
  margin: 0 0 8px;
  padding-left: 18px;

  li {
    margin-bottom: 2px;
  }
}
.review-guide__code {
  position: relative;
  margin-bottom: 8px;

  pre {
    margin: 0;
    padding: 10px 12px;
    overflow-x: auto;
    border: 1px solid theme.$gray_2;
    border-radius: 4px;
    background: theme.$white;
    font-size: 12px;
    line-height: 1.45;
  }
}
.review-guide__copy {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 2px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
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
