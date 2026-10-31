<script setup>
/*
  The app's own sample output, at the top of its page: a PDF summary of one
  of its app runs (its inputs and results), opened in the viewer. open() is
  exposed for the header's PDF button.
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
const open = () => {
  viewerOpen.value = true;
};
defineExpose({ open });

const name = computed(() => props.appName || props.sample.app?.name || "this app");
const version = computed(() => [props.sample.app?.tag, props.sample.app?.variant].filter(Boolean).join(" · "));
const runLabel = computed(() => props.sample.runName || props.sample.runId || "");
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
    <button type="button" class="app-sample-card__icon" aria-label="View the sample output PDF" @click="open">
      <IconPDF :width="28" :height="28" color="currentColor" />
    </button>
    <div class="app-sample-card__text">
      <div class="app-sample-card__title">Sample output</div>
      <p class="app-sample-card__lede">
        A PDF summary of one run of {{ name }}: what went in, what came out, and its figures, copied from the run.
      </p>
      <p class="app-sample-card__meta">{{ meta }}</p>
    </div>
    <bf-button class="primary app-sample-card__btn" @click="open">View sample output</bf-button>

    <SampleOutputViewer
      v-model="viewerOpen"
      :source="source"
      :workflow-name="name"
      :subtitle="meta"
    />
  </section>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.app-sample-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  margin-bottom: 16px;
  border: 1px solid theme.$purple_1;
  border-left: 4px solid theme.$purple_3;
  border-radius: 6px;
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
}
.app-sample-card__text {
  flex: 1;
  min-width: 0;
}
.app-sample-card__title {
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
.app-sample-card__lede {
  margin: 2px 0 0;
  font-size: 13px;
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
