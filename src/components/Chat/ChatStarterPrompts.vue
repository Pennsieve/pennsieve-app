<template>
  <div v-if="prompts.length" class="chat-starter-prompts">
    <p class="hint">Try asking…</p>
    <div class="chips">
      <button
        v-for="prompt in prompts"
        :key="prompt"
        class="chip"
        type="button"
        :disabled="disabled"
        @click="$emit('pick', prompt)"
      >{{ prompt }}</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  prompts: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})
defineEmits(['pick'])
</script>

<style scoped lang="scss">
@use '../../styles/theme';
.chat-starter-prompts {
  padding: 0 16px 16px;
}

.hint {
  font-size: 13px;
  color: #666;
  margin: 0 0 8px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 16px;
  padding: 8px 16px;
  font-size: 13px;
  color: #1c1c1c;
  cursor: pointer;
  text-align: left;

  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:not(:disabled):hover { background: #f0f2f5; border-color: theme.$purple_3; color: theme.$purple_3; }
}
</style>
