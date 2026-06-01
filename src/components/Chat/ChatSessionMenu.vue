<template>
  <!-- History dropdown: a compact popover listing recent chat sessions for
       the active workspace. Self-loads its data from the chat-sessions REST
       API on open; emits `resume` with a session id when a row is clicked.
       Rename is inline; pin/delete act in place. Kept intentionally small so
       it doesn't crowd the chat header. -->
  <div v-if="visible" class="session-menu" ref="root">
    <div class="menu-header">
      <span class="menu-title">Chat history</span>
      <button type="button" class="icon-btn" aria-label="Close" @click="close">×</button>
    </div>

    <div v-if="loading && !sessions.length" class="menu-state">Loading…</div>
    <div v-else-if="error" class="menu-state error">
      Couldn't load history.
      <button type="button" class="link-btn" @click="reload">Retry</button>
    </div>
    <div v-else-if="!sessions.length" class="menu-state">No saved chats yet.</div>

    <ul v-else class="session-list">
      <li
        v-for="s in sortedSessions"
        :key="s.id"
        class="session-row"
        :class="{ pinned: s.pinned, active: s.id === activeId }"
        @mouseleave="resetConfirm(s.id)"
      >
        <!-- Inline rename mode replaces the row's clickable label. -->
        <template v-if="editingId === s.id">
          <input
            ref="editInput"
            v-model="editTitle"
            class="edit-input"
            type="text"
            :placeholder="placeholderFor(s)"
            @keydown.enter.prevent="commitRename(s)"
            @keydown.esc.prevent="cancelRename"
            @blur="commitRename(s)"
          />
        </template>
        <template v-else>
          <button
            type="button"
            class="row-main"
            :title="titleFor(s)"
            @click="$emit('resume', s)"
          >
            <span v-if="s.pinned" class="pin-star" aria-hidden="true">★</span>
            <span class="row-title">{{ titleFor(s) }}</span>
            <span class="row-time">{{ relativeTime(s.lastActiveAt) }}</span>
          </button>

          <!-- Inline actions, revealed on row hover/focus. No nested popover
               (which got clipped by the dropdown's overflow) — just three
               icon buttons that sit in the row's trailing edge. -->
          <div class="row-actions">
            <button
              type="button"
              class="icon-btn"
              :class="{ on: s.pinned }"
              :title="s.pinned ? 'Unpin' : 'Pin'"
              :aria-label="s.pinned ? `Unpin ${titleFor(s)}` : `Pin ${titleFor(s)}`"
              @click.stop="togglePin(s)"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 1l2.06 4.18 4.61.67-3.34 3.25.79 4.6L8 11.6 3.88 13.7l.79-4.6L1.33 5.85l4.61-.67z" />
              </svg>
            </button>
            <button
              type="button"
              class="icon-btn"
              title="Rename"
              :aria-label="`Rename ${titleFor(s)}`"
              @click.stop="startRename(s)"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2 11.5V14h2.5l7.37-7.37-2.5-2.5L2 11.5zM13.7 4.2a.66.66 0 000-.94l-1.56-1.56a.66.66 0 00-.94 0l-1.22 1.22 2.5 2.5 1.22-1.22z" />
              </svg>
            </button>
            <button
              type="button"
              class="icon-btn danger"
              :class="{ confirm: confirmingDeleteId === s.id }"
              :title="confirmingDeleteId === s.id ? 'Click again to delete' : 'Delete'"
              :aria-label="confirmingDeleteId === s.id ? `Confirm delete ${titleFor(s)}` : `Delete ${titleFor(s)}`"
              @click.stop="onDelete(s)"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M6 2V1h4v1h3v1.5H3V2h3zm-2.2 3h8.4l-.7 8.1a1 1 0 01-1 .9H5.5a1 1 0 01-1-.9L3.8 5z" />
              </svg>
            </button>
          </div>
        </template>
      </li>
    </ul>

    <button
      v-if="nextCursor && !loading"
      type="button"
      class="load-more"
      @click="loadMore"
    >Load older…</button>
    <div v-else-if="loading && sessions.length" class="menu-state">Loading…</div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useChatSessions } from '@/composables/useChatSessions'

const props = defineProps({
  visible: { type: Boolean, default: false },
  // The sessionId of the conversation currently loaded in the panel, so the
  // matching row can be marked as active.
  activeId: { type: String, default: null },
})
const emit = defineEmits(['update:visible', 'resume'])

const { listSessions, renameSession, setPinned, deleteSession } = useChatSessions()

const sessions = ref([])
const nextCursor = ref(null)
const loading = ref(false)
const error = ref(false)

const editingId = ref(null)
const editTitle = ref('')
const editInput = ref(null)
const confirmingDeleteId = ref(null)
const root = ref(null)

// Pinned sessions float to the top; within each group most-recently-active
// first. The server may already order this way, but we don't rely on it.
const sortedSessions = computed(() =>
  [...sessions.value].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return new Date(b.lastActiveAt) - new Date(a.lastActiveAt)
  })
)

const placeholderFor = (s) => s.lastMessagePreview || 'Untitled chat'
const titleFor = (s) =>
  (s.title && s.title.trim()) || s.lastMessagePreview || 'Untitled chat'

