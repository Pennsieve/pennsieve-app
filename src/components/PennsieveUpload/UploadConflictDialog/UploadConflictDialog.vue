<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="$emit('update:dialogVisible', $event)"
    data-cy="uploadConflictDialog"
    class="upload-conflict-dialog"
    :show-close="false"
    width="520px"
  >
    <template #header>
      <bf-dialog-header
        data-cy="uploadConflictTitle"
        :title="title"
      />
    </template>

    <dialog-body>
      <p class="conflict-summary">
        {{ summary }}
      </p>

      <ul class="conflict-list">
        <li
          v-for="name in displayNames"
          :key="name"
          class="conflict-list-item"
        >
          {{ name }}
        </li>
        <li v-if="hiddenCount > 0" class="conflict-list-more">
          …and {{ hiddenCount }} more
        </li>
      </ul>

      <label class="remember-choice">
        <input
          type="checkbox"
          data-cy="rememberConflictChoice"
          v-model="rememberChoice"
        />
        Remember my choice
      </label>
    </dialog-body>

    <template #footer>
      <bf-button
        class="secondary"
        data-cy="cancelConflictUpload"
        @click="onCancel"
      >
        Cancel
      </bf-button>
      <bf-button
        class="secondary"
        data-cy="keepBothConflict"
        @click="onChoose('keepBoth')"
      >
        Keep both
      </bf-button>
      <bf-button
        data-cy="replaceConflict"
        @click="onChoose('replace')"
      >
        Replace
      </bf-button>
    </template>
  </el-dialog>
</template>

<script setup>
// UploadConflictDialog surfaces name-collision resolution at upload time.
//
// Emits:
//  - update:dialogVisible(boolean)
//  - resolve({ strategy: 'replace'|'keepBoth'|'cancel', remember: boolean })
//
// The parent component owns the conflict list + the target folder; this
// component is pure-UI. "Remember my choice" persistence to
// localStorage is also the parent's responsibility — we just return the
// flag alongside the decision.
import { computed, ref, watch } from "vue";
import BfButton from "../../shared/bf-button/BfButton.vue";
import BfDialogHeader from "../../shared/bf-dialog-header/BfDialogHeader.vue";

const props = defineProps({
  dialogVisible: { type: Boolean, default: false },
  // Array of { incomingName, existingPackage } — shape produced by
  // uploadModule's detectConflicts action.
  conflicts: { type: Array, default: () => [] },
});

const emit = defineEmits(["update:dialogVisible", "resolve"]);

const rememberChoice = ref(false);

// Reset the remember checkbox each time the dialog re-opens so the
// previous session's box state doesn't silently persist.
watch(
  () => props.dialogVisible,
  (open) => {
    if (open) rememberChoice.value = false;
  }
);

const total = computed(() => props.conflicts.length);

const title = computed(() => {
  const noun = total.value === 1 ? "file" : "files";
  return `${total.value} ${noun} already exist${total.value === 1 ? "s" : ""}`;
});

const summary = computed(() => {
  const noun = total.value === 1 ? "file" : "files";
  return `Choose how to handle ${total.value} incoming ${noun} that collide with existing packages. Replace soft-deletes the current package and uploads the new one in its place. Keep both appends " (N)" to the new upload's name.`;
});

// Cap at 5 — longer lists get a "…and N more" line rather than a
// scrolling block. The dialog is for a decision, not a review.
const displayNames = computed(() =>
  props.conflicts.slice(0, 5).map((c) => c.incomingName)
);

const hiddenCount = computed(() =>
  Math.max(0, total.value - displayNames.value.length)
);

function onChoose(strategy) {
  emit("resolve", { strategy, remember: rememberChoice.value });
  emit("update:dialogVisible", false);
}

function onCancel() {
  emit("resolve", { strategy: "cancel", remember: false });
  emit("update:dialogVisible", false);
}
</script>

<style lang="scss" scoped>
.conflict-summary {
  margin: 0 0 12px;
  line-height: 1.4;
}
.conflict-list {
  margin: 0 0 16px;
  padding-left: 18px;
  max-height: 160px;
  overflow-y: auto;
}
.conflict-list-item {
  font-family: var(--mono-font, monospace);
  font-size: 13px;
  line-height: 1.6;
}
.conflict-list-more {
  list-style: none;
  margin-left: -18px;
  color: var(--text-muted, #6a737d);
  font-style: italic;
  font-size: 13px;
}
.remember-choice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}
</style>