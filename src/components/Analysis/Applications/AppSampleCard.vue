<script setup>
/*
  The app's sample document, at the top of its page, opened in the viewer:
  the one the release pipeline made for its newest version (sample.pipeline,
  releaseSample.js; with the first page as a thumbnail), or the owner-set
  summary of one of its runs (useAppSample). open() is exposed for the
  header's PDF button.
*/
import { computed, ref } from "vue";
import IconPDF from "../../icons/IconPDF.vue";
import SampleOutputViewer from "../Workflows/SampleOutputViewer.vue";

const props = defineProps({
  sample: { type: Object, required: true },
  appName: { type: String, default: "" },
  // A fresh signed link (useAppSample's pdfSource).
  source: { type: Function, required: true },
});

const viewerOpen = ref(false);
// A thumbnail that doesn't load (not served yet) leaves the icon.
const previewBroken = ref(false);
const preview = computed(() => (previewBroken.value ? "" : props.sample.previewUrl || ""));
const open = () => {
  viewerOpen.value = true;
};
defineExpose({ open });

const name = computed(() => props.appName || props.sample.app?.name || "this app");
const pipeline = computed(() => Boolean(props.sample.pipeline));
const version = computed(() => [props.sample.app?.tag, props.sample.app?.variant].filter(Boolean).join(" · "));
const runLabel = computed(() => (pipeline.value ? "" : props.sample.runName || props.sample.runId || ""));
const lede = computed(() =>
  pipeline.value
    ? `Pennsieve ran ${name.value} ${version.value} on its test inputs at release: the inputs, results and figures, as a PDF.`
    : `A PDF summary of one run of ${name.value}: what went in, what came out, and its figures, copied from the run.`
);
const made = computed(() => {
  const d = new Date(props.sample.createdAt);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
});
const meta = computed(() =>
  [
    version.value,
    runLabel.value && `run ${runLabel.value}`,
    props.sample.pages && `${props.sample.pages} page${props.sample.pages === 1 ? "" : "s"}`,
    made.value,
  ]
    .filter(Boolean)
    .join(" · ")
);
</script>

<template>
  <section class="app-sample-card" aria-label="Sample output">
    <button
      type="button"
      class="app-sample-card__icon"
      :class="{ 'app-sample-card__icon--preview': preview }"
      :aria-label="pipeline ? 'View the release report' : 'View the sample output PDF'"
      @click="open"
    >
      <img v-if="preview" :src="preview" alt="" class="app-sample-card__preview" @error="previewBroken = true" />
      <IconPDF v-else :width="28" :height="28" color="currentColor" />
    </button>
    <div class="app-sample-card__text">
      <div class="app-sample-card__title">{{ pipeline ? "Release report" : "Sample output" }}</div>
      <p class="app-sample-card__lede">{{ lede }}</p>
      <p class="app-sample-card__meta">{{ meta }}</p>
    </div>
    <bf-button class="primary app-sample-card__btn" @click="open">{{ pipeline ? "View report" : "View sample output" }}</bf-button>

    <SampleOutputViewer
      v-model="viewerOpen"
      :source="source"
      :workflow-name="name"
      :subtitle="meta"
      :kind="pipeline ? 'release report' : 'sample output'"
    />
  </section>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.app-sample-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  margin-bottom: 16px;
  border: 1px solid theme.$purple_1;
  border-left: 4px solid theme.$purple_3;
  background: theme.$white;
}
.app-sample-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border: 0;
  border-radius: 6px;
  background: theme.$gray_1;
  color: theme.$purple_3;
  cursor: pointer;

  &:hover {
    background: theme.$gray_2;
  }

  // The document's first page, as tall as the card's text
  &--preview {
    width: auto;
    height: 60px;
    padding: 0;
    overflow: hidden;
    border: 1px solid theme.$gray_2;
    background: theme.$white;

    &:hover {
      border-color: theme.$purple_2;
    }
  }
}
.app-sample-card__preview {
  display: block;
  height: 100%;
  width: auto;
  max-width: 64px;
  object-fit: cover;
  object-position: top;
}
.app-sample-card__text {
  flex: 1;
  min-width: 0;
}
.app-sample-card__title {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.app-sample-card__lede {
  margin: 1px 0 0;
  font-size: 12px;
  color: theme.$gray_6;
}
.app-sample-card__meta {
  margin: 2px 0 0;
  font-size: 12px;
  color: theme.$gray_5;
}
.app-sample-card__btn {
  flex-shrink: 0;
}
</style>
