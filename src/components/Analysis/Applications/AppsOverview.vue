<script setup>
// The Apps tab: the applications workflow steps run. No views; the bar has
// the search on the left (where other tabs have their view switch) and the
// action on the right: publishing an app, which the guide walks through
// (an app.yml in the repository, then the App Store release; the builder
// is reached from it).
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
const publishGuide = () => router.push({ name: scoped("application-manifest-guide") });
</script>

<template>
  <div class="apps-page">
    <AnalysisViewBar>
      <template #lead>
        <label class="apps-search-control">
          Search
          <el-input
            v-model="search"
            placeholder="Name, description or repository…"
            clearable
            class="apps-search"
          />
        </label>
      </template>
      <bf-button class="secondary" @click="publishGuide">Publish an app</bf-button>
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
@use "../../../styles/theme";

.apps-page {
  height: calc(100vh - 112px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.apps-search-control {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_5;
}
.apps-search {
  width: 360px;
}
.apps-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
