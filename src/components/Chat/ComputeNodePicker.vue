<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    class="compute-node-picker"
    :close-on-click-modal="!required"
    :show-close="!required"
    width="520px"
  >
    <template #header>
      <h3 class="picker-title">Choose a compute node for chat</h3>
    </template>

    <div class="picker-body">
      <p class="picker-intro">
        Chat runs on one of your workspace's compute nodes. Pick the node you want this chat to use.
        You can change this later from the chat header.
      </p>

      <div v-if="loading" class="state state-loading">Loading compute nodes…</div>

      <div v-else-if="error" class="state state-error">
        Couldn't load compute nodes. <button class="retry" @click="$emit('refresh')">Try again</button>
      </div>

      <div v-else-if="!llmNodes.length && !nonLlmNodes.length" class="state state-empty">
        No compute nodes are configured for this workspace yet. Ask your workspace admin to create one.
      </div>

      <div v-else class="node-list">
        <button
          v-for="node in llmNodes"
          :key="node.uuid"
          type="button"
          class="node-row"
          :class="{ selected: selected === node.uuid }"
          @click="selected = node.uuid"
        >
          <div class="node-row-main">
            <span class="radio" :class="{ checked: selected === node.uuid }" />
            <div class="node-info">
              <div class="node-name">{{ node.name || 'Unnamed node' }}</div>
              <div class="node-meta">
                <span class="tag llm">LLM ready</span>
                <span v-if="node.status" class="tag muted">{{ node.status }}</span>
              </div>
            </div>
          </div>
        </button>

        <div v-if="nonLlmNodes.length" class="non-llm-section">
          <div class="non-llm-header">Not configured for chat</div>
          <div v-for="node in nonLlmNodes" :key="node.uuid" class="node-row disabled">
            <div class="node-row-main">
              <span class="radio" />
              <div class="node-info">
                <div class="node-name">{{ node.name || 'Unnamed node' }}</div>
                <div class="node-meta muted-text">
                  LLM access not enabled — contact your workspace admin.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="footer-row">
        <button v-if="!required" class="btn btn-secondary" type="button" @click="$emit('update:visible', false)">
          Cancel
        </button>
        <button
          class="btn btn-primary"
          type="button"
          :disabled="!selected"
          @click="onConfirm"
        >Continue</button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  nodes: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
  defaultNodeId: { type: String, default: null },
  required: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible', 'confirm', 'refresh'])

const selected = ref(props.defaultNodeId || null)

watch(
  () => props.visible,
  (open) => {
    if (open) {
      // Seed selection with remembered choice, else first LLM-capable node.
      const fallback = props.nodes.find((n) => n.enableLLMAccess)?.uuid || null
      selected.value = props.defaultNodeId || fallback
    }
  },
  { immediate: true }
)

const llmNodes = computed(() => props.nodes.filter((n) => n.enableLLMAccess))
const nonLlmNodes = computed(() => props.nodes.filter((n) => !n.enableLLMAccess))

const onConfirm = () => {
  if (!selected.value) return
  emit('confirm', selected.value)
}
</script>

<style scoped lang="scss">
@use 'sass:color';
@use '../../styles/theme';
.picker-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.picker-intro {
  font-size: 14px;
  color: #555;
  margin: 0 0 16px;
  line-height: 1.5;
}

.state {
  padding: 24px;
  text-align: center;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #666;

  &.state-error { color: #b34141; border-color: #e0a8a8; }
}

.retry {
  background: none;
  border: none;
  color: #{theme.$purple_3};
  cursor: pointer;
  text-decoration: underline;
  font: inherit;
}

.node-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.node-row {
  width: 100%;
  text-align: left;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: border-color 0.15s, background 0.15s;

  &:hover:not(.disabled) { border-color: #{theme.$purple_3}; }
  &.selected { border-color: #{theme.$purple_3}; background: #f4f7ff; }
  &.disabled { cursor: not-allowed; opacity: 0.7; background: #fafafa; }
}

.node-row-main {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.radio {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid #999;
  margin-top: 2px;
  flex-shrink: 0;

  &.checked {
    border-color: #{theme.$purple_3};
    background: radial-gradient(circle, #{theme.$purple_3} 40%, transparent 50%);
  }
}

.node-info { flex: 1; min-width: 0; }
.node-name { font-size: 14px; font-weight: 600; color: #1c1c1c; }
.node-meta { margin-top: 4px; display: flex; gap: 8px; align-items: center; }

.tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;

  &.llm { background: #e6f4ea; color: #2a8a3e; }
  &.muted { background: #f0f2f5; color: #666; }
}

.muted-text { font-size: 13px; color: #666; margin-top: 4px; }

.non-llm-section { margin-top: 16px; }
.non-llm-header { font-size: 12px; text-transform: uppercase; color: #999; margin-bottom: 8px; font-weight: 600; letter-spacing: 0.5px; }

.footer-row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  border: none;
  border-radius: 6px;
  padding: 8px 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;

  &:disabled { cursor: not-allowed; opacity: 0.5; }
}

.btn-secondary { background: #fff; color: #1c1c1c; border: 1px solid #d1d5db; }
.btn-secondary:hover:not(:disabled) { background: #f0f2f5; }
.btn-primary { background: theme.$purple_3; color: #fff; }
.btn-primary:hover:not(:disabled) { background: color.adjust(theme.$purple_3, $lightness: -8%); }
</style>
