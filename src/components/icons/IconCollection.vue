<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M32 32H0V8h32zM2 30h28V10H2zM6 0h20v2H6zM3 4h26v2H3z"/>

  </svg>
</template>

<script>
export default {
  name: "IconCollection",
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
