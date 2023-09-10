<template>
  <svg
    v-show="isVisible"
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    viewBox="0 0 6 10"
    :fill="color"
  >
  <path pid="0" d="M5 10c-.3 0-.5-.1-.7-.3l-4-4c-.4-.4-.4-1 0-1.4l4-4c.4-.4 1-.4 1.4 0s.4 1 0 1.4L2.4 5l3.3 3.3c.4.4.4 1 0 1.4-.2.2-.4.3-.7.3z"/>

  </svg>
</template>

<script>
export default {
  name: "IconArrowLeft",
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
    isVisible: {
      type: Boolean,
      default: true,
    }
  },
};
</script>


