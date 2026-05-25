<template>
  <!-- Teleport to body so the modal isn't constrained by parent
       overflow / z-index / transform contexts that vary page to page.
       Owning the DOM ourselves (vs. <el-dialog>) avoids the global
       dialog stylesheet leaking into our chrome. -->
  <Teleport to="body">
    <transition name="spotlight-fade">
      <div
        v-if="visible"
        class="spotlight-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Ask Insights"
        @mousedown.self="close"
      >
        <div class="spotlight-modal" @mousedown.stop>
          <!-- Optional chip row, only when current page has a known
               entity AND the user hasn't dismissed it for this compose.
               Removing the chip lets the user ask a workspace-level
               question from a dataset / file page without dragging in
               that context. Reset on next modal open. -->
          <div v-if="contextChip" class="chip-row">
            <div class="context-chip">
              <span class="context-icon" aria-hidden="true">
                {{ contextChip.icon }}
              </span>
              <span class="context-name">{{ contextChip.label }}</span>
              <button
                type="button"
                class="chip-remove"
                :aria-label="`Remove ${contextChip.label} attachment`"
                @click="dismissChip"
              >×</button>
            </div>
            <span class="kbd-badge" aria-hidden="true">{{ cmdKLabel }}</span>
          </div>

          <!-- Compute-node guardrail. -->
          <div v-if="!hasComputeNode" class="setup-required">
            <span>Set up your chat compute node first.</span>
            <router-link
              :to="{ name: 'workspace-insights', params: { orgId } }"
              class="setup-link"
              @click="close"
            >
              Open Insights →
            </router-link>
          </div>

          <!-- Input row — the prominent thing. Textarea looks like a
               single growing input until the user types past one line.
               Send button sits inline on the right. -->
          <div v-else class="input-row">
            <textarea
              ref="textareaRef"
              v-model="prompt"
              class="spotlight-input"
              rows="1"
              :placeholder="placeholder"
              @keydown="onKeydown"
              @input="autoResize"
            />
            <button
              type="button"
              class="send-btn"
              :disabled="!canSend"
              aria-label="Send and open chat"
              @click="onSendAndNavigate"
            >
              <span aria-hidden="true">→</span>
            </button>
            <!-- ⌘K badge only shows here when no chip row above
                 absorbed it (i.e. no current-page entity). -->
            <span v-if="!contextChip" class="kbd-badge" aria-hidden="true">⌘K</span>
          </div>

          <div class="hint-row">
            <kbd>Enter</kbd> send + open chat ·
            <kbd>{{ cmdKLabel === '⌘K' ? '⌘↩' : 'Ctrl+↩' }}</kbd>
            send + stay here ·
            <kbd>⇧↩</kbd> newline ·
            <kbd>Esc</kbd> close
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
// Spotlight — global compose modal for the org-level chat.
//
// Design (see chat-integration follow-up):
//
//   - Single org-wide chat session lives on the Insights page. Spotlight
//     is a CAPTURE surface, not a second chat surface — its only job is
//     to enqueue a user turn into that same conversation.
//   - The current-page entity (file detail page → file; dataset page →
//     dataset; nothing elsewhere) gets auto-attached as a context chip
//     and inlined into the prompt body as a structured `[Attached file:
//     <name> (<packageId>) in dataset <datasetId>]` prefix.
//   - Fire-and-forget: send → toast → close. User navigates to Insights
//     via the left-nav link to see the assistant's reply.
//
// Implementation note: we own the modal DOM directly via <Teleport> +
// raw markup rather than going through <el-dialog>. Reason: the global
// styles/element/_dialog.scss partial that several pages import applies
// a heavy header/footer styling that bled into Spotlight and made the
// modal look broken on those pages. Owning the DOM gives us a clean,
// page-independent visual.

import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useStore as useVuexStore } from 'vuex'
import { ElMessage } from 'element-plus'
import { pathOr } from 'ramda'

