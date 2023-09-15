<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M17 7h-3a1 1 0 0 0 0 2h3a3 3 0 1 1 0 6h-3a1 1 0 0 0 0 2h3a5 5 0 1 0 0-10zM10 15H7a3 3 0 1 1 0-6h3a1 1 0 1 0 0-2H7a5 5 0 1 0 0 10h3a1 1 0 1 0 0-2z"/><path pid="1" d="M7.06 12a1 1 0 0 0 1 1h7.83a1 1 0 0 0 0-2H8.06a1 1 0 0 0-1 1z"/>

  </svg>
</template>

<script>
export default {
  name: "IconLink",
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
