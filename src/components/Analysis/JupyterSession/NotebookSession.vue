<script setup>
// Dedicated full-page interactive notebook for a workflow run. Opened in its own
// tab from the run detail view (or linked directly). It owns only page chrome —
// the live kernel connect/execute/close lifecycle lives in JupyterSession.vue +
// the useJupyterSession composable. Because this can load in a fresh tab where
// the analysis store isn't populated, it relies only on the route params.
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import JupyterSession from "./JupyterSession.vue";

const route = useRoute();
const router = useRouter();

const runId = computed(() => route.params.runId || "");
const orgId = computed(() => route.params.orgId || "");

const backToRun = () => {
  if (!runId.value) return;
  router.push({ name: "run-detail", params: { orgId: orgId.value, runId: runId.value } });
};
</script>

<template>
  <div class="notebook-page">
    <header class="notebook-page__header">
      <div class="notebook-page__title">
        <button class="notebook-page__back" type="button" @click="backToRun">← Back to run</button>
        <h1>Interactive Notebook</h1>
        <span class="notebook-page__run">run {{ runId }}</span>
      </div>
    </header>

    <main class="notebook-page__body">
      <JupyterSession v-if="runId" :run-id="runId" />
      <p v-else class="notebook-page__error">No run specified.</p>
    </main>
  </div>
</template>

<style scoped>
.notebook-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fff;
}
.notebook-page__header {
  flex: 0 0 auto;
  border-bottom: 1px solid #e0e0e0;
  padding: 12px 20px;
}
.notebook-page__title {
  display: flex;
  align-items: baseline;
  gap: 16px;
}
.notebook-page__title h1 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}
.notebook-page__back {
  border: none;
  background: none;
  color: #295eff;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
}
.notebook-page__run {
  font-size: 12px;
  color: #888;
  font-family: ui-monospace, Menlo, monospace;
}
.notebook-page__body {
  flex: 1 1 auto;
  overflow: auto;
}
.notebook-page__error {
  padding: 20px;
  color: #b42318;
}
</style>
