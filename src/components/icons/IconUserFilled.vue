<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M10 4a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm2 12H0a6 6 0 0 1 12 0z" fill-rule="evenodd"/>

  </svg>
</template>

<script>
export default {
  name: "IconUserFilled",
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