const relativeTime = (iso) => {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const secs = Math.round((Date.now() - then) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

const load = async ({ append = false } = {}) => {
  loading.value = true
  error.value = false
  try {
    const res = await listSessions({ cursor: append ? nextCursor.value : undefined })
    const incoming = res?.sessions || []
    sessions.value = append ? [...sessions.value, ...incoming] : incoming
    nextCursor.value = res?.nextCursor || null
  } catch (e) {
    console.error('chat: failed to load sessions', e)
    error.value = true
  } finally {
    loading.value = false
  }
}

const reload = () => load()
const loadMore = () => load({ append: true })

const close = () => emit('update:visible', false)

// Disarm a pending delete-confirm when the pointer leaves the row, so an
// armed trash icon doesn't linger after the user moves on.
const resetConfirm = (id) => {
  if (confirmingDeleteId.value === id) confirmingDeleteId.value = null
}

const startRename = async (s) => {
  editingId.value = s.id
  editTitle.value = (s.title && s.title.trim()) || ''
  await nextTick()
  const el = Array.isArray(editInput.value) ? editInput.value[0] : editInput.value
  el?.focus()
  el?.select()
}

const cancelRename = () => {
  editingId.value = null
  editTitle.value = ''
}

const commitRename = async (s) => {
  if (editingId.value !== s.id) return
  const next = editTitle.value.trim()
  editingId.value = null
  // No change (or cleared to match an already-empty title) — skip the call.
  if (next === ((s.title && s.title.trim()) || '')) return
  try {
    const updated = await renameSession(s.id, next)
    patchSession(s.id, updated || { ...s, title: next })
  } catch (e) {
    console.error('chat: rename failed', e)
  }
}

const togglePin = async (s) => {
  try {
    const updated = await setPinned(s.id, !s.pinned)
    patchSession(s.id, updated || { ...s, pinned: !s.pinned })
  } catch (e) {
    console.error('chat: pin toggle failed', e)
  }
}

const onDelete = async (s) => {
  // Two-step confirm in place: first click arms, second click deletes.
  if (confirmingDeleteId.value !== s.id) {
    confirmingDeleteId.value = s.id
    return
  }
  confirmingDeleteId.value = null
  try {
    await deleteSession(s.id)
    sessions.value = sessions.value.filter((x) => x.id !== s.id)
  } catch (e) {
    console.error('chat: delete failed', e)
  }
}

const patchSession = (id, next) => {
  const idx = sessions.value.findIndex((x) => x.id === id)
  if (idx !== -1) sessions.value[idx] = { ...sessions.value[idx], ...next }
}

// Click outside the popover closes it. Inside clicks are left alone — the
// delete-confirm is a two-step (arm → confirm), and this runs in the capture
// phase ahead of the button handlers, so disarming here would cancel the
// confirm before onDelete sees it. Disarming is handled by row mouseleave
// and by arming a different row instead.
const onDocClick = (e) => {
  if (root.value && !root.value.contains(e.target)) {
    emit('update:visible', false)
  }
}

watch(
  () => props.visible,
  (open) => {
    if (open) {
      load()
      document.addEventListener('click', onDocClick, true)
    } else {
      document.removeEventListener('click', onDocClick, true)
      cancelRename()
      confirmingDeleteId.value = null
    }
  }
)

onBeforeUnmount(() => document.removeEventListener('click', onDocClick, true))
</script>

<style scoped lang="scss">
@use '../../styles/theme';

.session-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  width: 300px;
  max-height: 380px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e0e2e5;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #eef0f2;
}
.menu-title { font-size: 12px; font-weight: 600; color: #1c1c1c; }

.menu-state {
  padding: 16px 12px;
  font-size: 13px;
  color: #888;
  text-align: center;

  &.error { color: #9b1c1c; }
}

.session-list {
  list-style: none;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
}

.session-row {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  position: relative;

  &:hover { background: #f5f6f8; }
  &.pinned .row-title { font-weight: 500; }

  // The session currently loaded in the panel — a left accent + tint so
  // it reads as "you're here" without competing with hover.
  &.active {
    // Square off the corners — the left accent bar reads as a clipped
    // sliver against the row's rounded corners otherwise.
    border-radius: 0;
    background: rgba(theme.$purple_3, 0.08);
    box-shadow: inset 3px 0 0 theme.$purple_3;

    .row-title { color: theme.$purple_3; font-weight: 500; }
  }
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  text-align: left;
  padding: 8px;
  cursor: pointer;
  font: inherit;
}

.pin-star { color: theme.$purple_3; font-size: 11px; flex: none; }

.row-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #1c1c1c;
}

.row-time { flex: none; font-size: 11px; color: #9aa0a6; }

// Trailing inline action cluster. Hidden until the row is hovered or has
// keyboard focus inside, so resting rows stay clean. Sits in-flow at the
// row's edge — no popover to clip or overlay neighbouring rows.
.row-actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 2px;
  padding-right: 4px;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.session-row:hover .row-actions,
.session-row:focus-within .row-actions { opacity: 1; }

// Keep an armed delete visible even if the pointer drifts off the icon
// (still within the row), so the confirm affordance doesn't vanish.
.row-actions:has(.danger.confirm) { opacity: 1; }

// The close (×) button in the header is also an .icon-btn.
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 4px;
  border-radius: 4px;

  svg { width: 14px; height: 14px; fill: currentColor; display: block; }

  &:hover { background: #e8eaed; color: #1c1c1c; }
  &.on { color: theme.$purple_3; }
  &.danger:hover { background: #fde8e8; color: #9b1c1c; }
  &.danger.confirm {
    background: #9b1c1c;
    color: #fff;
  }
}

.edit-input {
  flex: 1;
  margin: 4px 8px;
  padding: 6px 8px;
  font: inherit;
  font-size: 13px;
  border: 1px solid theme.$purple_3;
  border-radius: 4px;
  outline: none;
}

.load-more {
  background: none;
  border: none;
  border-top: 1px solid #eef0f2;
  padding: 8px;
  font-size: 12px;
  color: theme.$purple_3;
  cursor: pointer;

  &:hover { background: #f5f6f8; }
}

.link-btn {
  background: none;
  border: none;
  color: theme.$purple_3;
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
  padding: 0 0 0 4px;
}
</style>
