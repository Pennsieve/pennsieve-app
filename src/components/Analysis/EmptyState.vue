<script setup>
// A page's empty state (Notebooks and Workflows Live): an illustration
// (~180px), a heading, one line, then its actions (the default slot: a
// primary button, a link). Centred; it wraps on a phone.
defineProps({
  image: { type: String, required: true }, // an imported illustration's URL
  title: { type: String, required: true },
  text: { type: String, default: "" },
});
</script>

<template>
  <div class="empty-state-block">
    <img class="empty-state-block__illo" :src="image" alt="" />
    <h3 class="empty-state-block__title">{{ title }}</h3>
    <p v-if="text" class="empty-state-block__text">{{ text }}</p>
    <slot name="note" />
    <div v-if="$slots.default" class="empty-state-block__actions"><slot /></div>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.empty-state-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  max-width: 440px;
  margin: 32px auto;
  text-align: center;
}
.empty-state-block__illo {
  width: 180px;
  max-width: 60%;
  height: auto;
  margin-bottom: 8px;
}
.empty-state-block__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: theme.$gray_6;
}
.empty-state-block__text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: theme.$gray_5;
}
.empty-state-block__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 12px;
}
/* A text link among the actions. */
.empty-state-block__actions :deep(.empty-state-link) {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 14px;
  color: theme.$link-color;
  cursor: pointer;

  &:hover {
    color: theme.$link-color-hover;
  }
}
</style>
