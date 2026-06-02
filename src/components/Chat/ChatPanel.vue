<template>
  <div class="chat-panel">
    <!-- Sub-bar: chat context + compute node + per-user quota meter +
         new-chat affordance. The "Ask Pennsieve" title lives in the
         dashboard widget header (via the layout item's componentName) —
         not duplicated here. The context label is optional (e.g., the
         dataset overview already shows the dataset name in the page
         heading). -->
    <div class="chat-context">
      <div class="context-info">
        <span v-if="contextLabel" class="context-label">{{ contextLabel }}</span>
        <span v-if="contextLabel && selectedNode" class="dot-sep">•</span>
        <button
          v-if="selectedNode"
          type="button"
          class="compute-pill"
          @click="openPicker"
          :aria-label="`Change compute node (currently ${selectedNode.name})`"
        >
          <span class="compute-name">{{ selectedNode.name || 'Compute node' }}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none" />
          </svg>
        </button>
        <button
          v-else
          type="button"
          class="compute-pill unset"
          @click="openPicker"
        >
          <span class="compute-name">Choose compute node</span>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none" />
          </svg>
        </button>
        <!-- Per-user LLM cost quota meter — inline-compact next to the
             compute-pill. Expanded panel pops out below the chat-context
             row via absolute positioning (see ChatQuotaHeader.vue). -->
        <ChatQuotaHeader
          v-if="selectedNodeId"
          inline
          :quota="chatQuota"
          :loading="chatQuotaLoading"
          :error="chatQuotaError"
          :manage-href="manageQuotasHref"
        />
      </div>
      <div class="header-actions">
        <!-- Quick-compose trigger. The Spotlight modal is also bound to
             Cmd+K (Ctrl+K on non-Mac); this button is the discoverable
             affordance for users who don't reach for keyboard shortcuts.
             EventBus hook is registered in App.vue. -->
        <button
          type="button"
          class="header-btn quick-compose"
          @click="openSpotlight"
          :aria-label="`Quick compose (${cmdKLabel})`"
          :title="`Quick compose from any page (${cmdKLabel})`"
        >
          <span class="kbd-inline" aria-hidden="true">{{ cmdKLabel }}</span>
        </button>
        <!-- History dropdown: resume a saved server-side session. Anchored
             relative to this wrapper so the popover drops below the button. -->
        <div class="history-wrap">
          <button
            type="button"
            class="header-btn"
            :class="{ active: historyOpen }"
            @click="toggleHistory"
            aria-label="Chat history"
            title="Chat history"
          >History</button>
          <ChatSessionMenu
            v-model:visible="historyOpen"
            :active-id="convo?.sessionId || null"
            @resume="resumeSession"
          />
        </div>
        <button
          v-if="messageCount"
          type="button"
          class="header-btn"
          @click="onResetConversation"
          aria-label="Start a new conversation"
          title="New conversation"
        >New chat</button>
      </div>
    </div>

    <div v-if="lastError" class="error-banner">
      <span>
        {{ errorLabel }}
        <a
          v-if="isQuotaError"
          href="https://docs.pennsieve.io/docs/registering-a-compute-resource"
          target="_blank"
          rel="noopener noreferrer"
          class="error-cta"
        >Set up your own compute node →</a>
      </span>
      <button type="button" class="dismiss" @click="dismissError" aria-label="Dismiss">×</button>
    </div>

    <ChatMessageList :messages="messages" :pending="pending" :active-tools="activeTools">
      <template #empty>
        <div v-if="noLlmNodesAvailable" class="empty-state no-nodes">
          <img
            class="empty-illustration"
            src="@/assets/images/illustrations/illo-dr_azumi_1.svg"
            alt=""
          />
          <h3 class="empty-title">No AI-ready compute node yet</h3>
          <p class="empty-body">
            Chat runs on a compute node in this workspace, and none of the nodes here have LLM access enabled.
          </p>
          <router-link
            v-if="hasAdminRights"
            class="empty-cta"
            :to="{ name: 'compute-nodes', params: { orgId } }"
          >Set up a compute node →</router-link>
          <p v-else class="empty-secondary">Ask your workspace admin to enable LLM access on a node.</p>
          <a
            class="empty-docs-link"
            href="https://docs.pennsieve.io/docs/introduction-to-pennsieve-analysis"
            target="_blank"
            rel="noopener noreferrer"
          >Learn about Pennsieve compute nodes →</a>
        </div>
        <div v-else class="empty-state">
          <img
            class="empty-illustration small"
            src="@/assets/images/illustrations/illo-dr_azumi_1.svg"
            alt=""
          />
          <p class="empty-title">{{ emptyTitle }}</p>
          <ChatStarterPrompts :prompts="starterPrompts" :disabled="!canSend" @pick="onPickPrompt" />
          <p v-if="mode === 'workspace'" class="empty-hint">
            Tip: type <kbd>@</kbd> to mention a specific dataset, or press
            <kbd>{{ cmdKLabel }}</kbd> from any page to compose with the
            current file or dataset attached.
          </p>
        </div>
      </template>
    </ChatMessageList>

    <ChatInput
      :disabled="!canSend"
      :placeholder="inputPlaceholder"
      :datasets="datasetSuggestions"
      @submit="onSubmit"
    />

    <ComputeNodePicker
      v-model:visible="pickerOpen"
      :nodes="nodes"
      :loading="nodesLoading"
      :error="nodesError"
      :default-node-id="defaultNodeId"
      :required="pickerRequired"
      @confirm="onPickerConfirm"
      @refresh="loadNodes(true)"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useStore } from 'vuex'
