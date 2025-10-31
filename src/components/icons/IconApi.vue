<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path d="M14 12l-2 2-2-2 2-2 2 2zm-2-6l2.12 2.12 2.5-2.5L12 1 7.38 5.62l2.5 2.5L12 6zm6 6l-2.12-2.12 2.5-2.5L23 12l-4.62 4.62-2.5-2.5L18 12zM12 18l-2.12-2.12-2.5 2.5L12 23l4.62-4.62-2.5-2.5L12 18zM6 12l2.12 2.12-2.5 2.5L1 12l4.62-4.62 2.5 2.5L6 12z"/>
  </svg>
</template>

<script>
export default {
  name: "IconApi",
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