<script setup>
import { provide, ref } from 'vue'
import { useAnalysisStageTop } from '@/composables/useAnalysisStageTop'

// Analysis outside any workspace, laid out like a workspace's Analysis page:
// its sections in the secondary nav (AnalysisNavigationSecondary, through
// MyWorkspaceNavigationSecondary), a section's views as the page's tabs, its
// actions on My Workspace's title row.
const stageMarker = ref(null)
const tabsRow = ref(null)
useAnalysisStageTop(stageMarker, [tabsRow])
provide('analysisLayout', 'sections')
</script>

<template>
  <div class="my-analysis">
    <!-- The section's views as the page's tabs (AnalysisViewBar); without
         views (most sections), no row. -->
    <div ref="tabsRow" class="tab-header">
      <div class="views-row">
        <div id="analysis-tab-views" class="tab-views" />
      </div>
    </div>
    <div ref="stageMarker" class="stage-marker" />
    <router-view />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/theme';

/* The views row: the page's tabs, their underline on the one rule under
   the header. */
.tab-header {
  box-sizing: border-box;
  padding: 0 32px;
  background: white;
  border-bottom: 1px solid theme.$gray_2;
}
.views-row {
  display: flex;
  height: 40px;
  min-width: 0;
}
/* No views (most sections): no row, only the rule under the title. */
.views-row:has(> .tab-views:empty) {
  display: none;
}
.tab-views {
  display: flex;
  align-items: stretch;
  min-width: 0;
}
.stage-marker {
  height: 0;
}
/* A phone: the views scroll rather than the page. */
@media (max-width: 767px) {
  .tab-header {
    padding: 0 16px;
  }
  .views-row {
    overflow-x: auto;
  }
}
</style>
