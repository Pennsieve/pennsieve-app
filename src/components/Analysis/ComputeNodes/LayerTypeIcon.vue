<script setup>
import { computed } from "vue";

// A node's persistent (data) layer. Environments have their own icon
// (RunMonitor/EnvironmentIcon.vue).
const props = defineProps({
  size: { type: [Number, String], default: 18 },
});

const label = "Reference data";
const px = computed(() =>
  typeof props.size === "number" ? `${props.size}px` : props.size
);
</script>

<template>
  <span
    class="layer-type-icon"
    role="img"
    :title="label"
    :aria-label="label"
    :style="{ width: px, height: px }"
  >
    <!-- Generic stacked-layers glyph -->
    <svg viewBox="0 0 24 24" fill="#8a94a6" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z" />
    </svg>
  </span>
</template>

<style scoped>
.layer-type-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  flex: none;
}
.layer-type-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
