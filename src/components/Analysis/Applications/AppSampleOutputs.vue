<script setup>
/*
  The app page's Workflow samples tab: the sample output PDFs (a summary of
  one run each) of the workflows the app is in, opened in the viewer. The
  app's own sample output is above, on the page (AppSampleCard).
*/
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "vuex";
import IconPDF from "../../icons/IconPDF.vue";
import SampleOutputViewer from "../Workflows/SampleOutputViewer.vue";
import { exampleVersion, PDF_URL_FRESH_MS } from "../Workflows/runExamples";

const props = defineProps({
  entries: { type: Array, default: () => [] },
  // Workflows with the app that weren't looked at (beyond the cap).
  more: { type: Number, default: 0 },
  appName: { type: String, default: "" },
});

const store = useStore();
const route = useRoute();
const workflowRoute = (uuid) => ({
  name: route.params.orgId ? "workflow-detail" : "my-workflow-detail",
  params: { ...(route.params.orgId ? { orgId: route.params.orgId } : {}), uuid },
});

const viewer = ref({ open: false, source: null, name: "", version: null, subtitle: "" });
const runLabel = (example) => example.runName || example.runId || "";
const meta = (example) => {
  const parts = [`Version ${exampleVersion(example)}`, `run ${runLabel(example)}`];
  if (example.pages) parts.push(`${example.pages} page${example.pages === 1 ? "" : "s"}`);
  return parts.join(" · ");
};

const open = (entry) => {
  const ex = entry.example;
  const fresh = ex.pdfUrl && Date.now() - (ex.fetchedAt || 0) < PDF_URL_FRESH_MS ? ex.pdfUrl : null;
  let first = true;
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
    subtitle: meta(ex),
  };
};
</script>

<template>
  <div class="app-samples">
    <p class="app-samples__intro">
      Sample outputs of workflows that use {{ appName || "this app" }}: a PDF summary of one run of each.
    </p>
    <ul class="app-samples__list">
      <li v-for="entry in entries" :key="entry.workflow.uuid" class="app-sample">
        <div class="app-sample__text">
          <router-link :to="workflowRoute(entry.workflow.uuid)" class="app-sample__name">{{ entry.workflow.name }}</router-link>
          <span class="app-sample__meta">{{ meta(entry.example) }}</span>
        </div>
        <button type="button" class="app-sample__open" @click="open(entry)">
          <IconPDF :width="14" :height="14" color="currentColor" />
          View PDF
        </button>
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
  gap: 8px;
}
.app-sample {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  padding: 10px 16px;
  background: theme.$white;
}
.app-sample__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
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