import { useChatStore, getRememberedComputeNode } from '@/stores/chatStore'
import { useChatSocket } from '@/composables/useChatSocket'
import { useRouteContext } from '@/composables/useRouteContext'
import { cmdKLabel } from '@/utils/platform'

const props = defineProps({
  visible: { type: Boolean, required: true },
})

const emit = defineEmits(['update:visible'])

const vuex = useVuexStore()
const router = useRouter()
const chatStore = useChatStore()
const { sendUserMessage } = useChatSocket()
const { context } = useRouteContext()

const prompt = ref('')
const textareaRef = ref(null)

// When true, suppress the auto-attached context chip for this compose.
// Set by the chip's ✕ button. Reset every time the modal opens so the
// default "attach what the user is currently looking at" is the starting
// state on every invocation.
const chipDismissed = ref(false)
const dismissChip = () => {
  chipDismissed.value = true
}

// ---------------------------------------------------------------------------
// Active workspace + remembered compute node
// ---------------------------------------------------------------------------

const orgId = computed(() =>
  pathOr('', ['organization', 'id'], vuex.getters.activeOrganization),
)

const computeNodeId = computed(() => {
  if (!orgId.value) return null
  return getRememberedComputeNode(orgId.value)
})

const hasComputeNode = computed(() => Boolean(computeNodeId.value))

// ---------------------------------------------------------------------------
// Context chip
// ---------------------------------------------------------------------------

// Effective context attached to this compose — null when the user
// dismissed the chip OR when there's no current-page entity in the
// first place. Used for both render (chip visible / hidden) and send
// (formatPromptWithContext skips when null).
const effectiveContext = computed(() =>
  chipDismissed.value ? null : context.value,
)

const contextChip = computed(() => {
  const c = effectiveContext.value
  if (!c) return null
  if (c.type === 'file') {
    return { icon: '📄', label: c.name || 'This file' }
  }
  if (c.type === 'dataset') {
    return { icon: '📁', label: c.name || 'This dataset' }
  }
  return null
})

const placeholder = computed(() => {
  const c = effectiveContext.value
  if (c?.type === 'file') return 'Ask about this file…'
  if (c?.type === 'dataset') return 'Ask about this dataset…'
  return 'Ask anything about your workspace…'
})

// ---------------------------------------------------------------------------
// Send path
// ---------------------------------------------------------------------------

const canSend = computed(
  () => hasComputeNode.value && Boolean(prompt.value.trim()),
)

// dispatchPrompt — shared core of both send-modes (fire-and-forget +
// send-and-navigate). Captures the compose state synchronously, closes
// the modal immediately, then fires the WebSocket send in the
// background.
//
// Ordering note: `close()` runs BEFORE the WS send so that:
//   1. The user can't double-fire by hitting Enter again while the
//      send is in-flight (the textarea is gone after close).
//   2. Resetting `prompt.value` to '' also flips `canSend` to false —
//      belt-and-suspenders guard if a stray Enter event still fires
//      against the textarea during Vue's render-flush window.
//   3. The visible latency between Enter and modal close stays at
//      zero regardless of WS send speed.
//
// The send itself is fire-and-forget. The chat store's
// markFailedTurn path surfaces any error in the chat panel's error
// banner when the user reaches Insights; no modal-side error UI is
// needed for the optimistic fire-and-forget UX.
//
// Attachments are passed as structured metadata (NOT inlined into the
// prompt text) so the chat thread can render them as chips above the
// user's prose. useChatSocket re-derives the `[Attached file: …]`
// prefix for the wire when serializing — see serializeUserContent.
const dispatchPrompt = () => {
  const payload = {
    mode: 'workspace',
    orgId: orgId.value,
    datasetId: null,
    computeNodeId: computeNodeId.value,
    content: prompt.value.trim(),
    attachments: contextToAttachments(effectiveContext.value),
  }
  prompt.value = ''
  close()
  // Fire-and-forget; .catch keeps an unhandled-rejection warning out
  // of the console. Real failures land in the store.
  sendUserMessage(payload).catch(() => {})
}

