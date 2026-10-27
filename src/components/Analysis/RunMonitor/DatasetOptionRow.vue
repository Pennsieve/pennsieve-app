<script setup>
/*
  A dataset as a dataset picker lists it: its banner, name, a line of its
  description and a line of facts (files, size, last update, the user's
  role). A dataset with no files is dimmed.
*/
import { computed } from "vue";
import { datasetSummary } from "./dataTargets";

const props = defineProps({
  dataset: { type: Object, required: true },
});
const s = computed(() => datasetSummary(props.dataset));
</script>

<template>
  <div class="dor" :class="{ 'is-empty': s.empty }">
    <img class="dor__banner" :src="s.banner || '/images/banner-placeholder.jpg'" alt="" loading="lazy" />
    <div class="dor__text">
      <span class="dor__name" :title="s.name">{{ s.name }}</span>
      <span v-if="s.description" class="dor__desc" :title="s.description">{{ s.description }}</span>
      <span class="dor__meta">{{ s.meta }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.dor {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 4px 0;

  &.is-empty {
    opacity: 0.6;
  }
}
.dor__banner {
  flex: 0 0 auto;
  width: 56px;
  height: 36px;
  border-radius: 6px;
  object-fit: cover;
  background: theme.$gray_1;
}
.dor__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.3;
}
.dor__name,
.dor__desc,
.dor__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dor__name {
  font-size: 13px;
  font-weight: 500;
  color: theme.$gray_6;
}
.dor__desc {
  font-size: 12px;
  font-weight: normal;
  color: theme.$gray_5;
}
.dor__meta {
  font-size: 11px;
  font-weight: normal;
  color: theme.$gray_4;
}
</style>
