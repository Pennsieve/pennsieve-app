<script setup>
import { ref, computed, watch } from "vue";
import { Close, Loading } from "@element-plus/icons-vue";
import IconAlertLine from "@/components/icons/IconAlertLine.vue";

const {
  title = "Confirmation required",
  heading = "",
  message = "",
  variant = "default",
  icon,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  acknowledgements,
  processing = false,
} = defineProps({
  title: { type: String },
  heading: { type: String },
  message: { type: String },
  variant: {
    type: String,
    validator: (value) => ["default", "danger"].includes(value),
  },
  // An icon component, e.g. from src/components/icons
  icon: { type: Object, default: () => IconAlertLine },
  confirmLabel: { type: String },
  cancelLabel: { type: String },
  acknowledgements: { type: Array, default: () => [] },
  // While true the dialog can't be dismissed, so the caller decides whether
  // to close it (success) or keep it open for a retry (failure)
  processing: { type: Boolean },
});
const emit = defineEmits(["confirm", "cancel"]);
const isDialogVisible = defineModel("visible", { type: Boolean, default: false });

const checkedAcknowledgements = ref([]);
const canConfirm = computed(
  () => checkedAcknowledgements.value.length === acknowledgements.length
);

watch(isDialogVisible, (isVisible) => {
  if (isVisible) {
    checkedAcknowledgements.value = [];
  }
});

function cancel() {
  if (processing) {
    return;
  }
  isDialogVisible.value = false;
  emit("cancel");
}

function confirm() {
  if (canConfirm.value && !processing) {
    emit("confirm");
  }
}
</script>

<template>
  <el-dialog
    :model-value="isDialogVisible"
    class="confirm-dialog"
    width="440px"
    :show-close="false"
    :close-on-click-modal="!processing"
    :close-on-press-escape="!processing"
    :before-close="cancel"
    align-center
  >
    <template #header>
      <div class="confirm-dialog-header">
        <span class="confirm-dialog-title">{{ title }}</span>
        <button
          type="button"
          class="close-button"
          aria-label="Close"
          :disabled="processing"
          @click="cancel"
        >
          <el-icon><Close /></el-icon>
        </button>
      </div>
    </template>

    <div class="confirm-dialog-body">
      <div class="icon-circle" :class="variant">
        <el-icon :size="22"><component :is="icon" /></el-icon>
      </div>
      <h3 v-if="heading" class="confirm-heading">{{ heading }}</h3>
      <p v-if="message" class="confirm-message">{{ message }}</p>
      <slot />

      <el-checkbox-group
        v-if="acknowledgements.length > 0"
        v-model="checkedAcknowledgements"
        class="acknowledgements"
      >
        <el-checkbox
          v-for="acknowledgement in acknowledgements"
          :key="acknowledgement"
          :value="acknowledgement"
        >
          {{ acknowledgement }}
        </el-checkbox>
      </el-checkbox-group>
    </div>

    <template #footer>
      <div class="confirm-dialog-footer">
        <button
          type="button"
          class="dialog-button secondary"
          :disabled="processing"
          @click="cancel"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          class="dialog-button"
          :class="variant === 'danger' ? 'danger' : 'primary'"
          :disabled="!canConfirm || processing"
          @click="confirm"
        >
          <el-icon v-if="processing" class="is-loading"><Loading /></el-icon>
          {{ confirmLabel }}
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<style lang="scss">
// Unscoped: el-dialog's overlay doesn't carry this component's scope id, so
// scoped :deep() rules never reach the dialog box. The class keeps it local.
.el-dialog.confirm-dialog {
  padding: 0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 15px 0 rgba(0, 0, 0, 0.25), 0 28px 41px 0 rgba(33, 43, 54, 0.2);

  .el-dialog__header {
    padding: 0;
    margin: 0;
  }

  .el-dialog__body {
    padding: 0;
  }

  .el-dialog__footer {
    padding: 0;
  }
}
</style>

<style scoped lang="scss">
@use "@/styles/theme";
@use "@/styles/dialog-button";

.confirm-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 16px 16px 24px;
  background: theme.$purple_tint;
}

.confirm-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: theme.$purple_3;
}

.close-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: theme.$purple_2;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;

  &:hover:not(:disabled) {
    background: rgba(theme.$purple_3, 0.08);
    color: theme.$purple_3;
  }

  &:focus-visible {
    outline: 2px solid theme.$purple_2;
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.confirm-dialog-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 32px 8px;
  text-align: center;
}

.icon-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-bottom: 16px;
  border-radius: 50%;
  background: rgba(theme.$purple_3, 0.08);
  color: theme.$purple_3;

  &.danger {
    background: rgba(theme.$red_2, 0.1);
    color: theme.$red_2;
  }
}

.confirm-heading {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
  word-break: break-word;
}

.confirm-message {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: theme.$gray_5;
}

.acknowledgements {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  margin-top: 16px;
  text-align: left;

  :deep(.el-checkbox) {
    height: auto;
    margin-right: 0;
    align-items: flex-start;
    white-space: normal;
  }
}

.confirm-dialog-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 24px 32px 32px;
}

.dialog-button {
  @include dialog-button.styles;
}
</style>