// Default send — fire-and-forget. User stays on whatever page they
// were composing from; toast confirms the message landed.
const onSend = () => {
  if (!canSend.value) return
  dispatchPrompt()
  ElMessage({
    type: 'success',
    message: 'Sent to your Insights chat',
    duration: 3000,
  })
}

// Cmd/Ctrl+Enter alternative — send AND immediately navigate to
// Insights so the user can watch the reply unfold. Same dispatch path;
// the only difference is the post-send router push.
const onSendAndNavigate = () => {
  if (!canSend.value) return
  dispatchPrompt()
  router.push({ name: 'workspace-insights', params: { orgId: orgId.value } })
}

// Translate the route-context shape (file or dataset) into the
// chat-store attachments shape (an array). Kept tiny — same fields,
// just normalized into the form the store + socket expect.
function contextToAttachments(ctx) {
  if (!ctx) return []
  if (ctx.type === 'file') {
    return [{
      type: 'file',
      packageId: ctx.packageId,
      datasetId: ctx.datasetId,
      name: ctx.name || null,
    }]
  }
  if (ctx.type === 'dataset') {
    return [{
      type: 'dataset',
      datasetId: ctx.datasetId,
      name: ctx.name || null,
    }]
  }
  return []
}

// ---------------------------------------------------------------------------
// Lifecycle / keyboard
// ---------------------------------------------------------------------------

const close = () => emit('update:visible', false)

const onKeydown = (e) => {
  if (e.key !== 'Enter' || e.isComposing) return
  // Shift+Enter inserts a newline (default textarea behavior).
  if (e.shiftKey) return
  e.preventDefault()
  // Enter = send + navigate to Insights so the user can see the
  // reply. Cmd+Enter / Ctrl+Enter = fire-and-forget (stay on
  // current page). Enter as the primary "do the thing" action
  // matches what users expect when they think of the modal as
  // "compose a message to the assistant".
  if (e.metaKey || e.ctrlKey) {
    onSend()
  } else {
    onSendAndNavigate()
  }
}

// Auto-grow the textarea as the user types so the modal stays compact
// at rest (one line) but expands gracefully for longer prompts. Caps at
// ~6 rows worth so a runaway paste doesn't push the modal off-screen.
const autoResize = () => {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  const max = 160 // px ~= 6 lines at 14px / 1.4 line-height + padding
  el.style.height = Math.min(el.scrollHeight, max) + 'px'
}

// Esc handler at the backdrop level (Teleported to body, so document
// keydown listener mounted with the modal). Bound while visible, removed
// when closed so we don't intercept Esc when the modal is hidden.
let escHandler = null
watch(
  () => props.visible,
  async (open) => {
    if (open) {
      await nextTick()
      textareaRef.value?.focus()
      escHandler = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          close()
        }
      }
      document.addEventListener('keydown', escHandler)
    } else {
      prompt.value = ''
      // Reset auto-grown height so the next open starts at 1 row.
      if (textareaRef.value) textareaRef.value.style.height = ''
      // Restore default-attach behavior on the next invocation —
      // dismiss is intentionally per-compose, not persistent.
      chipDismissed.value = false
      if (escHandler) {
        document.removeEventListener('keydown', escHandler)
        escHandler = null
      }
    }
  },
)

// Pre-warm the conversation entry so chat-store side state exists by
// the time the user hits send. ensureConversation is idempotent.
watch(
  () => [orgId.value, computeNodeId.value, props.visible],
  ([newOrg, newNode, isOpen]) => {
    if (!isOpen || !newOrg || !newNode) return
    chatStore.ensureConversation({
      mode: 'workspace',
      orgId: newOrg,
      datasetId: null,
      computeNodeId: newNode,
    })
  },
)
</script>

<style scoped lang="scss">
@use '../../styles/theme';

