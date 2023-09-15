<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M17.4 13.3L6.6 2.5v14.8L10 14l3.1 7.5 2.4-1-3-7.2z"/>

  </svg>
</template>

<script>
export default {
  name: "IconMouseCursor",
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
