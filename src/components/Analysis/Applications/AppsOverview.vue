<script setup>
// The Apps tab: the applications workflow steps run. No views; the bar has
// the search on the left (where other tabs have their view switch) and the
// action, writing an app.yml (the builder links its guide; an app's own page
// opens it prefilled), on the right.
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import BfButton from "../../shared/bf-button/BfButton.vue";
import ApplicationsGrid from "./ApplicationsGrid.vue";
import AnalysisViewBar from "../AnalysisViewBar.vue";

const route = useRoute();
const router = useRouter();
const isMyWorkspace = computed(() => !route.params.orgId);
const scoped = (name) => (isMyWorkspace.value ? `my-${name}` : name);

const search = ref("");
const newManifest = () => router.push({ name: scoped("application-manifest-builder") });
</script>

<template>
  <div class="apps-page">
    <AnalysisViewBar>
      <template #lead>
        <el-input
          v-model="search"
          placeholder="Search by name, description or repository…"
          size="small"
          clearable
          class="apps-search"
        />
      </template>
      <bf-button @click="newManifest">+ New app.yml</bf-button>
    </AnalysisViewBar>
    <!-- As the Workflows tab's Library: the grid's own 20px/32px padding,
         scrolling under a fixed bar. -->
    <div class="apps-body">
      <ApplicationsGrid v-model:search="search" embedded search-in-bar />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/element/input";

.apps-page {
  height: calc(100vh - 112px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.apps-search {
  width: 360px;
}
/* The global input style fixes inputs at 40px; this one is the height of the
   small selects next to it. */
.apps-search.el-input {
  --el-input-height: 24px;
  --el-input-inner-height: 22px;
}
.apps-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