// Backdrop: subtle dimmer, modal hovers near the top third of the
// viewport like Raycast / Linear's command palette — not center, so the
// user's eye lands on it immediately without it covering page content
// they were looking at. Z-index outranks Element Plus overlays
// (defaults ~2000).
.spotlight-backdrop {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 14vh;
  background: rgba(15, 23, 42, 0.28);
  backdrop-filter: blur(2px);
}

.spotlight-modal {
  width: 560px;
  max-width: calc(100vw - 32px);
  background: theme.$white;
  border-radius: 12px;
  // Shadow uses navy tint (theme.$purple_3 = #011F5B) so the depth
  // cue matches the brand color rather than a generic black drop.
  box-shadow:
    0 24px 48px rgba(theme.$purple_3, 0.22),
    0 6px 14px rgba(theme.$purple_3, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

// Top chip row — only rendered when a current-page entity attached.
// Sits flush against the input row below; the whole modal reads as one
// connected surface.
.chip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 0;
  gap: 8px;
}

.context-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px 4px 10px;
  background: theme.$purple_tint;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  min-width: 0;

  .context-icon {
    flex-shrink: 0;
    font-size: 11px;
  }
  .context-name {
    font-weight: 600;
    color: theme.$gray_6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 280px;
  }
  .chip-remove {
    background: transparent;
    border: none;
    color: theme.$gray_4;
    font-size: 16px;
    line-height: 1;
    padding: 0 4px;
    cursor: pointer;
    border-radius: 4px;
    flex-shrink: 0;

    // Subtle darken on hover via a navy overlay — stays in palette
    // without jumping to a contrast-heavy $purple_0_7 fill.
    &:hover {
      background: rgba(theme.$purple_3, 0.08);
      color: theme.$gray_6;
    }
  }
}

// Compact ⌘K badge. Doubles as the close affordance — clicking it
// dismisses the modal. Saves a separate ✕ button.
.kbd-badge {
  font-size: 11px;
  color: theme.$gray_5;
  background: theme.$gray_0;
  padding: 2px 7px;
  border-radius: 4px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  flex-shrink: 0;
}

// Main input row — the single tall element of the modal. Input grows
// to fill horizontal space; send button is a small icon-sized button on
// the right.
.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
}

.spotlight-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.4;
  resize: none;
  padding: 4px 0;
  color: theme.$gray_6;
  // 1-row height by default; autoResize() bumps it up to 160px max.
  // Don't expose vertical resize handles.
  min-height: 22px;

  &::placeholder {
    color: theme.$gray_4;
  }
}

.send-btn {
  background: theme.$purple_3;
  color: theme.$white;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;

  &:disabled {
    background: theme.$gray_2;
    color: theme.$gray_4;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    filter: brightness(1.15);
  }
}

// Compute-node setup-required state. Replaces the input-row entirely.
// Uses the yellow_tint / yellow_2 pair so the warning reads against
// rest of platform's yellow-status convention.
.setup-required {
  margin: 10px 14px 0;
  padding: 10px 14px;
  background: theme.$yellow_tint;
  border: 1px solid theme.$yellow_2;
  color: theme.$gray_6;
  border-radius: 4px;
  font-size: 13px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: baseline;

  .setup-link {
    color: theme.$purple_3;
    font-weight: 600;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

// Subtle hint footer — separator above, very small text.
.hint-row {
  padding: 6px 14px 10px;
  border-top: 1px solid theme.$gray_1;
  font-size: 11px;
  color: theme.$gray_4;

  kbd {
    background: theme.$gray_1;
    border: 1px solid theme.$gray_2;
    border-radius: 3px;
    padding: 0 4px;
    font-size: 10px;
    font-family: inherit;
    color: theme.$gray_5;
    margin: 0 1px;
  }
}

// Enter/exit transition for the backdrop+modal combo.
.spotlight-fade-enter-active,
.spotlight-fade-leave-active {
  transition: opacity 120ms ease;
}
.spotlight-fade-enter-from,
.spotlight-fade-leave-to {
  opacity: 0;
}
</style>
