<script setup>
// The code assistant's mark: a sparkle, in the colour it's drawn with
// (currentColor). Every AI action in the notebook shows it.
defineProps({ size: { type: Number, default: 16 } });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="assist-icon">
    <path d="M10 2.5c.75 4.9 2.8 7 7.5 7.75-4.7.75-6.75 2.85-7.5 7.75-.75-4.9-2.8-7-7.5-7.75 4.7-.75 6.75-2.85 7.5-7.75z" />
    <path d="M18.5 14.5c.4 2.1 1.15 2.85 3.25 3.25-2.1.4-2.85 1.15-3.25 3.25-.4-2.1-1.15-2.85-3.25-3.25 2.1-.4 2.85-1.15 3.25-3.25z" />
  </svg>
</template>

<style scoped>
.assist-icon {
  flex: 0 0 auto;
  vertical-align: -0.15em;
}
</style>
