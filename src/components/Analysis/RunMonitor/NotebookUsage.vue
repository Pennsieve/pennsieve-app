<script setup>
// What notebook sessions have taken, in a range: how many, the time spent in
// them, and what they cost. From the notebook share of the workspace's
// counters, or in My Workspace your own (useMetricsCounters), counted as each
// session ends. Laid out as the Workflows tab's overview; no success rate,
// since a session ends however it ends.
import { computed, onMounted, ref } from "vue";
import { useMetricsCounters } from "@/composables/useMetricsCounters";
import IconInfoSmall from "../../icons/IconInfoSmall.vue";
import { notebookUsage, sessionCost, sessionTime } from "./notebookUsage";

const range = ref("allTime");
const RANGES = [
  { label: "Last Month", value: "lastMonth" },
  { label: "Last Year", value: "lastYear" },
  { label: "All time", value: "allTime" },
];
const { counters, isLoading, fetchCounters } = useMetricsCounters({ range });
const usage = computed(() => notebookUsage(counters.value));
// Anything at all, in any range: until then the strip stays out of the way.
const everUsed = ref(false);

async function load() {
  await fetchCounters();
  if (usage.value) everUsed.value = true;
}
function pick(value) {
  range.value = value;
  load();
}
onMounted(load);
defineExpose({ refresh: load });
</script>

<template>
  <div v-if="everUsed" class="dashboard-section">
    <div class="dashboard-section-header">
      <h3 class="dashboard-section-title">
        Usage
        <el-tooltip content="Counted as each session ends" placement="top">
          <IconInfoSmall :width="24" :height="24" color="#9ca3af" class="dashboard-info-icon" />
        </el-tooltip>
      </h3>
      <div class="dashboard-range-buttons">
        <button
          v-for="opt in RANGES"
          :key="opt.value"
          type="button"
          class="range-btn"
          :class="{ active: range === opt.value }"
          @click="pick(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
    <div v-if="isLoading && !usage" class="dashboard-empty-range">Loading usage…</div>
    <div v-else-if="usage" class="dashboard-stats">
      <div class="dash-stat">
        <span class="dash-stat-value">{{ usage.sessions }}</span>
        <span class="dash-stat-label">Sessions</span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-value">{{ sessionTime(usage.seconds) }}</span>
        <span class="dash-stat-label">Time in sessions</span>
      </div>
      <div class="dash-stat">
        <span class="dash-stat-value">{{ sessionCost(usage.cost) }}</span>
        <span class="dash-stat-label">Cost</span>
      </div>
    </div>
    <div v-else class="dashboard-empty-range">No sessions in this time range</div>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

/* As the Workflows tab's overview (RunsOverview). */
.dashboard-section {
  margin-bottom: 24px;
}
.dashboard-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
}
.dashboard-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_5;
}
.dashboard-info-icon {
  cursor: help;
}
.dashboard-range-buttons {
  display: flex;
  gap: 4px;
}
.range-btn {
  padding: 4px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  color: theme.$gray_5;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_1;
  }
  &.active {
    background: theme.$purple_1;
    border-color: theme.$purple_1;
    color: white;
  }
}
.dashboard-stats {
  display: flex;
  gap: 16px;
}
.dash-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100px;
  padding: 16px 20px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
}
.dash-stat-value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  color: theme.$black;
}
.dash-stat-label {
  margin-top: 4px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: theme.$gray_4;
}
.dashboard-empty-range {
  padding: 16px 0;
  font-size: 13px;
  color: theme.$gray_4;
}
</style>
