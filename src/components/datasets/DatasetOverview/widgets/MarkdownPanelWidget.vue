<template>
  <slot :widgetName="widgetName" :childIcons="childIcons" />
  <div class="markdown-panel-widget" :class="{ editing: isEditing }">
    <markdown-editor
      :value="resolvedValue"
      :is-editing="isEditing"
      :is-saving="isSaving"
      :empty-state="emptyState"
      :is-loading="resolvedIsLoading"
      @save="handleEditorSave"
    />
    <div v-if="isEditing" class="editor-footer">
      <button
        type="button"
        class="footer-btn cancel"
        @click="cancelEdit"
        :disabled="isSaving"
      >Cancel</button>
      <button
        type="button"
        class="footer-btn save"
        @click="commitSave"
        :disabled="locked || isSaving"
      >Save</button>
    </div>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed } from 'vue'
import { useStore } from 'vuex'
import { Edit } from '@element-plus/icons-vue'
import MarkdownEditor from '@/components/shared/MarkdownEditor/MarkdownEditor.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  // Static markdown text. Used when `valueStoreKey` isn't set.
  value: { type: String, default: '' },
  // Vuex state field to read the markdown from (reactive). Preferred over
  // `value` for content that updates asynchronously (e.g. after the
  // dataset finishes loading or after a save).
  valueStoreKey: { type: String, default: null },
  // Vuex state field to read the loading flag from.
  isLoadingStoreKey: { type: String, default: null },
  emptyState: { type: String, default: '# Enter a value' },
  locked: { type: Boolean, default: false },
  isLoading: { type: Boolean, default: false },
  // Async callback invoked with the saved markdown. Should return a Promise
  // (resolve = success, reject = failure). The widget keeps the editor open
  // on rejection so the user can retry.
  onSave: { type: Function, default: () => Promise.resolve() },
  // Lib-injected props.
  widgetName: { type: String, default: 'Markdown' },
  widgetID: { type: String, default: '' },
  hideHeader: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
})

const store = useStore()

const resolvedValue = computed(() =>
  props.valueStoreKey ? store.state[props.valueStoreKey] ?? '' : props.value
)
const resolvedIsLoading = computed(() =>
  props.isLoadingStoreKey ? !!store.state[props.isLoadingStoreKey] : props.isLoading
)

const isEditing = ref(false)
const isSaving = ref(false)

const editIcon = shallowRef(Edit)

const childIcons = computed(() =>
  isEditing.value || props.locked
    ? []
    : [{ comp: editIcon.value, event: () => (isEditing.value = true), tooltip: 'Edit' }]
)

const commitSave = () => {
  // MarkdownEditor watches isSaving and emits @save with current markdown.
  isSaving.value = true
}

const cancelEdit = () => {
  isEditing.value = false
  isSaving.value = false
}

const handleEditorSave = async (markdown) => {
  try {
    await Promise.resolve(props.onSave?.(markdown))
    isSaving.value = false
    isEditing.value = false
  } catch (e) {
    // Leave the editor open on failure so the user can retry.
    isSaving.value = false
  }
}
</script>

<style scoped lang="scss">
.markdown-panel-widget {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 16px 12px;
}

.markdown-panel-widget :deep(> :first-child) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f1f3f5;
  margin-top: 12px;
}

.footer-btn {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
  color: #1c1c1c;

  &:disabled { opacity: 0.5; cursor: not-allowed; }

  &.save {
    background: #2760ff;
    border-color: #2760ff;
    color: #fff;

    &:hover:not(:disabled) {
      background: #1e4dd6;
      border-color: #1e4dd6;
    }
  }

  &.cancel:hover:not(:disabled) {
    background: #f0f2f5;
  }
}
</style>
