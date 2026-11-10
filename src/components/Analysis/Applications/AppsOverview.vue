<script setup>
// The Apps tab: the applications workflow steps run. No views; the tab row
// has one action, + New App, and a menu button beside it with the other
// way to add one and the repositories already tracked (the
// search and Sort are the grid's, over its cards, as on the Workflows
// Library): a new app from Pennsieve's template, a guided wizard
// (PublishAppDialog: describe it, the repository from the template, the
// GitHub App, the app.yml, the release); or a repository the user already
// has (AddRepositoryDialog: access, destinations, sharing, a release). The
// repositories already tracked are managed on the user's Code page.
import { onBeforeUnmount, ref } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import BfButton from "../../shared/bf-button/BfButton.vue";
import ApplicationsGrid from "./ApplicationsGrid.vue";
import AnalysisViewBar from "../AnalysisViewBar.vue";
import PublishAppDialog from "./PublishAppDialog.vue";
import AddRepositoryDialog from "./AddRepositoryDialog.vue";

const store = useStore();
const router = useRouter();
const publishOpen = ref(false);
const addOpen = ref(false);
// The wizard picks from the repositories Pennsieve sees; have them ready.
const openAdd = () => {
  store.dispatch("codeReposModule/fetchAllMyRepos").catch(() => {});
  addOpen.value = true;
};
const onNewApp = (command) => {
  if (command === "repository") openAdd();
  else if (command === "manage") router.push({ name: "my-code" });
};
// A release is under way: the App Store adds the app once its image is built.
const timers = [];
const onDone = ({ destinations = [] } = {}) => {
  if (!destinations.includes("appstore")) return;
  for (const delay of [60000, 150000]) {
    timers.push(setTimeout(() => store.dispatch("analysisModule/fetchApplications", { force: true }).catch(() => {}), delay));
  }
};
onBeforeUnmount(() => timers.forEach(clearTimeout));
</script>

<template>
  <div class="apps-page">
    <AnalysisViewBar>
      <!-- One primary action, a new app from the template; a menu button
           beside it for a repository the user already has, and the ones
           already tracked. -->
      <bf-button @click="publishOpen = true">+ New App</bf-button>
      <el-dropdown trigger="click" placement="bottom-end" @command="onNewApp">
        <bf-button class="secondary apps-menu" aria-label="More app actions">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </bf-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="repository">Add existing repository…</el-dropdown-item>
            <el-dropdown-item command="manage" divided>Manage repositories</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </AnalysisViewBar>
    <PublishAppDialog v-model="publishOpen" />
    <AddRepositoryDialog v-model="addOpen" @done="onDone" />
    <!-- As the Workflows tab's Library: filters on the left, the search and
         Sort in one row over the cards. -->
    <div class="apps-body">
      <ApplicationsGrid embedded />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/element/input";
@use "../../../styles/theme";

.apps-page {
  height: calc(100vh - var(--analysis-stage-top, 112px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* The menu button: a square, as tall as the primary action beside it.
   More specific than the view bar's button sizing. */
.bf-button.bf-button.secondary.apps-menu {
  aspect-ratio: 1;
  width: auto;
  padding: 0;
  justify-content: center;

  svg {
    display: block;
  }
}
.apps-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
