<script setup>
// The page a run's web app session opens through: an interactive step whose
// app serves its own page (app.yml's sessionType webapp). The run page opens
// it in a new tab; it waits for the session's task to come up, then hands the
// tab over to the app, on the session's own host. Unlike a notebook
// (NotebookSession.vue) nothing of the session is shown inside Pennsieve.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import BfPage from "../../layout/BfPage/BfPage.vue";
import BfButton from "../../shared/bf-button/BfButton.vue";
import { fetchConnection } from "@/composables/useJupyterSession";
import { openWebAppSession } from "../RunMonitor/sessionKinds";

const props = defineProps({
  // Passed by the router; a run outside any workspace has no orgId.
  orgId: { type: String, default: "" },
  runId: { type: String, default: "" },
});

const route = useRoute();
const router = useRouter();
const resolvedRunId = computed(() => props.runId || route.params.runId || "");
const runRoute = computed(() =>
  props.orgId || route.params.orgId
    ? { name: "run-detail", params: { orgId: props.orgId || route.params.orgId, runId: resolvedRunId.value } }
    : { name: "my-run-detail", params: { runId: resolvedRunId.value } }
);

const error = ref("");
// Leaving the page while it waits must not pull the tab to the app later.
let left = false;

// Back from the app can bring this page back exactly as it was left, still
// saying it is opening. Load the address it was left with instead (the run).
function onPageShow(event) {
  if (event.persisted) window.location.reload();
}
onMounted(() => window.addEventListener("pageshow", onPageShow));
onBeforeUnmount(() => {
  left = true;
  window.removeEventListener("pageshow", onPageShow);
});

async function open() {
  error.value = "";
  if (!resolvedRunId.value) {
    error.value = "No run specified.";
    return;
  }
  try {
    const conn = await fetchConnection(resolvedRunId.value, { what: "app" });
    if (left) return;
    // The app opens with a form post, which adds to this tab's history. Leave
    // the run's address behind it, so Back from the app lands on the run
    // instead of here, where it would open the app again.
    window.history.replaceState(null, "", router.resolve(runRoute.value).href);
    openWebAppSession(conn);
  } catch (e) {
    if (!left) error.value = e?.message || "Could not open the session.";
  }
}
onMounted(open);
</script>

<template>
  <bf-page>
    <div class="webapp-stage">
      <div v-if="error" class="webapp-stage__card" role="alert">
        <h2>The app didn't open</h2>
        <p class="webapp-stage__error">{{ error }}</p>
        <div class="webapp-stage__actions">
          <router-link :to="runRoute" class="webapp-stage__back">Back to the run</router-link>
          <bf-button class="primary" @click="open">Try again</bf-button>
        </div>
      </div>
      <div v-else class="webapp-stage__card" role="status">
        <span class="webapp-stage__spinner" />
        <h2>Opening the app…</h2>
        <p>
          The workflow is paused on this step. Its app opens here as soon as it
          has started, which can take a minute or two.
        </p>
      </div>
    </div>
  </bf-page>
</template>

<style scoped>
.webapp-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}
.webapp-stage__card {
  max-width: 420px;
  padding: 24px;
  text-align: center;
  color: #4d4d4d;
  line-height: 1.5;
}
.webapp-stage__card h2 {
  margin: 0 0 8px;
  font-size: 18px;
  color: #011f5b;
}
.webapp-stage__error {
  color: #c14d49;
}
.webapp-stage__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 16px;
}
.webapp-stage__back {
  font-size: 13px;
}
.webapp-stage__spinner {
  display: inline-block;
  width: 28px;
  height: 28px;
  margin-bottom: 12px;
  border: 3px solid #dde3ea;
  border-top-color: #011f5b;
  border-radius: 50%;
  animation: webapp-stage-spin 0.9s linear infinite;
}
@keyframes webapp-stage-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
