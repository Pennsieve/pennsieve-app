<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M2 1.99h19l-7.67 10.19v7.55l-3.4 2.26v-9.81L2 1.99z"/>

  </svg>
</template>

<script>
export default {
  name: "IconFileFilled",
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
