<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path d="M4 6h2v2H4V6zm0 5h2v2H4v-2zm0 5h2v2H4v-2zm16-8V6h-2V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H8V4c0-1.11-.89-2-2-2s-2 .89-2 2v16c0 1.11.89 2 2 2s2-.89 2-2v-2h2v2c0 1.11.89 2 2 2h4c1.11 0 2-.89 2-2v-2h2v2c0 1.11.89 2 2 2s2-.89 2-2V8c0-1.11-.89-2-2-2zM12 4h4v2h-4V4zm4 16h-4v-2h4v2zm4 0h-2v-2h2v2zm0-5h-2v-2h2v2zm0-5h-2V8h2v2z"/>
  </svg>
</template>

<script>
export default {
  name: "IconWorkspaces",
  props: {
    width: {
      type: Number,
      default: 24,
    },
    height: {
      type: Number,
      default: 24,
    },
    color: {
      type: String,
      default: "currentColor",
    },
  },
};
</script>