import { useChatStore, contextKey, getRememberedComputeNode, rememberComputeNode } from '@/stores/chatStore'
import { useChatSocket } from '@/composables/useChatSocket'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'
import ChatMessageList from './ChatMessageList.vue'
import ChatInput from './ChatInput.vue'
import ChatStarterPrompts from './ChatStarterPrompts.vue'
import ComputeNodePicker from './ComputeNodePicker.vue'
import ChatSessionMenu from './ChatSessionMenu.vue'
import EventBus from '@/utils/event-bus'
import { cmdKLabel } from '@/utils/platform'
import ChatQuotaHeader from './ChatQuotaHeader.vue'
import { useChatQuota } from '@/composables/useChatQuota'
import { useChatSessions } from '@/composables/useChatSessions'

const props = defineProps({
  mode: { type: String, required: true }, // 'workspace' | 'dataset'
  orgId: { type: String, required: true },
  datasetId: { type: String, default: null },
  contextLabel: { type: String, default: 'Workspace' },
  starterPrompts: { type: Array, default: () => [] },
  emptyTitle: { type: String, default: 'Ask anything about your workspace.' },
})

const chatStore = useChatStore()
const computeStore = useComputeResourcesStore()
const vuexStore = useStore()
const { sendUserMessage, disconnect } = useChatSocket()
const { listMessages } = useChatSessions()

const hasAdminRights = computed(() => {
  const org = vuexStore.state?.activeOrganization
  return !!(org?.isAdmin || org?.isOwner)
})

const key = computed(() => contextKey({ mode: props.mode, orgId: props.orgId, datasetId: props.datasetId }))

const scope = computed(() => `workspace:${props.orgId}`)
const nodes = computed(() => computeStore.getScopedComputeNodes(scope.value))
const nodesLoading = computed(() => computeStore.isScopeLoading(scope.value))
const nodesError = ref(false)

const loadNodes = async (forceRefresh = false) => {
  nodesError.value = false
  try {
    await computeStore.fetchScopedComputeNodes(scope.value, props.orgId, forceRefresh)
  } catch (e) {
    console.error('chat: failed to load compute nodes', e)
    nodesError.value = true
  }
}

const pickerOpen = ref(false)
const pickerRequired = ref(false)
const selectedNodeId = ref(getRememberedComputeNode(props.orgId))

const selectedNode = computed(() =>
  nodes.value.find((n) => n.uuid === selectedNodeId.value) || null
)

const defaultNodeId = computed(() => {
  if (selectedNodeId.value) return selectedNodeId.value
  return nodes.value.find((n) => n.enableLLMAccess)?.uuid || null
})

// True when the workspace has finished loading nodes and none are
// LLM-capable. Triggers the dedicated empty state instead of the
// "Ask anything…" starter prompts.
const noLlmNodesAvailable = computed(() => {
  if (nodesLoading.value) return false
  if (nodesError.value) return false
  return !nodes.value.some((n) => n.enableLLMAccess)
})

const openPicker = () => {
  pickerRequired.value = false
  pickerOpen.value = true
}

const onPickerConfirm = (nodeId) => {
  selectedNodeId.value = nodeId
  rememberComputeNode(props.orgId, nodeId)
  pickerOpen.value = false
  pickerRequired.value = false
  // If switching node mid-conversation, the store rotates the conversation
  // on next ensureConversation() call. Close the existing socket so the new
  // node is used on the next turn.
  disconnect({ mode: props.mode, orgId: props.orgId, datasetId: props.datasetId })
}

