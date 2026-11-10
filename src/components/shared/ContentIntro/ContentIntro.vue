<script setup>
// A page's (or a view's) first row, under its header: what it shows on the
// left (the Collections page's description style), its actions on the
// right: the #actions slot's, or, with actionsId, ones teleported there (an
// Analysis section's, by AnalysisViewBar: "analysis-content-actions").
defineProps({
  text: { type: String, default: "" },
  actionsId: { type: String, default: "" },
});
</script>

<template>
  <div class="content-intro">
    <p class="intro-text">
      {{ text }}
      <slot />
    </p>
    <div :id="actionsId || undefined" class="content-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.content-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 16px;
}
/* As the Collections page's description. */
.intro-text {
  margin: 0;
  max-width: 800px;
  font-size: 16px;
  line-height: 1.6;
  color: theme.$gray_5;

  :deep(a) {
    margin-left: 6px;
    color: theme.$purple_3;
  }
}
.content-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}
/* A phone: the actions under the text. */
@media (max-width: 767px) {
  .content-intro {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}
</style>
