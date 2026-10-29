<script setup>
/*
  The run dialog's left column: the workflow being run (its graph, name,
  version and summary, what goes in and where results go), and, as the
  dialog's steps are taken, what's been chosen for the run. The same on
  every step, so it's always clear what is being run.
*/
import { computed } from "vue";
import { interfaceDag } from "../RunMonitor/workflowInterface";
import WorkflowThumbnail from "../WorkflowGraph/WorkflowThumbnail.vue";
import LlmMark from "../WorkflowGraph/LlmMark.vue";
import { runSummary } from "./runSummary";
import { cardText } from "./workflowSummary";

const props = defineProps({
  workflow: { type: Object, default: null },
  applications: { type: Array, default: () => [] },
  targetTypes: { type: Array, default: () => [] },
  // Chosen so far (names), shown under the workflow once picked.
  computeNode: { type: String, default: "" },
  dataset: { type: String, default: "" },
});

const summary = computed(() => (props.workflow ? runSummary(props.workflow, props.applications, props.targetTypes) : null));
const meta = computed(() => {
  const s = summary.value;
  if (!s) return "";
  return [s.version ? `Version ${s.version}` : "", `${s.stepCount} step${s.stepCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
});
</script>

<template>
  <aside class="rws">
    <template v-if="summary">
      <div class="rws__thumb">
        <WorkflowThumbnail :dag="interfaceDag(workflow)" :aspect="1.6" />
      </div>
      <h3 class="rws__name" :title="summary.name">{{ summary.name }}</h3>
      <div class="rws__meta">
        <span>{{ meta }}</span>
        <LlmMark v-if="summary.usesLLM" compact />
      </div>
      <p v-if="cardText(workflow)" class="rws__text">{{ cardText(workflow) }}</p>

      <section v-if="summary.inputs.length" class="rws__section">
        <h4>Inputs</h4>
        <ul>
          <li v-for="i in summary.inputs" :key="i.id">
            <span class="rws__item">{{ i.name }}</span>
            <span v-if="i.hint" class="rws__sub">{{ i.hint }}</span>
          </li>
        </ul>
      </section>
      <section v-if="summary.outputs.length" class="rws__section">
        <h4>Outputs</h4>
        <ul>
          <li v-for="o in summary.outputs" :key="o.id">
            <span class="rws__item">{{ o.label }}</span>
            <span class="rws__sub">{{ o.where }}</span>
          </li>
        </ul>
      </section>

      <section v-if="computeNode || dataset" class="rws__section rws__chosen">
        <h4>This run</h4>
        <ul>
          <li v-if="computeNode"><span class="rws__sub">on</span> <span class="rws__item">{{ computeNode }}</span></li>
          <li v-if="dataset"><span class="rws__sub">dataset</span> <span class="rws__item">{{ dataset }}</span></li>
        </ul>
      </section>
    </template>
    <p v-else class="rws__empty">Choose a workflow to see what it takes and where its results go.</p>
  </aside>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.rws {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 16px;
  background: theme.$gray_0;
  border-right: 1px solid theme.$gray_2;
  overflow-y: auto;

  // Each keeps its height; the column scrolls instead.
  > * {
    flex-shrink: 0;
  }
}
.rws__thumb {
  height: 110px;
  padding: 8px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$white;
}
.rws__name {
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 600;
  color: theme.$black;
  overflow-wrap: anywhere;
}
.rws__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: theme.$gray_4;
}
.rws__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: theme.$gray_5;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.rws__section {
  h4 {
    margin: 6px 0 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: theme.$gray_4;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    flex-direction: column;
    padding: 3px 0;
    font-size: 13px;
  }
}
.rws__item {
  color: theme.$gray_6;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.rws__sub {
  font-size: 12px;
  color: theme.$gray_4;
}
.rws__chosen {
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid theme.$gray_2;

  li {
    flex-direction: row;
    gap: 6px;
    align-items: baseline;
  }
}
.rws__empty {
  margin: auto 0;
  font-size: 13px;
  color: theme.$gray_4;
  text-align: center;
}
</style>
