<script setup>
// A slim note over a run list with a history but nothing running (Notebooks
// and Workflows Live): a small illustration (48px), a line, then a text
// link to start one (the default slot's button, class "running-note-link").
// One row, about 64px; it centres and wraps on a phone.
defineProps({
  image: { type: String, required: true },
  text: { type: String, required: true },
});
</script>

<template>
  <div class="running-note">
    <img class="running-note__illo" :src="image" alt="" />
    <span class="running-note__text">{{ text }}</span>
    <slot />
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.running-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  min-height: 64px;
  margin-bottom: 16px;
  padding: 8px 16px 8px 8px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$gray_1;
}
.running-note__illo {
  width: 48px;
  height: 48px;
  object-fit: contain;
}
.running-note__text {
  font-size: 14px;
  color: theme.$gray_6;
}
.running-note :deep(.running-note-link) {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 14px;
  color: theme.$link-color;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: theme.$link-color-hover;
  }
  &:disabled {
    color: theme.$gray_4;
    cursor: default;
  }
}
@media (max-width: 767px) {
  .running-note {
    justify-content: center;
    text-align: center;
  }
}
</style>
