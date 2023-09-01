<template>
  <svg
    v-show="isVisible"
    xmlns="http://www.w3.org/2000/svg"
    :width="width"
    :height="height"
    viewBox="0 0 24 24"
    :fill="color"
  >
    <path pid="0" d="M17.31 7.48a1 1 0 0 1 1.41 0 1 1 0 0 1 0 1.42l-7.88 7.59a1 1 0 0 1-1.41 0l-4.11-4.2a1 1 0 1 1 1.42-1.4l3.43 3.5z"/>

  </svg>
</template>

<script>
export default {
  name: "IconCheck",
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
      default: "#fff",
    },
    isVisible: {
      type: Boolean,
      default: true,
    }
  },
};
</script>