const ensureNodeSelected = async () => {
  if (selectedNode.value) return true
  await loadNodes()
  if (nodesError.value) return false

  const remembered = getRememberedComputeNode(props.orgId)
  const stillValid = remembered && nodes.value.find((n) => n.uuid === remembered && n.enableLLMAccess)
  if (stillValid) {
    selectedNodeId.value = remembered
    return true
  }

  // No remembered choice (or it's no longer valid) — prompt the user.
  pickerRequired.value = true
  pickerOpen.value = true
  return false
}

const convo = computed(() => chatStore.getConversation(key.value))
const messages = computed(() => convo.value?.messages || [])
const messageCount = computed(() => messages.value.length)

// Workspace dataset list — sourced from Vuex (loaded once per org
// when the user lands in the workspace). Used by the @-mention
// autocomplete in ChatInput; the per-conversation `referencedDatasets`
// field on each `message` frame is still recorded on the message in
// the chat store for forward-compat, but we no longer render a
// separate "Discussed:" pill row — attachments and references read
// inline in the thread now, mirroring how other chat UIs work.
const workspaceDatasets = computed(() => vuexStore.state?.datasets || [])

// Datasets surfaced in the @-mention autocomplete in ChatInput.
// Only meaningful in workspace mode — in dataset mode the chat is
// already scoped to one dataset.
const datasetSuggestions = computed(() => {
  if (props.mode !== 'workspace') return []
  return workspaceDatasets.value
    .map((ds) => ({
      id: ds?.content?.id,
      intId: ds?.content?.intId,
      name: ds?.content?.name,
    }))
    .filter((d) => d.id && d.name)
})
const pending = computed(() => convo.value?.pending || false)
const activeTools = computed(() => convo.value?.activeTools || [])
const connectionState = computed(() => convo.value?.connectionState || 'idle')
const lastError = computed(() => convo.value?.lastError || null)

// Per-(user, compute-node) LLM cost quota meter. Fetches on mount, on node
// change, and after each assistant turn (pending: true → false). See
// useChatQuota for the orchestration; the data comes from account-service's
// /effective endpoint.
const {
  quota: chatQuota,
  loading: chatQuotaLoading,
  error: chatQuotaError,
} = useChatQuota(selectedNodeId, pending)

// "Manage quotas" deep-link visibility. Only compute-node owners see it —
// for non-owners the link would 403 on click. We treat node.ownerId being
// the current user as the proxy; admins-with-manage-access can still get
// in through the same page if they navigate there directly.
const currentUserNodeId = computed(() => vuexStore.state?.profile?.id || '')
const isSelectedNodeOwner = computed(() => {
  if (!selectedNode.value || !currentUserNodeId.value) return false
  return selectedNode.value.ownerId === currentUserNodeId.value
})
const manageQuotasHref = computed(() => {
  if (!isSelectedNodeOwner.value || !selectedNode.value) return ''
  return `/${props.orgId}/analysis/compute-nodes/${selectedNode.value.uuid}#quotas`
})

const canSend = computed(() => !pending.value && !!selectedNodeId.value)

const inputPlaceholder = computed(() => {
  if (noLlmNodesAvailable.value) return 'Chat unavailable — no AI-ready compute node'
  if (!selectedNodeId.value) return 'Pick a compute node to start chatting…'
  if (pending.value) return 'Working on your last message…'
  return props.mode === 'dataset' ? 'Ask about this dataset…' : 'Ask about your workspace…'
})

const isQuotaError = computed(() => lastError.value?.code === 'QUOTA_EXCEEDED')

const errorLabel = computed(() => {
  if (!lastError.value) return ''
  const code = lastError.value.code || ''
  if (code === 'QUOTA_EXCEEDED') {
    return lastError.value.message || "You've reached your LLM cost limit on this compute node."
  }
  if (code === 'WS_CLOSE_1006') {
    return "Couldn't reach the chat service. Please try again in a moment, or contact your workspace admin if this persists."
  }
  if (code === 'WS_CLOSE_1008') {
    return 'Chat rejected the connection. Refresh the page to renew your session, or contact your workspace admin if you should have access to the selected compute node.'
  }
  if (code.startsWith('WS_CLOSE_')) {
    return `Chat connection closed (${code.replace('WS_CLOSE_', 'code ')}). Your next message will retry.`
  }
  if (code === 'AUTH') return 'Your session has expired. Please refresh the page and sign in again.'
  if (code === 'UPSTREAM_FAILURE' || code.startsWith('UPSTREAM_')) {
    const detail = lastError.value.message ? ` (${lastError.value.message})` : ''
    return `The assistant is having trouble right now${detail}. Try again in a moment.`
  }
  if (code === 'UNKNOWN_COMPUTE_NODE' || code === 'UNAVAILABLE') {
    return 'Compute node unavailable. Contact your workspace admin.'
  }
  if (code === 'MISCONFIGURED') {
    return `Chat is misconfigured on the compute node${lastError.value.message ? ` (${lastError.value.message})` : ''}. Contact your workspace admin.`
  }
  return `${code ? `[${code}] ` : ''}${lastError.value.message || 'Something went wrong.'}`
})

