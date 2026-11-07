<script setup>
// What comes next after a step: an app, or the workflow's output. Opened by
// the + under a step; picking adds and connects it (WorkflowBuilder addStep).
import { computed, nextTick, ref, watch } from "vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "Add a step" },
  applications: { type: Array, default: () => [] },
  // (app) -> the app's display name
  appName: { type: Function, required: true },
  // (app) -> a short line about it
  appLine: { type: Function, default: () => "" },
  allowOutput: { type: Boolean, default: true },
});
// pick({ type: "default" | "data-target", app }), close
const emit = defineEmits(["pick", "close"]);

const query = ref("");
const searchRef = ref(null);
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    query.value = "";
    nextTick(() => searchRef.value?.focus());
  }
);

const shown = computed(() => {
  const q = query.value.trim().toLowerCase();
  const apps = q
    ? props.applications.filter((a) =>
        [props.appName(a), a.name, a.description, a.sourceUrl, props.appLine(a)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : props.applications;
  return apps.slice(0, 50);
});
const showOutput = computed(() => props.allowOutput && (!query.value.trim() || "output".includes(query.value.trim().toLowerCase())));

function pick(type, app = null) {
  emit("pick", { type, app });
}
</script>

<template>
  <el-dialog
    :model-value="open"
    :title="title"
    width="460px"
    append-to-body
    class="step-picker"
    @update:model-value="(v) => v || emit('close')"
  >
    <el-input ref="searchRef" v-model="query" placeholder="Search apps…" clearable />
    <ul class="sp-list" role="listbox">
      <li v-if="showOutput">
        <button type="button" class="sp-item" @click="pick('data-target')">
          <span class="sp-kind sp-kind--output" aria-hidden="true" />
          <span class="sp-text">
            <span class="sp-name">Output</span>
            <span class="sp-line">Where the results go, e.g. a dataset or a download</span>
          </span>
        </button>
      </li>
      <li v-for="app in shown" :key="app.uuid || app.sourceUrl">
        <button type="button" class="sp-item" @click="pick('default', app)">
          <span class="sp-kind" aria-hidden="true" />
          <span class="sp-text">
            <span class="sp-name">{{ appName(app) }}</span>
            <span v-if="appLine(app)" class="sp-line">{{ appLine(app) }}</span>
          </span>
        </button>
      </li>
      <li v-if="!shown.length && !showOutput" class="sp-empty">No app matches "{{ query }}".</li>
    </ul>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.sp-list {
  max-height: 360px;
  margin: 10px 0 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.sp-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 8px 6px;
  border: none;
  border-radius: 3px;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: theme.$gray_1;
    outline: none;
  }
}
/* The kind's colour, as on the canvas: apps orange, outputs slate. */
.sp-kind {
  width: 4px;
  align-self: stretch;
  flex-shrink: 0;
  border-radius: 2px;
  background: #e0912a;
}
.sp-kind--output {
  background: #64748b;
}
.sp-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.sp-name {
  font-size: 13px;
  font-weight: 500;
  color: theme.$gray_6;
}
.sp-line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: theme.$gray_4;
}
.sp-empty {
  padding: 8px 6px;
  font-size: 13px;
  color: theme.$gray_4;
}
</style>
