<template>
  <div class="agent-download-command">
    <div class="command">
      <code v-if="state === 'saving'" class="saving" data-cy="agentDownloadCommand">
        Preparing the command…
      </code>
      <code v-else data-cy="agentDownloadCommand">{{ command }}</code>
      <el-button
        size="small"
        data-cy="copyAgentCommand"
        :disabled="state === 'saving'"
        @click="copy"
      >
        {{ copied ? "Copied" : "Copy" }}
      </el-button>
    </div>
    <p class="hint">
      Needs the
      <a :href="AGENT_DOCS_URL" target="_blank" rel="noopener">Pennsieve agent</a>
      {{ minVersion }} or later
      (<a :href="AGENT_RELEASES_URL" target="_blank" rel="noopener">download</a>).
      <template v-if="state === 'ready'">The command works for two days. </template>
      Run it in the folder to download into.
    </p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import {
  agentDownloadCommand,
  agentSelectionCommand,
  createSelection,
  AGENT_DOCS_URL,
  AGENT_MIN_VERSION,
  AGENT_SELECTION_MIN_VERSION,
  AGENT_RELEASES_URL,
} from "@/utils/downloadService";
import EventBus from "@/utils/event-bus";

// The agent command for a selection too large to zip. The selection is
// saved with download-service, so the command is short however many items
// were selected; if it can't be saved, the command lists the node ids.
const props = defineProps({
  datasetId: { type: String, required: true },
  nodeIds: { type: Array, default: () => [] },
  folderName: { type: String, default: "" },
});

// saving → ready (a saved selection) or fallback (node ids).
const state = ref("saving");
const selectionId = ref("");
let latest = 0;

// A new selection whenever the items change (rows removed in the dialog).
// Only the latest request's answer is used.
watch(
  () => [props.datasetId, props.nodeIds.join(",")],
  async () => {
    const request = ++latest;
    state.value = "saving";
    try {
      const selection = await createSelection({ datasetId: props.datasetId, nodeIds: props.nodeIds });
      if (request !== latest) return;
      selectionId.value = selection.id;
      state.value = "ready";
    } catch (e) {
      if (request !== latest) return;
      state.value = "fallback";
    }
  },
  { immediate: true },
);

const command = computed(() =>
  state.value === "ready"
    ? agentSelectionCommand({ selectionId: selectionId.value, folderName: props.folderName })
    : agentDownloadCommand(props),
);
const minVersion = computed(() =>
  state.value === "ready" ? AGENT_SELECTION_MIN_VERSION : AGENT_MIN_VERSION,
);
const copied = ref(false);

async function copy() {
  try {
    await navigator.clipboard.writeText(command.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch (e) {
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Couldn't copy the command. Select it and copy it instead." },
    });
  }
}
</script>

<style lang="scss" scoped>
@use "../../styles/theme";

.agent-download-command {
  .command {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 8px 8px 12px;
    background: theme.$gray_1;
    border: 1px solid theme.$gray_2;
  }

  code {
    flex: 1;
    min-width: 0;
    font-family: Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 24px;
    color: theme.$gray_6;
    overflow-wrap: anywhere;
    user-select: all;

    &.saving {
      color: theme.$gray_4;
      user-select: none;
    }
  }

  .hint {
    margin: 6px 0 0;
    font-size: 12px;
    color: theme.$gray_4;
  }
}
</style>