const dismissError = () => chatStore.clearError(key.value)

const onSubmit = async (content) => {
  const ready = await ensureNodeSelected()
  if (!ready) return
  await sendUserMessage({
    mode: props.mode,
    orgId: props.orgId,
    datasetId: props.datasetId,
    computeNodeId: selectedNodeId.value,
    content,
  })
}

const onPickPrompt = (prompt) => onSubmit(prompt)

const onResetConversation = () => chatStore.resetConversation(key.value)

const historyOpen = ref(false)
const toggleHistory = () => { historyOpen.value = !historyOpen.value }

// Resume a persisted server-side session: fetch its history (oldest-first),
// hydrate the conversation so the panel renders the prior turns, and close
// the current socket so the next send reconnects on the resumed sessionId
// (the URL carries `sessionId`, so the server continues that session).
const resumeSession = async (session) => {
  historyOpen.value = false
  const id = session?.id
  if (!id) return

  // Fetch history FIRST, before mutating any store state. This avoids an
  // intermediate render where the conversation exists but is empty (which
  // would flash the empty state and force an extra 0→N list transition).
  let messages = []
  try {
    // No cursor/direction → server returns the first page oldest-first
    // (ascending), which is the order the panel renders top-to-bottom.
    const res = await listMessages(id)
    messages = res?.messages || []
  } catch (e) {
    console.error('chat: failed to resume session', e)
    return
  }

  // Continue the session on the node it ran on, when that node is still
  // available here and LLM-capable. Otherwise keep the current selection.
  const sessionNode = nodes.value.find(
    (n) => n.uuid === session.computeNodeId && n.enableLLMAccess
  )
  if (sessionNode) {
    selectedNodeId.value = sessionNode.uuid
    rememberComputeNode(props.orgId, sessionNode.uuid)
  }

  // Create-if-missing then hydrate, both synchronous so Vue batches them
  // into a single update (existing messages → resumed messages) with no
  // empty render in between. ensureConversation also guards the case where
  // the user resumes before ever sending a message in this panel.
  chatStore.ensureConversation({
    mode: props.mode,
    orgId: props.orgId,
    datasetId: props.datasetId,
    computeNodeId: selectedNodeId.value,
  })
  chatStore.hydrateConversation(key.value, { sessionId: id, messages })
  disconnect({ mode: props.mode, orgId: props.orgId, datasetId: props.datasetId })
}

// Open the global Spotlight compose modal (the same one bound to
// Cmd+K). Available from inside the chat panel too as a discoverable
// trigger for users who don't reach for keyboard shortcuts. App.vue
// owns the modal's visibility state; we just emit the open signal.
const openSpotlight = () => EventBus.$emit('open-chat-spotlight')

onMounted(() => {
  // Just load the node list; don't auto-open the picker. Users hit the
  // picker when they pick a node from the empty state, click the
  // compute pill, or send their first message (ensureNodeSelected).
  loadNodes()
})

// If the remembered node disappears (e.g. workspace switch), clear it.
watch(nodes, (list) => {
  if (selectedNodeId.value && !list.find((n) => n.uuid === selectedNodeId.value)) {
    selectedNodeId.value = null
  }
})
</script>

<style scoped lang="scss">
@use 'sass:color';
@use '../../styles/theme';
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  overflow: hidden;
}

.chat-context {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  font-size: 12px;
  color: #666;
  // Anchor for the quota meter's absolutely-positioned expanded panel.
  // The collapsed trigger sits inline next to the compute pill; opening
  // it drops the breakdown popover down below this row without pushing
  // the message list.
  position: relative;
}

