<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M7.1 15.9h2.8l1.6-7.8H8.7L9.1 6h8.2l-.4 2.1H14l-1.6 7.8h2.8l-.3 2.1H6.7l.4-2.1z"/>

  </svg>
</template>

<script>
export default {
  name: "IconToolbarTextItalic",
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
