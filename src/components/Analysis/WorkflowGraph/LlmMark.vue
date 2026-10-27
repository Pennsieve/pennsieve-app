<script setup>
/*
  The mark on a step whose app calls language models (runtime.llm in its
  app.yml), in the builder and on a run's graph.
*/
defineProps({
  compact: { type: Boolean, default: false },
});
</script>

<template>
  <span
    class="llm-mark"
    :class="{ 'llm-mark--compact': compact }"
    title="Calls language models through Pennsieve (runtime.llm in its app.yml)"
    aria-label="Calls language models"
  >
    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l1.4 3.6 3.6 1.4-3.6 1.4L8 11.5 6.6 7.9 3 6.5l3.6-1.4zM12.5 10l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" /></svg>
  </span>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.llm-mark {
  display: inline-flex;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: theme.$status_purple;

  svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
}
.llm-mark--compact {
  width: 13px;
  height: 13px;
  margin-right: 4px;
}
</style>