.context-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.dot-sep { color: #c5cbd6; }

.compute-pill {
  // Reset native button defaults first; the explicit font-size +
  // line-height + height below are what actually decides the pill's
  // geometry. `font: inherit` is a shorthand that resets font-size and
  // line-height, so it must come BEFORE those overrides.
  font: inherit;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  // Padding intentionally 0 vertical — height is set explicitly so the
  // compute-pill and the inline quota-meter pill match pixel-for-pixel.
  // Height must agree with .inline .collapsed-row in ChatQuotaHeader.vue.
  padding: 0 8px;
  height: 24px;
  box-sizing: border-box;
  font-size: 12px;
  line-height: 1;
  color: #1c1c1c;
  cursor: pointer;

  &:hover { border-color: theme.$purple_3; color: theme.$purple_3; }

  &.unset {
    background: theme.$purple_3;
    color: #fff;
    border-color: theme.$purple_3;
  }
  &.unset:hover {
    background: color.adjust(theme.$purple_3, $lightness: -8%);
    border-color: color.adjust(theme.$purple_3, $lightness: -8%);
    color: #fff;
  }
}

.compute-name { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.header-actions { display: flex; gap: 8px; }

.header-btn {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  color: #1c1c1c;
  cursor: pointer;

  &:hover { background: #f0f2f5; }
  &.active { background: #f0f2f5; border-color: theme.$purple_3; }
}

// Anchor for the History popover. The ChatSessionMenu positions itself
// absolutely against this wrapper so it drops below the History button.
.history-wrap { position: relative; }

// Quick-compose button is a tighter, icon-style trigger. The label
// ("⌘K" / "Ctrl+K") doubles as both the affordance and the keyboard-
// shortcut hint, so there's no need for a separate label.
.quick-compose {
  padding: 4px 6px;
  display: inline-flex;
  align-items: center;
  gap: 0;

  .kbd-inline {
    font-size: 11px;
    color: #6b7280;
    background: #f3f4f6;
    padding: 1px 6px;
    border-radius: 3px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.4;
  }

  &:hover .kbd-inline {
    background: #e5e7eb;
    color: #1f2937;
  }
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #fde8e8;
  color: #9b1c1c;
  font-size: 13px;
  border-bottom: 1px solid #f8c5c5;
}

.dismiss {
  background: none;
  border: none;
  color: inherit;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
}

.error-cta {
  display: inline-block;
  margin-left: 6px;
  color: inherit;
  font-weight: 600;
  text-decoration: underline;
  &:hover { opacity: 0.85; }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 24px 16px;
  text-align: center;
  gap: 16px;
}

.empty-title {
  font-size: 16px;
  font-weight: 500;
  color: #1c1c1c;
  margin: 0;
  max-width: 480px;
  line-height: 1.5;
}

.empty-hint {
  font-size: 13px;
  color: #888;
  margin: 0;
  max-width: 480px;
  line-height: 1.5;

  kbd {
    display: inline-block;
    padding: 0 6px;
    background: #f1f3f5;
    border: 1px solid #e0e2e5;
    border-radius: 4px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: #1c1c1c;
  }
}

.empty-state :deep(.chat-starter-prompts) {
  padding: 0;
  width: 100%;
}

.empty-state :deep(.chat-starter-prompts .hint) {
  text-align: center;
}

.empty-state :deep(.chat-starter-prompts .chips) {
  justify-content: center;
}

// Dedicated empty state when no LLM-capable compute node is available.
.empty-state.no-nodes {
  gap: 12px;
}

.empty-illustration {
  width: 200px;
  height: auto;
  max-width: 70%;
  opacity: 0.9;
  margin-bottom: 8px;

  // Used in the "ready to chat" empty state — smaller, less dominant
  // than the no-nodes hero illustration.
  &.small {
    width: 140px;
    max-width: 55%;
    margin-bottom: 8px;
    opacity: 0.9;
  }
}

.empty-state.no-nodes .empty-title {
  font-size: 18px;
  font-weight: 600;
  color: #1c1c1c;
  margin: 0;
}

.empty-body {
  font-size: 14px;
  color: #555;
  margin: 0;
  max-width: 420px;
  line-height: 1.5;
}

.empty-secondary {
  font-size: 13px;
  color: #666;
  margin: 4px 0 0;
}

.empty-cta {
  display: inline-block;
  margin-top: 8px;
  padding: 8px 16px;
  background: theme.$purple_3;
  color: #fff;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.15s ease;

  &:hover { background: color.adjust(theme.$purple_3, $lightness: -8%); }
}

.empty-docs-link {
  display: inline-block;
  margin-top: 4px;
  font-size: 13px;
  color: theme.$purple_3;
  text-decoration: none;

  &:hover { text-decoration: underline; }
}
</style>
