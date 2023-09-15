<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M20 2v18s0 2-2 2H6s-2 0-2-2V4s0-2 2-2h14zm-2 6h-4V4H6v16h12V8zm0-2V4h-2v2h2z"/>

  </svg>
</template>

<script>
export default {
  name: "IconFile",
  props: {
    width: {
      type: Number,
      default: 16,
    },
    height: {
      type: Number,
      default: 16,
    },
    color: {
      type: String,
      default: "currentColor",
    },
  },
};
</script>
