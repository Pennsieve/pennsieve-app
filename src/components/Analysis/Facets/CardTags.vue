<script setup>
// A card's tags as the filter panel lists them (facets.js tagDisplay): a
// domain's coloured dot and name, a field's (or any other) name in grey.
import { computed } from "vue";
import { displayTags } from "./facets";

const props = defineProps({
  tags: { type: Array, default: () => [] },
  // Shown at most; then +n.
  max: { type: Number, default: 4 },
  // Not the item's own (a workflow's apps'): in italics.
  inherited: { type: Boolean, default: false },
});
// Each once (the same domain or field under two spellings shows once).
const unique = computed(() => displayTags(props.tags));
const shown = computed(() => unique.value.slice(0, props.max));
</script>

<template>
  <div class="card-tags" :class="{ 'card-tags--inherited': inherited }">
    <span v-for="t in shown" :key="t.key" class="card-tag" :class="{ 'card-tag--domain': t.domain }">
      <span v-if="t.color" class="card-tag-dot" :style="{ background: t.color }" /><span class="card-tag-text">{{ t.text }}</span>
    </span>
    <span v-if="unique.length > max" class="card-tag">+{{ unique.length - max }}</span>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

/* One line, a few; the rest are found by search. */
/* Whole tags only: one that doesn't fit wraps to a second line, hidden
   (never cut mid-word); a first tag longer than the row ends in "…". */
.card-tags {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 12px;
  height: 18px;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: theme.$gray_5;
}
.card-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  min-width: 0;
  white-space: nowrap;
}
.card-tag-text {
  overflow: hidden;
  text-overflow: ellipsis;
}
/* A domain's name as the panel's, darker than a field's. */
.card-tag--domain {
  color: theme.$gray_6;
}
.card-tag-dot {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
}
.card-tags--inherited {
  font-style: italic;
}
</style>
