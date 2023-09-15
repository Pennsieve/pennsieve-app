<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M7.7 6h2.7v4.6h3.3V6h2.7v12h-2.7v-5h-3.3v5H7.7V6z"/>

  </svg>
</template>

<script>
export default {
  name: "IconToolbarTextHeading",
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
