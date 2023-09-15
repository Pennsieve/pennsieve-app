<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M12 4a8 8 0 1 1-8 8 8.01 8.01 0 0 1 8-8m0-2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/>

  </svg>
</template>

<script>
export default {
  name: "IconWaitingCircle",
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
