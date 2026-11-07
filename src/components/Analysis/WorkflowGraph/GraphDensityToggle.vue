<script setup>
// The Compact / Detailed switch in a workflow graph's toolbar.
defineProps({
  detailed: { type: Boolean, default: false },
});
const emit = defineEmits(["update:detailed"]);
</script>

<template>
  <div class="gdt" role="group" aria-label="Node size">
    <button
      type="button"
      class="gdt__opt"
      :class="{ 'is-on': !detailed }"
      :aria-pressed="!detailed"
      @click="emit('update:detailed', false)"
    >
      Compact
    </button>
    <button
      type="button"
      class="gdt__opt"
      :class="{ 'is-on': detailed }"
      :aria-pressed="detailed"
      @click="emit('update:detailed', true)"
    >
      Detailed
    </button>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

// Matches the toolbar's Auto Layout button.
.gdt {
  display: flex;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  overflow: hidden;
}
.gdt__opt {
  padding: 6px 10px;
  border: none;
  background: none;
  color: theme.$gray_5;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  & + & {
    border-left: 1px solid theme.$gray_3;
  }
  &:hover:not(.is-on) {
    color: theme.$purple_1;
  }
  &.is-on {
    background: theme.$purple_tint;
    color: theme.$purple_3;
    cursor: default;
  }
}
</style>
