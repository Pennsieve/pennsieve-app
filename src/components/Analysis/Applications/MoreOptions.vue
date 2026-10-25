<script setup>
// "More options": a builder card's advanced fields, folded away until they're
// wanted. It opens by itself when one of them has a value or a problem.
import { ref, watch } from "vue";

const props = defineProps({
  label: { type: String, default: "More options" },
  // Open it: a field inside has a value or a problem.
  forceOpen: { type: Boolean, default: false },
});

const open = ref(props.forceOpen);
watch(
  () => props.forceOpen,
  (v) => {
    if (v) open.value = true;
  }
);
</script>

<template>
  <div class="more-options">
    <button type="button" class="more-toggle" :aria-expanded="open" @click="open = !open">
      <span class="caret" :class="{ open }">▸</span>
      {{ label }}
    </button>
    <div v-if="open" class="more-body">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.more-options {
  grid-column: 1 / -1;
}
.more-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    color: theme.$purple_3;
  }
  .caret {
    font-size: 10px;
    transition: transform 0.15s ease;
    &.open {
      transform: rotate(90deg);
    }
  }
}
.more-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 18px;
  margin-top: 10px;

  :slotted(.full-width) {
    grid-column: 1 / -1;
  }
}
</style>
