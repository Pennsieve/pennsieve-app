<template>
  <div class="chat-input-wrap">
    <!-- @-mention popup: appears above the input when the user types
         "@" followed by characters that match a workspace dataset. -->
    <div
      v-if="mention.active && filteredMatches.length"
      class="mention-popup"
      role="listbox"
    >
      <div
        v-for="(item, idx) in filteredMatches"
        :key="item.id"
        class="mention-item"
        :class="{ active: idx === mention.selectedIndex }"
        role="option"
        :aria-selected="idx === mention.selectedIndex"
        @mousedown.prevent="selectMention(item)"
        @mouseenter="mention.selectedIndex = idx"
      >
        <span class="mention-prefix">@</span>
        <span class="mention-name">{{ item.name }}</span>
      </div>
    </div>

    <div class="chat-input">
      <textarea
        ref="textareaEl"
        v-model="text"
        :placeholder="placeholder"
        :disabled="disabled"
        rows="1"
        @keydown="onKeydown"
        @input="onInput"
      />
      <button class="send-btn" :disabled="disabled || !text.trim()" @click="submit" aria-label="Send message">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 8 14 1.5 8.5 14.5 6.5 9 1.5 8z" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Ask about your workspace…' },
  // Workspace datasets used for @-mention autocomplete.
  // Each entry should be at least `{ id, name }`.
  datasets: { type: Array, default: () => [] },
})

const emit = defineEmits(['submit'])

const text = ref('')
const textareaEl = ref(null)

// @-mention state: tracks where the trigger started in the text and
// the partial query the user has typed since.
const mention = reactive({
  active: false,
  query: '',
  startIndex: -1,
  endIndex: -1,
  selectedIndex: 0,
})

const filteredMatches = computed(() => {
  if (!mention.active) return []
  const q = (mention.query || '').toLowerCase()
  return (props.datasets || [])
    .filter((d) => d?.name)
    .filter((d) => !q || d.name.toLowerCase().includes(q))
    .slice(0, 8)
})

const submit = () => {
  const value = text.value.trim()
  if (!value || props.disabled) return
  emit('submit', value)
  text.value = ''
  cancelMention()
  nextTick(autoResize)
}

const cancelMention = () => {
  mention.active = false
  mention.query = ''
  mention.startIndex = -1
  mention.endIndex = -1
  mention.selectedIndex = 0
}

const selectMention = (item) => {
  if (!item) return
  const value = text.value
  const before = mention.startIndex >= 0 ? value.slice(0, mention.startIndex) : value
  const after = mention.endIndex >= 0 ? value.slice(mention.endIndex) : ''
  // Insert the dataset name (no node ID — the backend's list_datasets
  // tool resolves the name when the assistant acts on it).
  const inserted = `@${item.name} `
  text.value = before + inserted + after
  cancelMention()
  nextTick(() => {
    const pos = (before + inserted).length
    textareaEl.value?.setSelectionRange(pos, pos)
    textareaEl.value?.focus()
    autoResize()
  })
}

// Detect the start of an @-mention near the cursor and update mention
// state. We only trigger when "@" is at the start of the value or
// preceded by whitespace (so emails / unrelated @'s in text don't
// fire the picker).
const updateMentionFromInput = () => {
  const el = textareaEl.value
  if (!el) {
    cancelMention()
    return
  }
  const value = text.value
  const cursorPos = el.selectionStart ?? value.length

  let mentionStart = -1
  for (let i = cursorPos - 1; i >= 0; i--) {
    const ch = value[i]
    if (ch === '@') {
      if (i === 0 || /\s/.test(value[i - 1])) {
        mentionStart = i
      }
      break
    }
    // Stop scanning when we hit whitespace — that ends any potential mention.
    if (/\s/.test(ch)) break
  }

  if (mentionStart >= 0) {
    const query = value.slice(mentionStart + 1, cursorPos)
    if (!query.includes(' ')) {
      mention.active = true
      mention.query = query
      mention.startIndex = mentionStart
      mention.endIndex = cursorPos
      // Reset highlight only when the query string changes.
      if (mention.selectedIndex >= filteredMatches.value.length) {
        mention.selectedIndex = 0
      }
      return
    }
  }
  cancelMention()
}

const onInput = () => {
  updateMentionFromInput()
  autoResize()
}

const onKeydown = (e) => {
  // When the mention popup is open, intercept nav keys.
  if (mention.active && filteredMatches.value.length) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mention.selectedIndex = (mention.selectedIndex + 1) % filteredMatches.value.length
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const n = filteredMatches.value.length
      mention.selectedIndex = (mention.selectedIndex - 1 + n) % n
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      selectMention(filteredMatches.value[mention.selectedIndex])
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      selectMention(filteredMatches.value[mention.selectedIndex])
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelMention()
      return
    }
  }
  // Normal submit on Enter (no shift).
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

const autoResize = () => {
  const el = textareaEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}
</script>

<style scoped lang="scss">
@use 'sass:color';
@use '../../styles/theme';

.chat-input-wrap {
  position: relative;
}

.chat-input {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e8e8e8;
  background: #fff;
}

textarea {
  flex: 1;
  resize: none;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  line-height: 1.5;
  font-family: inherit;
  outline: none;
  max-height: 160px;
  overflow-y: auto;
  background: #fff;

  &:focus { border-color: theme.$purple_3; }
  &:disabled { background: #f6f6f6; cursor: not-allowed; }
}

.send-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: theme.$purple_3;
  color: #fff;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:disabled { background: #c5cbd6; cursor: not-allowed; }
  &:not(:disabled):hover { background: color.adjust(theme.$purple_3, $lightness: -8%); }
}

// @-mention autocomplete popup — sits above the textarea so it's
// visible without scrolling the chat input out of view.
.mention-popup {
  position: absolute;
  bottom: calc(100% - 8px);
  left: 16px;
  right: 16px;
  max-width: 400px;
  max-height: 240px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(16, 24, 40, 0.08);
  padding: 4px 0;
  z-index: 10;
}

.mention-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 13px;
  color: #1c1c1c;
  cursor: pointer;
  user-select: none;

  &.active {
    background: #f1f3f5;
  }
}

.mention-prefix {
  color: #888;
  font-weight: 500;
}

.mention-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
