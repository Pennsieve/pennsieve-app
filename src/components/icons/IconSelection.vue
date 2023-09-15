<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    :fill="color"
    viewBox="0 0 24 24"
  >
    <path pid="0" d="M16 10V7h-4V4H4v10h4v3h4v3h8V10zM6 12V6h4v1H8v5zm4 3V9h4v1h-2v5zm8 3h-4v-6h4z"/>

  </svg>
</template>

<script>
export default {
  name: "IconSelection",
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
