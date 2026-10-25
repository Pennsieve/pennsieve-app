<script setup>
// The list of earlier runs on the Notebooks and Workflows tabs, the same on
// both: searchable rows (name, status, when, how long) that open in place
// with when and where the run ran, who started it, its estimated cost (read
// from the run when opened) and any error, and a link to the run page for
// logs and outputs. Filters and per-row actions come from the page.
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "vuex";
import { formatCost, formatDuration, formatTime, runDisplayName, statusDotClass, statusLabel } from "./runHelpers";
import { costOf, costParts, fetchRun } from "./runDetails";

const props = defineProps({
  title: { type: String, required: true },
  // The tab the list is on ("notebooks"), passed to the run pages it links.
  from: { type: String, default: "" },
  // The runs to list, newest first.
  runs: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  hasMore: { type: Boolean, default: false },
  loadingMore: { type: Boolean, default: false },
  // What the list says with no runs, and with none matching the search.
  emptyText: { type: String, default: "Nothing yet." },
  searchPlaceholder: { type: String, default: "Search…" },
  // Shows each run's workflow under its name (the Workflows tab).
  showWorkflow: { type: Boolean, default: false },
  // (id) -> name, for the details.
  nodeName: { type: Function, default: () => "" },
  userName: { type: Function, default: () => "" },
});
const emit = defineEmits(["load-more"]);

const route = useRoute();
const store = useStore();

const query = ref("");
const shown = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.runs;
  return props.runs.filter((r) =>
    [runDisplayName(r), r.workflowName].some((s) => (s || "").toLowerCase().includes(q))
  );
});

const openId = ref(null);
const details = ref({}); // run id -> the run, with metrics
async function toggle(run) {
  openId.value = openId.value === run.uuid ? null : run.uuid;
  if (!openId.value || details.value[run.uuid]) return;
  const full = await fetchRun(store.state.config.api2Url, run.uuid);
  if (full) details.value = { ...details.value, [run.uuid]: full };
}

// The run's page, saying which tab it was opened from (props.from) so that
// tab stays highlighted there.
const runPage = (run) => ({
  ...(route.params.orgId
    ? { name: "run-detail", params: { orgId: route.params.orgId, runId: run.uuid } }
    : { name: "my-run-detail", params: { runId: run.uuid } }),
  ...(props.from && { query: { from: props.from } }),
});
const ended = (run) => run.completedAt && !["NOT_STARTED", "STARTED", "FINALIZING"].includes(run.status);
const errorOf = (run) => run.errorMessage || details.value[run.uuid]?.errorMessage || "";
</script>

