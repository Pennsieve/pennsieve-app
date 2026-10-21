<template>
  <div class="agent-download-command">
    <div class="command">
      <code data-cy="agentDownloadCommand">{{ command }}</code>
      <el-button size="small" data-cy="copyAgentCommand" @click="copy">
        {{ copied ? "Copied" : "Copy" }}
      </el-button>
    </div>
    <p class="hint">
      Needs the
      <a :href="AGENT_DOCS_URL" target="_blank" rel="noopener">Pennsieve agent</a>
      {{ AGENT_MIN_VERSION }} or later
      (<a :href="AGENT_RELEASES_URL" target="_blank" rel="noopener">download</a>).
      Run it in the folder to download into.
    </p>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import {
  agentDownloadCommand,
  AGENT_DOCS_URL,
  AGENT_MIN_VERSION,
  AGENT_RELEASES_URL,
} from "@/utils/downloadService";
import EventBus from "@/utils/event-bus";

// The agent command for a selection too large to zip.
const props = defineProps({
  datasetId: { type: String, required: true },
  nodeIds: { type: Array, default: () => [] },
  folderName: { type: String, default: "" },
});

const command = computed(() => agentDownloadCommand(props));
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
  }

  .hint {
    margin: 6px 0 0;
    font-size: 12px;
    color: theme.$gray_4;
  }
}
</style>
