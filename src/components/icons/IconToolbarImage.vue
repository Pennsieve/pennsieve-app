<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <circle pid="0" cx="9" cy="8" r="2"/><path pid="1" d="M14 9l-3.1 7.1L9 13l-3 5h12z"/>

  </svg>
</template>

<script>
export default {
  name: "IconToolbarImage",
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