<template>
  <div class="dashboard-section">
    <div class="rh-head">
      <h3 class="dashboard-section-title">{{ title }}</h3>
      <div class="rh-tools">
        <slot name="filters" />
        <el-input
          v-if="runs.length > 5 || query"
          v-model="query"
          size="small"
          clearable
          :placeholder="searchPlaceholder"
          class="rh-search"
        />
      </div>
    </div>

    <p v-if="loading && !runs.length" class="rh-empty">Loading…</p>
    <p v-else-if="!runs.length" class="rh-empty">{{ emptyText }}</p>
    <p v-else-if="!shown.length" class="rh-empty">Nothing matches "{{ query }}".</p>
    <div v-else class="rh-list">
      <template v-for="run in shown" :key="run.uuid">
        <div
          class="rh-row"
          :class="{ 'is-open': openId === run.uuid }"
          role="button"
          tabindex="0"
          :aria-expanded="openId === run.uuid"
          @click="toggle(run)"
          @keydown.enter="toggle(run)"
        >
          <span class="rh-caret" :class="{ open: openId === run.uuid }">▸</span>
          <span class="run-status-dot" :class="statusDotClass(run.status)" />
          <span class="rh-name">
            {{ runDisplayName(run) || "Unnamed" }}
            <span v-if="showWorkflow && run.name && run.workflowName" class="rh-workflow">{{ run.workflowName }}</span>
          </span>
          <span class="rh-status">{{ statusLabel(run.status) }}</span>
          <span class="rh-time">{{ formatTime(run.completedAt || run.startedAt) }}</span>
          <span class="rh-num" title="How long it ran">{{ ended(run) ? formatDuration(run.startedAt, run.completedAt) : "" }}</span>
          <span class="rh-actions" @click.stop><slot name="actions" :run="run" /></span>
        </div>
        <div v-if="openId === run.uuid" class="rh-details">
          <dl class="rh-facts">
            <dt>Started</dt>
            <dd>{{ formatTime(run.startedAt) }}</dd>
            <dt>Ended</dt>
            <dd>{{ ended(run) ? formatTime(run.completedAt) : "—" }}</dd>
            <dt>Ran for</dt>
            <dd>{{ ended(run) ? formatDuration(run.startedAt, run.completedAt) : "—" }}</dd>
            <template v-if="showWorkflow && run.workflowName">
              <dt>Workflow</dt>
              <dd>{{ run.workflowName }}</dd>
            </template>
            <template v-if="nodeName(run.computeNodeUuid)">
              <dt>Compute node</dt>
              <dd>{{ nodeName(run.computeNodeUuid) }}</dd>
            </template>
            <template v-if="userName(run.createdBy)">
              <dt>Started by</dt>
              <dd>{{ userName(run.createdBy) }}</dd>
            </template>
            <dt>Estimated cost</dt>
            <dd>
              <template v-if="costOf(details[run.uuid]) != null">
                {{ formatCost(costOf(details[run.uuid])) }}
                <span v-if="costParts(details[run.uuid]).length" class="rh-cost-parts">
                  ({{ costParts(details[run.uuid]).map((p) => `${p.label} ${formatCost(p.cost)}`).join(" · ") }})
                </span>
              </template>
              <template v-else-if="details[run.uuid]">Not calculated yet</template>
              <template v-else>Loading…</template>
            </dd>
          </dl>
          <p v-if="errorOf(run)" class="rh-error">{{ errorOf(run) }}</p>
          <router-link :to="runPage(run)" class="rh-link">Logs, outputs and full details →</router-link>
        </div>
      </template>
    </div>
    <button v-if="hasMore" class="rh-more" :disabled="loadingMore" @click="emit('load-more')">
      {{ loadingMore ? "Loading…" : "Load earlier" }}
    </button>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.dashboard-section {
  margin-bottom: 24px;
}
.dashboard-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.rh-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.rh-tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.rh-search {
  width: 220px;
}
.rh-empty {
  margin: 4px 0 0;
  font-size: 13px;
  color: theme.$gray_4;
}
.rh-list {
  display: flex;
  flex-direction: column;
  background: theme.$white;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  overflow: hidden;
}
.rh-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid theme.$gray_1;
  cursor: pointer;
  font-size: 13px;

  &:last-child {
    border-bottom: none;
  }
  &:hover,
  &.is-open {
    background: theme.$gray_1;
  }
}
.rh-caret {
  width: 10px;
  flex-shrink: 0;
  font-size: 10px;
  color: theme.$gray_4;
  transition: transform 0.12s ease;

  &.open {
    transform: rotate(90deg);
  }
}
.run-status-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: theme.$gray_4;

  /* As on the Runs dashboard (statusDotClass). */
  &.dot-blue { background-color: #06b6d4; }
  &.dot-amber { background-color: #f59e0b; }
  &.dot-green { background-color: theme.$status_green; }
  &.dot-red { background-color: theme.$status_red; }
}
.rh-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: theme.$gray_6;
}
.rh-workflow {
  margin-left: 6px;
  font-weight: 400;
  color: theme.$gray_4;
}
.rh-status {
  flex-shrink: 0;
  color: theme.$gray_5;
}
.rh-time {
  flex-shrink: 0;
  margin-left: auto;
  color: theme.$gray_4;
}
/* Duration: a fixed column, right-aligned, so the rows line up. */
.rh-num {
  width: 64px;
  flex-shrink: 0;
  text-align: right;
  color: theme.$gray_5;
  font-variant-numeric: tabular-nums;
}
.rh-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;

  &:empty {
    display: none;
  }
}
.rh-details {
  padding: 4px 14px 14px 38px;
  border-bottom: 1px solid theme.$gray_1;
  background: theme.$gray_1;
  font-size: 13px;
}
.rh-facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 16px;
  margin: 0 0 8px;

  dt {
    color: theme.$gray_4;
  }
  dd {
    margin: 0;
    color: theme.$gray_6;
  }
}
.rh-cost-parts {
  margin-left: 4px;
  color: theme.$gray_4;
}
.rh-error {
  margin: 0 0 8px;
  color: theme.$red_2;
  white-space: pre-wrap;
}
.rh-link,
.rh-more {
  font-size: 12px;
  color: theme.$link-color;
  text-decoration: none;

  &:hover {
    color: theme.$link-color-hover;
  }
}
.rh-more {
  margin-top: 8px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  cursor: pointer;

  &:disabled {
    color: theme.$gray_4;
    cursor: default;
  }
}
</style>
