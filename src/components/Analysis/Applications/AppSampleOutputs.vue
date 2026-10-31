<script setup>
/*
  The app page's Sample outputs tab: workflows that run the app and have a
  sample output (a PDF summary of one run), each with what its PDF shows of
  the app's step and a button opening the PDF at those pages.
*/
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "vuex";
import IconPDF from "../../icons/IconPDF.vue";
import SampleOutputViewer from "../Workflows/SampleOutputViewer.vue";
import { exampleVersion, PDF_URL_FRESH_MS } from "../Workflows/runExamples";
import { firstPage, pagesText, stepSummary } from "./appSamples";

const props = defineProps({
  entries: { type: Array, default: () => [] },
  // Workflows using the app that weren't looked at (beyond the cap).
  more: { type: Number, default: 0 },
  appName: { type: String, default: "" },
});

const store = useStore();
const route = useRoute();
const workflowRoute = (uuid) => ({
  name: route.params.orgId ? "workflow-detail" : "my-workflow-detail",
  params: { ...(route.params.orgId ? { orgId: route.params.orgId } : {}), uuid },
});

const viewer = ref({ open: false, source: null, name: "", version: null, subtitle: "", page: null });

const runLabel = (example) => example.runName || example.runId || "";

const open = (entry, step = null) => {
  const ex = entry.example;
  const fresh = ex.pdfUrl && Date.now() - (ex.fetchedAt || 0) < PDF_URL_FRESH_MS ? ex.pdfUrl : null;
  let first = true;
  const parts = [`Version ${exampleVersion(ex)}`, `run ${runLabel(ex)}`];
  if (step) parts.unshift(`Step ${step.step} (${step.app || props.appName}${step.version ? ` ${step.version}` : ""}) on ${pagesText(step.pages)}`);
  viewer.value = {
    open: true,
    source: async () => {
      if (first && fresh) {
        first = false;
        return fresh;
      }
      first = false;
      const again = await store.dispatch("analysisModule/fetchWorkflowExample", entry.workflow.uuid);
      if (again) entry.example = { ...again, fetchedAt: Date.now() };
      return again?.pdfUrl || null;
    },
    name: entry.workflow.name,
    version: exampleVersion(ex),
    subtitle: parts.join(" · "),
    page: step ? firstPage(step) : null,
  };
};

const intro = computed(
  () =>
    `PDF summaries of workflow runs that used ${props.appName || "this app"}. ` +
    "Each lists the pages showing what the app's step produced."
);
</script>

<template>
  <div class="app-samples">
    <p class="app-samples__intro">{{ intro }}</p>
    <ul class="app-samples__list">
      <li v-for="entry in entries" :key="entry.workflow.uuid" class="app-sample">
        <div class="app-sample__head">
          <router-link :to="workflowRoute(entry.workflow.uuid)" class="app-sample__name">{{ entry.workflow.name }}</router-link>
          <span class="app-sample__meta">
            Sample output of version {{ exampleVersion(entry.example) }} · run {{ runLabel(entry.example) }}
            <template v-if="entry.example.pages"> · {{ entry.example.pages }} pages</template>
          </span>
        </div>

        <template v-if="entry.indexed">
          <div v-for="step in entry.steps" :key="step.step" class="app-sample__step">
            <div class="app-sample__step-text">
              <span class="app-sample__step-name">Step {{ step.step }}</span>
              <span v-if="step.version" class="app-sample__version">{{ step.version }}</span>
              <span class="app-sample__summary" :class="{ 'is-empty': !firstPage(step) }">{{ stepSummary(step) }}</span>
            </div>
            <button v-if="firstPage(step)" type="button" class="app-sample__open" @click="open(entry, step)">
              <IconPDF :width="14" :height="14" color="currentColor" />
              View {{ pagesText(step.pages) }}
            </button>
          </div>
        </template>
        <div v-else class="app-sample__step">
          <span class="app-sample__summary is-empty">
            This sample output was made before PDFs recorded which pages each step produced.
          </span>
          <button type="button" class="app-sample__open" @click="open(entry)">
            <IconPDF :width="14" :height="14" color="currentColor" />
            View PDF
          </button>
        </div>
      </li>
    </ul>
    <p v-if="more" class="app-samples__more">
      {{ more }} more workflow{{ more === 1 ? "" : "s" }} use this app; open them from the workflow library.
    </p>

    <SampleOutputViewer
      v-model="viewer.open"
      :source="viewer.source"
      :workflow-name="viewer.name"
      :version="viewer.version"
      :subtitle="viewer.subtitle"
      :initial-page="viewer.page"
    />
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.app-samples {
  padding: 16px 24px 24px;
}
.app-samples__intro {
  margin: 0 0 16px;
  font-size: 13px;
  color: theme.$gray_5;
}
.app-samples__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.app-sample {
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  padding: 12px 16px;
  background: theme.$white;
}
.app-sample__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  margin-bottom: 8px;
}
.app-sample__name {
  font-weight: 600;
  color: theme.$gray_6;
  text-decoration: none;

  &:hover {
    color: theme.$purple_3;
    text-decoration: underline;
  }
}
.app-sample__meta {
  font-size: 12px;
  color: theme.$gray_5;
}
.app-sample__step {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-top: 1px solid theme.$gray_1;
}
.app-sample__step-text {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  min-width: 0;
  font-size: 13px;
}
.app-sample__step-name {
  font-weight: 500;
  color: theme.$gray_6;
}
.app-sample__version {
  font-family: monospace;
  font-size: 12px;
  color: theme.$gray_5;
}
.app-sample__summary {
  color: theme.$gray_6;

  &.is-empty {
    color: theme.$gray_5;
    font-size: 12px;
  }
}
.app-sample__open {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 4px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
}
.app-samples__more {
  margin: 12px 0 0;
  font-size: 12px;
  color: theme.$gray_5;
}
</style>
