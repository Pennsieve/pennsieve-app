<script setup>
// The Apps tab: the applications workflow steps run. No views; the bar has
// the actions on the right (the search and Sort are the grid's, over its
// cards, as on the Workflows Library): a new app from Pennsieve's template, a guided wizard
// (PublishAppDialog: describe it, the repository from the template, the
// GitHub App, the app.yml, the release); or a repository the user already
// has (AddRepositoryDialog: access, destinations, sharing, a release). The
// repositories already tracked are managed on the user's Code page.
import { onBeforeUnmount, ref } from "vue";
import { useStore } from "vuex";
import BfButton from "../../shared/bf-button/BfButton.vue";
import ApplicationsGrid from "./ApplicationsGrid.vue";
import AnalysisViewBar from "../AnalysisViewBar.vue";
import PublishAppDialog from "./PublishAppDialog.vue";
import AddRepositoryDialog from "./AddRepositoryDialog.vue";

const store = useStore();
const publishOpen = ref(false);
const addOpen = ref(false);
// The wizard picks from the repositories Pennsieve sees; have them ready.
const openAdd = () => {
  store.dispatch("codeReposModule/fetchAllMyRepos").catch(() => {});
  addOpen.value = true;
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
      <div class="apps-actions">
        <router-link class="apps-repos-link" :to="{ name: 'my-code' }">Manage repositories</router-link>
        <bf-button class="secondary" @click="openAdd">Add Repository</bf-button>
        <bf-button @click="publishOpen = true">Create New App</bf-button>
      </div>
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
  height: calc(100vh - 112px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.apps-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
// The repositories already tracked are on the user's Code page.
.apps-repos-link {
  margin-right: 8px;
  font-size: 14px;
  color: theme.$purple_2;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
.apps-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
